import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyDataset, entitySchemas, profileSchema, businessProfileSchema } from '../../../shared/domain.ts';
import type { Entity } from '../../../shared/domain.ts';
import { businessSummary, personalSummary, weeklyPlan } from '../../../shared/insights.ts';
import { formatMoney } from '../../../shared/financial-engine.ts';
import { HttpError } from './http.ts';

export async function financialContext(db: SupabaseClient, userId: string, organizationId?: string) {
  const dataset = emptyDataset();
  const profile = await db.from('profiles').select('*').eq('id', userId).single();
  if (profile.error) throw new HttpError(400, 'Complete seu perfil antes de consultar.');
  dataset.profile = profileSchema.parse(profile.data);
  const entities: Entity[] = organizationId
    ? ['business_transactions', 'employees', 'business_budgets']
    : ['transactions', 'financial_accounts', 'goals', 'debts', 'assets', 'budgets'];
  if (organizationId) {
    const membership = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (membership.error || !membership.data) throw new HttpError(403, 'Sem acesso a essa empresa.');
    const b = await db.from('business_profiles').select('*').eq('organization_id', organizationId).single();
    if (b.error) throw new HttpError(400, 'Empresa não configurada.');
    dataset.business = businessProfileSchema.parse(b.data);
  }
  await Promise.all(
    entities.map(async (entity) => {
      const result = await db
        .from(entity)
        .select('*')
        .eq(organizationId ? 'organization_id' : 'user_id', organizationId ?? userId)
        .limit(5000);
      if (result.error || result.data.length >= 5000)
        throw new HttpError(503, 'Não foi possível obter um contexto financeiro completo.');
      Object.assign(dataset, { [entity]: entitySchemas[entity].array().parse(result.data) });
    }),
  );
  const personal = personalSummary(dataset),
    business = businessSummary(dataset);
  const metrics: Record<string, string> = organizationId
    ? {
        cash: formatMoney(dataset.business.cash),
        revenue: formatMoney(business.revenue),
        costs: formatMoney(business.costs),
        result: formatMoney(business.result),
        payroll: formatMoney(business.payroll),
        runway:
          business.runwayAfter === null
            ? 'Sem consumo líquido de caixa'
            : `${business.runwayAfter.toFixed(1)} meses`,
        break_even:
          business.breakEven === null ? 'Sem margem de contribuição' : formatMoney(business.breakEven),
      }
    : {
        balance: formatMoney(personal.balance),
        income: formatMoney(personal.income),
        expenses: formatMoney(personal.expenses),
        free: formatMoney(personal.free),
        reserve: formatMoney(personal.reserve),
        debt: formatMoney(personal.debts),
        net_worth: formatMoney(personal.netWorth),
        upcoming_bills: formatMoney(personal.upcomingBills),
        score: String(personal.score.overall ?? 'Dados insuficientes'),
      };
  return {
    dataset,
    metrics,
    plan: organizationId ? [] : weeklyPlan(dataset),
    milestone: organizationId ? null : personal.milestone,
    scope: organizationId ? 'business' : 'personal',
  };
}
