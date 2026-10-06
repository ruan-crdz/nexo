import type {
  Dataset,
  Entity,
  EntityMap,
  Profile,
  BusinessProfile,
  Workspace,
  RecurringRule,
  Transaction,
  Goal,
} from '../../shared/domain';
import {
  emptyDataset,
  entitySchemas,
  profileSchema,
  businessProfileSchema,
  recurringRuleSchema,
  transactionSchema,
  goalSchema,
  habitEventSchema,
  goalEventSchema,
} from '../../shared/domain';
import { civilDate, shiftDays } from '../../shared/financial-engine';
import { v5 as uuid } from 'uuid';
import { recurringTransactions } from '../../shared/planning';
import { merchantKey } from '../../shared/financial-decisions';
import { canAward, habitPoints } from '../../shared/journey';
import type { HabitKind } from '../../shared/journey';
import { readPages } from '../../shared/pagination';
import { createDemo } from './demo';
import { supabase } from './client';
import {
  cacheDataset,
  drainTransactions,
  enqueueTransaction,
  offlineDataset,
  offlineEnabled,
  pendingTransactions,
} from './offline';

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
  importTransactions(
    rows: Transaction[],
    links?: { incoming_id: string; canonical_id: string }[],
  ): Promise<{ saved: number; skipped: number }>;
  categoryPreference(merchant: string, category: string | null): Promise<void>;
  saveJourneyGoal(goal: Goal): Promise<void>;
  goalProgress(
    goalId: string,
    delta: number,
    reason: 'saving' | 'withdrawal' | 'emergency',
    requestId: string,
  ): Promise<{ saved: number; points: number; repeated: boolean }>;
  checkin(kind: 'checkin' | 'reflection', mode?: 'steady' | 'recovery' | 'pause'): Promise<number>;
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
      data.import_aliases ??= [];
      data.category_preferences ??= [];
      data.habit_events = habitEventSchema.array().parse(data.habit_events ?? []);
      data.goal_events = goalEventSchema.array().parse(data.goal_events ?? []);
      businessProfileSchema.parse(data.business);
      for (const key of Object.keys(entitySchemas) as Entity[])
        Object.assign(data, { [key]: entitySchemas[key].array().parse(data[key]) });
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
function awardDemo(data: Dataset, kind: HabitKind, key: string) {
  const day = civilDate(new Date(), data.profile.timezone);
  if (!canAward(data.habit_events, kind, day, key, data.profile.checkin_frequency)) return 0;
  data.habit_events.push({ id: key, kind, day, points: habitPoints[kind] });
  return habitPoints[kind];
}
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
  async saveJourneyGoal(value) {
    const goal = goalSchema.parse(value);
    const data = readDemo();
    const existing = data.goals.find((row) => row.id === goal.id);
    goal.high_water = Math.max(goal.saved, existing?.high_water ?? 0, existing?.saved ?? 0);
    data.goals = [...data.goals.filter((row) => row.id !== goal.id), goal];
    data.profile.active_goal_id = goal.id;
    writeDemo(data);
  },
  async goalProgress(goalId, delta, reason, requestId) {
    const data = readDemo();
    const goal = data.goals.find((row) => row.id === goalId);
    if (!goal) throw new Error('Meta não encontrada.');
    const existing = data.goal_events.find((row) => row.id === requestId);
    if (existing) {
      if (existing.goal_id !== goalId || existing.delta !== delta || existing.reason !== reason)
        throw new Error('Esse pedido já foi usado com outros dados.');
      return { saved: existing.balance_after, points: 0, repeated: true };
    }
    if (!Number.isSafeInteger(delta) || delta === 0 || (reason === 'saving' ? delta < 0 : delta > 0))
      throw new Error('Progresso inválido.');
    const saved = goal.saved + delta;
    goalSchema.parse({ ...goal, saved });
    goal.high_water = Math.max(goal.high_water, goal.saved, saved);
    goal.saved = saved;
    data.goal_events.push({
      id: requestId,
      goal_id: goalId,
      delta,
      reason,
      balance_after: saved,
      created_at: new Date().toISOString(),
    });
    const points = delta > 0 ? awardDemo(data, 'saving', requestId) : 0;
    writeDemo(data);
    return { saved, points, repeated: false };
  },
  async checkin(kind, mode) {
    const data = readDemo();
    if (mode) {
      data.profile.journey_mode = mode;
      if (mode === 'pause')
        data.profile.journey_pause_until = shiftDays(civilDate(new Date(), data.profile.timezone), 7);
      else data.profile.journey_pause_until = null;
    }
    const day = civilDate(new Date(), data.profile.timezone);
    const id = uuid(`${kind}:${day}`, 'da332e39-a082-402e-a14b-0b948242595b');
    const points = awardDemo(data, kind, id);
    writeDemo(data);
    return points;
  },
  async importTransactions(rows, links = []) {
    const parsed = transactionSchema.array().max(10000).parse(rows);
    const data = readDemo();
    const known = new Set([...data.transactions.map((row) => row.id), ...data.import_aliases]);
    for (const link of links) {
      const incoming = parsed.find((row) => row.id === link.incoming_id);
      const canonical = data.transactions.find((row) => row.id === link.canonical_id);
      if (
        !incoming ||
        !canonical ||
        incoming.amount !== canonical.amount ||
        incoming.type !== canonical.type ||
        Math.abs(Date.parse(incoming.date) - Date.parse(canonical.date)) > 172800000
      )
        throw new Error('Conciliação inválida.');
      known.add(incoming.id);
      data.import_aliases.push(incoming.id);
    }
    let saved = 0;
    for (const row of parsed) {
      if (known.has(row.id)) continue;
      if (row.account_id && !data.financial_accounts.some((account) => account.id === row.account_id))
        throw new Error('Conta inválida.');
      const preference = data.category_preferences.find(
        (item) => item.merchant === merchantKey(row.description),
      );
      data.transactions.push({ ...row, category: preference?.category ?? row.category, source: 'import' });
      known.add(row.id);
      saved++;
    }
    writeDemo(data);
    return { saved, skipped: parsed.length - saved };
  },
  async categoryPreference(merchant, category) {
    const data = readDemo();
    data.category_preferences = data.category_preferences.filter((row) => row.merchant !== merchant);
    if (category) data.category_preferences.push({ merchant, category });
    writeDemo(data);
  },
  async save<K extends Entity>(entity: K, value: EntityMap[K]) {
    entitySchemas[entity].parse(value);
    const data = readDemo();
    const rows = data[entity] as EntityMap[K][];
    const index = rows.findIndex((row) => row.id === value.id);
    if (entity === 'goals') {
      const goal = value as EntityMap['goals'];
      const previous = rows[index] as EntityMap['goals'] | undefined;
      goal.high_water = Math.max(goal.saved, previous?.high_water ?? 0, previous?.saved ?? 0);
    }
    if (index >= 0) rows[index] = value;
    else rows.push(value);
    if (entity === 'transactions' && index < 0) {
      const row = value as Transaction;
      if (row.status === 'paid' && row.source === 'manual') awardDemo(data, 'record', row.id);
    }
    writeDemo(data);
  },
  async remove(entity, id) {
    const data = readDemo();
    if (entity === 'financial_accounts' && data.transactions.some((t) => t.account_id === id))
      throw new Error('Esta conta possui movimentos. Reatribua os movimentos antes de excluí-la.');
    Object.assign(data, { [entity]: data[entity].filter((row) => row.id !== id) });
    if (entity === 'transactions') data.habit_events = data.habit_events.filter((event) => event.id !== id);
    if (entity === 'goals') {
      data.goal_events = data.goal_events.filter((row) => row.goal_id !== id);
      if (data.profile.active_goal_id === id) data.profile.active_goal_id = null;
    }
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
  let collectMetrics = false;
  let transactionIds = new Set<string>();
  return {
    async load(organizationId) {
      if (!navigator.onLine && !organizationId) {
        const cached = await offlineDataset(userId);
        if (cached) return cached;
        throw new Error('Sem internet e sem cópia offline autorizada.');
      }
      if (offlineEnabled(userId))
        await drainTransactions(userId, async (row) => {
          const response = await db
            .from('transactions')
            .upsert(
              { ...transactionSchema.parse(row), user_id: userId },
              { onConflict: 'id', ignoreDuplicates: true },
            );
          if (response.error) throw new Error('Fila offline ainda não foi sincronizada.');
        });
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
      const rules = await readPages((from, to) =>
        db.from('recurring_rules').select('*').eq('user_id', userId).order('id').range(from, to),
      );
      data.recurring_rules = recurringRuleSchema.array().parse(rules);
      data.import_aliases = (
        await readPages((from, to) =>
          db
            .from('transaction_sources')
            .select('incoming_id')
            .eq('user_id', userId)
            .order('incoming_id')
            .range(from, to),
        )
      ).map((row) => row.incoming_id);
      data.category_preferences = await readPages((from, to) =>
        db
          .from('category_preferences')
          .select('merchant,category')
          .eq('user_id', userId)
          .order('merchant')
          .range(from, to),
      );
      data.habit_events = habitEventSchema
        .array()
        .parse(
          await readPages((from, to) =>
            db
              .from('habit_events')
              .select('id,kind,day,points')
              .eq('user_id', userId)
              .order('id')
              .range(from, to),
          ),
        );
      data.goal_events = goalEventSchema
        .array()
        .parse(
          await readPages((from, to) =>
            db
              .from('goal_events')
              .select('id,goal_id,delta,reason,balance_after,created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .order('id')
              .range(from, to),
          ),
        );
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
          const rows = await readPages((from, to) =>
            db
              .from(entity)
              .select('*')
              .eq(
                businessEntities.has(entity) ? 'organization_id' : 'user_id',
                businessEntities.has(entity) ? organizationId : userId,
              )
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(from, to),
          );
          Object.assign(data, { [entity]: entitySchemas[entity].array().parse(rows) });
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
      try {
        await cacheDataset(userId, data);
        localStorage.removeItem(`nexo.offline.error.${userId}`);
      } catch {
        localStorage.setItem(`nexo.offline.error.${userId}`, 'cache');
      }
      collectMetrics = data.profile.metrics_enabled;
      transactionIds = new Set(data.transactions.map((row) => row.id));
      return data;
    },
    async save(entity, value, organizationId) {
      const started = Date.now();
      const parsed = entitySchemas[entity].parse(value),
        business = businessEntities.has(entity);
      if (!navigator.onLine) {
        if (entity !== 'transactions' || organizationId) throw new Error('Esta operação exige conexão.');
        const pending = await pendingTransactions(userId);
        const cached = await offlineDataset(userId);
        if (
          cached?.transactions.some((row) => row.id === parsed.id) &&
          !pending.some((row) => row.id === parsed.id)
        )
          throw new Error('Corrigir anotação já sincronizada exige conexão para conferir a versão atual.');
        await enqueueTransaction(userId, transactionSchema.parse(parsed));
        return;
      }
      if (business && !organizationId) throw new Error('Selecione uma empresa.');
      const { error } = await db
        .from(entity)
        .upsert({ ...parsed, ...(business ? { organization_id: organizationId } : { user_id: userId }) });
      if (entity === 'transactions' && collectMetrics) {
        try {
          await db.from('operation_metrics').insert({
            user_id: userId,
            operation: transactionIds.has(parsed.id) ? 'correction' : 'manual',
            latency_ms: Math.max(0, Date.now() - started),
            success: !error,
          });
        } catch {
          collectMetrics = false;
        }
      }
      if (!error && entity === 'transactions') transactionIds.add(parsed.id);
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
    async importTransactions(rows, links = []) {
      const payload = transactionSchema.array().max(10000).parse(rows);
      const { data, error } = await db.rpc('import_reviewed_transactions', {
        payload,
        reconciliation: links,
      });
      if (error) throw new Error('O lote não foi salvo. Confira os registros, a conta e sua conexão.');
      return data as { saved: number; skipped: number };
    },
    async categoryPreference(merchant, category) {
      const result = category
        ? await db.from('category_preferences').upsert({ user_id: userId, merchant, category })
        : await db.from('category_preferences').delete().eq('user_id', userId).eq('merchant', merchant);
      if (result.error) throw new Error('Não foi possível atualizar a preferência.');
    },
    async saveJourneyGoal(value) {
      const result = await db.rpc('save_journey_goal', { payload: goalSchema.parse(value) });
      if (result.error) throw new Error('Não foi possível salvar a meta. Confira os valores e a conexão.');
    },
    async goalProgress(goalId, delta, reason, requestId) {
      const result = await db.rpc('update_goal_progress', {
        goal: goalId,
        amount_delta: delta,
        event_reason: reason,
        request: requestId,
      });
      if (result.error)
        throw new Error('Não foi possível atualizar. Confira o valor guardado e sua conexão.');
      return result.data as { saved: number; points: number; repeated: boolean };
    },
    async checkin(kind, mode) {
      const result = await db.rpc('journey_checkin', { event_kind: kind, journey_state: mode ?? null });
      if (result.error) throw new Error('Não foi possível registrar seu check-in. Tente novamente.');
      return Number(result.data);
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
