import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyDataset,
  entitySchemas,
  profileSchema,
  businessProfileSchema,
  goalEventSchema,
} from '../../../shared/domain.ts';
import type { Entity } from '../../../shared/domain.ts';
import { businessSummary, personalSummary, weeklyPlan } from '../../../shared/insights.ts';
import { civilDate, formatMoney } from '../../../shared/financial-engine.ts';
import { goalMonthlyBudget, goalMonthlyPlan } from '../../../shared/journey.ts';
import { readPages } from '../../../shared/pagination.ts';
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
      const rows = await readPages((from, to) =>
        db
          .from(entity)
          .select('*')
          .eq(organizationId ? 'organization_id' : 'user_id', organizationId ?? userId)
          .order('id')
          .range(from, to),
      );
      Object.assign(dataset, { [entity]: entitySchemas[entity].array().parse(rows) });
    }),
  );
  if (!organizationId) {
    dataset.goal_events = goalEventSchema
      .array()
      .parse(
        await readPages((from, to) =>
          db
            .from('goal_events')
            .select('id,goal_id,delta,reason,balance_after,created_at')
            .eq('user_id', userId)
            .order('id')
            .range(from, to),
        ),
      );
  }
  const today = civilDate(new Date(), dataset.profile.timezone);
  const budget = goalMonthlyBudget(dataset, today, dataset.profile.timezone);
  const goal =
    dataset.goals.find((item) => item.id === dataset.profile.active_goal_id) ??
    dataset.goals.find((item) => item.saved < item.target) ??
    null;
  const goalPlan = goal
    ? goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0)
    : null;
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
        free: formatMoney(budget.available),
        reserve: formatMoney(personal.reserve),
        debt: formatMoney(personal.debts),
        net_worth: formatMoney(personal.netWorth),
        recorded_surplus: formatMoney(budget.net),
        protected_goals: formatMoney(budget.allocated),
        upcoming_bills: formatMoney(budget.reservedExpenses),
        ...(goal && goalPlan
          ? {
              goal_name: goal.name,
              goal_saved: formatMoney(goal.saved),
              goal_remaining: formatMoney(goalPlan.remaining),
              goal_deadline: goal.deadline
                ? new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(new Date(`${goal.deadline}T12:00:00Z`))
                : 'Sem prazo final',
              goal_monthly_required:
                goalPlan.monthlyTarget === null ? 'Sem prazo final' : formatMoney(goalPlan.monthlyTarget),
              goal_next_contribution: formatMoney(goalPlan.suggested),
            }
          : {}),
        score: String(personal.score.overall ?? 'Dados insuficientes'),
      };
  return {
    dataset,
    metrics,
    plan: organizationId ? [] : weeklyPlan(dataset),
    milestone: organizationId ? null : personal.milestone,
    goal_plan: organizationId ? null : goalPlan,
    focused_goal: organizationId ? null : goal,
    budget: organizationId ? null : budget,
    today,
    scope: organizationId ? 'business' : 'personal',
  };
}
