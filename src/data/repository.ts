import type { Dataset, Entity, EntityMap, Profile, BusinessProfile, Workspace } from '../../shared/domain';
import { emptyDataset, entitySchemas, profileSchema, businessProfileSchema } from '../../shared/domain';
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
}
const businessEntities = new Set<Entity>(['employees', 'business_transactions', 'business_budgets']);
export function readDemo(): Dataset {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as Dataset;
      profileSchema.parse(data.profile);
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
    return readDemo();
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
        db
          .from('organization_members')
          .select('organization_id, role, organizations(name)')
          .eq('user_id', userId),
      ]);
      if (profile.error) throw profile.error;
      if (organizations.error) throw organizations.error;
      if (profile.data) data.profile = profileSchema.parse(profile.data);
      data.organizations = (organizations.data ?? []).map((item) => ({
        id: item.organization_id,
        role: item.role,
        name: (item.organizations as unknown as { name: string })?.name ?? 'Empresa',
      })) as Workspace[];
      if (organizationId && !data.organizations.some((o) => o.id === organizationId))
        throw new Error('Sem acesso a esta empresa.');
      await Promise.all(
        (Object.keys(entitySchemas) as Entity[]).map(async (entity) => {
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
