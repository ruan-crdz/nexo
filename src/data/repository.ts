import type {
  Dataset,
  Entity,
  EntityMap,
  Profile,
  BusinessProfile,
  Workspace,
  RecurringRule,
  Transaction,
} from '../../shared/domain';
import {
  emptyDataset,
  entitySchemas,
  profileSchema,
  businessProfileSchema,
  recurringRuleSchema,
  transactionSchema,
} from '../../shared/domain';
import { civilDate } from '../../shared/financial-engine';
import { recurringTransactions } from '../../shared/planning';
import { createDemo } from './demo';
import { supabase } from './client';

export const DEMO_KEY = 'nexo.demo.v1';
export interface Repository {
  load(organizationId: string | null): Promise<Dataset>;
  save<K extends Entity>(entity: K, value: EntityMap[K], organizationId: string | null): Promise<void>;
  remove(entity: Entity, id: string, organizationId: string | null): Promise<void>;
  profile(value: Profile): Promise<void>;
  business(value: BusinessProfile, organizationId: string): Promise<void>;
  createOrganization(name: string): Promise<string>;
  saveRecurring(value: RecurringRule): Promise<void>;
  removeRecurring(id: string): Promise<void>;
  importTransactions(rows: Transaction[]): Promise<{ saved: number; skipped: number }>;
}
const businessEntities = new Set<Entity>(['employees', 'business_transactions', 'business_budgets']);
export function readDemo(): Dataset {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as Dataset;
      data.profile = profileSchema.parse(data.profile);
      data.recurring_rules = recurringRuleSchema.array().parse(data.recurring_rules ?? []);
      data.recurring_occurrences ??= [];
      businessProfileSchema.parse(data.business);
      for (const key of Object.keys(entitySchemas) as Entity[]) entitySchemas[key].array().parse(data[key]);
      return data;
    } catch {
      throw new Error('Os dados de demonstração estão inválidos. Redefina a demonstração em Perfil.');
    }
  }
  const data = createDemo();
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  return data;
}
const writeDemo = (data: Dataset) => localStorage.setItem(DEMO_KEY, JSON.stringify(data));
export const demoRepository: Repository = {
  async load() {
    const data = readDemo();
    const generated = recurringTransactions(
      data.recurring_rules,
      data.transactions,
      civilDate(new Date(), data.profile.timezone),
      data.recurring_occurrences,
    );
    if (generated.length) {
      data.transactions.push(...generated);
      data.recurring_occurrences.push(...generated.map((row) => row.id));
      writeDemo(data);
    }
    return data;
  },
  async saveRecurring(value) {
    const rule = recurringRuleSchema.parse(value);
    const data = readDemo();
    data.recurring_rules = [...data.recurring_rules.filter((row) => row.id !== rule.id), rule];
    writeDemo(data);
  },
  async removeRecurring(id) {
    const data = readDemo();
    data.recurring_rules = data.recurring_rules.filter((rule) => rule.id !== id);
    writeDemo(data);
  },
  async importTransactions(rows) {
    const parsed = transactionSchema.array().max(1000).parse(rows);
    const data = readDemo();
    const known = new Set(data.transactions.map((row) => row.id));
    let saved = 0;
    for (const row of parsed) {
      if (known.has(row.id)) continue;
      if (row.account_id && !data.financial_accounts.some((account) => account.id === row.account_id))
        throw new Error('Conta inválida.');
      data.transactions.push({ ...row, source: 'import' });
      known.add(row.id);
      saved++;
    }
    writeDemo(data);
    return { saved, skipped: parsed.length - saved };
  },
  async save<K extends Entity>(entity: K, value: EntityMap[K]) {
    entitySchemas[entity].parse(value);
    const data = readDemo();
    const rows = data[entity] as EntityMap[K][];
    const index = rows.findIndex((row) => row.id === value.id);
    if (index >= 0) rows[index] = value;
    else rows.push(value);
    writeDemo(data);
  },
  async remove(entity, id) {
    const data = readDemo();
    if (entity === 'financial_accounts' && data.transactions.some((t) => t.account_id === id))
      throw new Error('Esta conta possui movimentos. Reatribua os movimentos antes de excluí-la.');
    Object.assign(data, { [entity]: data[entity].filter((row) => row.id !== id) });
    writeDemo(data);
  },
  async profile(value) {
    const data = readDemo();
    data.profile = profileSchema.parse(value);
    writeDemo(data);
  },
  async business(value) {
    const data = readDemo();
    data.business = businessProfileSchema.parse(value);
    data.organizations[0].name = value.name;
    writeDemo(data);
  },
  async createOrganization(name) {
    const data = readDemo();
    data.profile.business_enabled = true;
    data.organizations[0].name = name;
    data.business.name = name;
    writeDemo(data);
    return data.organizations[0].id;
  },
};
export function cloudRepository(userId: string): Repository {
  if (!supabase) throw new Error('Supabase indisponível.');
  const db = supabase;
  return {
    async load(organizationId) {
      const data = emptyDataset();
      const [profile, organizations] = await Promise.all([
        db.from('profiles').select('*').eq('id', userId).maybeSingle(),
        organizationId
          ? db
              .from('organization_members')
              .select('organization_id, role, organizations(name)')
              .eq('user_id', userId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profile.error) throw profile.error;
      if (organizations.error) throw organizations.error;
      if (profile.data) data.profile = profileSchema.parse(profile.data);
      const synced = await db.rpc('sync_recurring_rules');
      if (synced.error)
        throw new Error(
          'Não foi possível carregar o planejamento. Confira se a migração de planejamento foi aplicada.',
        );
      const rules = await db.from('recurring_rules').select('*').eq('user_id', userId).limit(201);
      if (rules.error || (rules.data?.length ?? 0) > 200)
        throw new Error('Não foi possível carregar todas as recorrências.');
      data.recurring_rules = recurringRuleSchema.array().parse(rules.data ?? []);
      data.organizations = (organizations.data ?? []).map((item) => ({
        id: item.organization_id,
        role: item.role,
        name: (item.organizations as unknown as { name: string })?.name ?? 'Empresa',
      })) as Workspace[];
      if (organizationId && !data.organizations.some((o) => o.id === organizationId))
        throw new Error('Sem acesso a esta empresa.');
      await Promise.all(
        (organizationId
          ? (Object.keys(entitySchemas) as Entity[])
          : (['transactions', 'financial_accounts', 'goals', 'budgets'] as Entity[])
        ).map(async (entity) => {
          if (businessEntities.has(entity) && !organizationId) return;
          const { data: rows, error } = await db
            .from(entity)
            .select('*')
            .eq(
              businessEntities.has(entity) ? 'organization_id' : 'user_id',
              businessEntities.has(entity) ? organizationId : userId,
            )
            .order('created_at', { ascending: false })
            .limit(5000);
          if (error) throw error;
          if (rows?.length === 5000)
            throw new Error(
              'Limite de leitura atingido. Exporte os dados e ajuste a paginação antes de continuar.',
            );
          Object.assign(data, { [entity]: entitySchemas[entity].array().parse(rows ?? []) });
        }),
      );
      if (organizationId) {
        const result = await db
          .from('business_profiles')
          .select('*')
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (result.error) throw result.error;
        if (result.data) data.business = businessProfileSchema.parse(result.data);
      }
      return data;
    },
    async save(entity, value, organizationId) {
      const parsed = entitySchemas[entity].parse(value),
        business = businessEntities.has(entity);
      if (business && !organizationId) throw new Error('Selecione uma empresa.');
      const { error } = await db
        .from(entity)
        .upsert({ ...parsed, ...(business ? { organization_id: organizationId } : { user_id: userId }) });
      if (error) throw new Error('Não foi possível salvar. Verifique seus dados e sua permissão de acesso.');
    },
    async saveRecurring(value) {
      const { error } = await db
        .from('recurring_rules')
        .upsert({ ...recurringRuleSchema.parse(value), user_id: userId });
      if (error) throw new Error('Não foi possível salvar a conta recorrente.');
    },
    async removeRecurring(id) {
      const { error } = await db.from('recurring_rules').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error('Não foi possível remover a recorrência.');
    },
    async importTransactions(rows) {
      const payload = transactionSchema.array().max(1000).parse(rows);
      const { data, error } = await db.rpc('import_transactions', { payload });
      if (error) throw new Error('O lote não foi salvo. Confira os registros, a conta e sua conexão.');
      return data as { saved: number; skipped: number };
    },
    async remove(entity, id, organizationId) {
      const business = businessEntities.has(entity);
      const { error, data } = await db
        .from(entity)
        .delete()
        .eq('id', id)
        .eq(business ? 'organization_id' : 'user_id', business ? organizationId : userId)
        .select('id');
      if (error || !data?.length)
        throw new Error('Não foi possível excluir. O registro pode estar em uso ou você não tem permissão.');
    },
    async profile(value) {
      const { error } = await db.from('profiles').upsert({ id: userId, ...profileSchema.parse(value) });
      if (error) throw error;
    },
    async business(value, organizationId) {
      const { error } = await db
        .from('business_profiles')
        .upsert({ organization_id: organizationId, ...businessProfileSchema.parse(value) });
      if (error) throw error;
    },
    async createOrganization(name) {
      const { data, error } = await db.rpc('create_organization', { organization_name: name });
      if (error) throw error;
      return String(data);
    },
  };
}

export interface BankingProvider {
  readonly kind: 'manual' | 'open-finance';
  importTransactions(file: File): Promise<EntityMap['transactions'][]>;
}
export class ManualBankingProvider implements BankingProvider {
  readonly kind = 'manual';
  async importTransactions(file: File) {
    if (file.size > 2_000_000) throw new Error('O arquivo deve ter até 2 MB.');
    const parsed: unknown = JSON.parse(await file.text());
    return entitySchemas.transactions.array().max(1000).parse(parsed);
  }
}
// An Open Finance provider must implement consent, revocation and reconciliation
// before being registered. No fake connection is exposed in the product.
