import { budgetSchema, goalEventSchema, goalSchema, profileSchema, transactionSchema } from '../../../shared/domain.ts';
import { formatMoney, money, shiftDays, sum, validDate } from '../../../shared/financial-engine.ts';
import type { Transaction } from '../../../shared/domain.ts';
import { goalMonthlyBudget } from '../../../shared/journey.ts';
import { budgetUsage } from '../../../shared/planning.ts';
import { readPages } from '../../../shared/pagination.ts';
import { admin, HttpError } from './http.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function whatsappMoneySnapshot(userId: string, today: string, client?: SupabaseClient) {
  const db = client ?? admin();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const [transactions, goals, events, profile, budgets] = await Promise.all([
      readPages((from, to) =>
        db
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
      readPages((from, to) =>
        db
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
      readPages((from, to) =>
        db
          .from('goal_events')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
      db
        .from('profiles')
        .select('fixed_expenses,timezone')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single(),
      readPages((from, to) =>
        db
          .from('budgets')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
    ]);
    if (profile.error) throw new HttpError(503, 'Não consegui conferir o resumo atual do app.');
    const settings = profileSchema.pick({ fixed_expenses: true, timezone: true }).parse(profile.data);
    const parsedTransactions = transactionSchema.array().parse(transactions);
    const parsedBudgets = budgetSchema.array().parse(budgets);
    const budget = goalMonthlyBudget(
      {
        transactions: parsedTransactions,
        goals: goalSchema.array().parse(goals),
        goal_events: goalEventSchema.array().parse(events),
        profile: settings,
      },
      today,
      settings.timezone,
    );
    return {
      month: today.slice(0, 7),
      today,
      income: budget.income,
      expenses: budget.expenses,
      recorded_surplus: budget.net,
      protected_goals: budget.allocated,
      reserved_expenses: budget.reservedExpenses,
      free_to_plan: budget.available,
      budget_usage: budgetUsage(parsedBudgets, parsedTransactions, today).map((item) => ({
        category: item.category,
        limit: item.limit_amount,
        spent: item.spent,
        remaining: item.remaining,
      })),
      bank_balance_confirmed: false,
      explanation:
        'Mesmo cálculo da Home do app. Valores dos registros, não saldo bancário. Não exige conta cadastrada e não conta renda prevista como recebida.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function whatsappMoneyReply(snapshot: Awaited<ReturnType<typeof whatsappMoneySnapshot>>) {
  const result =
    snapshot.recorded_surplus >= 0
      ? `Sobrou nos movimentos deste mês: ${formatMoney(snapshot.recorded_surplus)}.`
      : `Faltou nos movimentos deste mês: ${formatMoney(-snapshot.recorded_surplus)}.`;
  return `${result}\nLivre para planejar: ${formatMoney(snapshot.free_to_plan)} (após metas e despesas reservadas).\nÉ o resumo do Nexo, não saldo bancário.`;
}

export type WhatsAppMoneySnapshot = Awaited<ReturnType<typeof whatsappMoneySnapshot>>;

export type WhatsAppBudgetOverage = { category: string; limit: number; spent: number; overage: number };

export async function whatsappBudgetOverages(
  userId: string,
  today: string,
  categories: string[],
  client?: SupabaseClient,
): Promise<WhatsAppBudgetOverage[]> {
  const focused = [...new Set(categories.filter(Boolean))];
  if (!focused.length) return [];
  const db = client ?? admin();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [budgets, transactions] = await Promise.all([
    readPages((from, to) =>
      db
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('month', today.slice(0, 7))
        .in('category', focused)
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) =>
      db
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('status', 'paid')
        .gte('date', monthStart)
        .lte('date', today)
        .in('category', focused)
        .order('id')
        .range(from, to),
    ),
  ]);
  const usage = budgetUsage(
    budgetSchema.array().parse(budgets),
    transactionSchema.array().parse(transactions),
    today,
  );
  return usage
    .filter((item) => item.remaining < 0)
    .map((item) => ({
      category: item.category,
      limit: item.limit_amount,
      spent: item.spent,
      overage: -item.remaining,
    }));
}

export async function replyWithMoneySnapshot(
  reply: string,
  userId: string,
  today: string,
  current?: WhatsAppMoneySnapshot | null,
) {
  try {
    const snapshot = current === undefined ? await whatsappMoneySnapshot(userId, today) : current;
    if (!snapshot) throw new HttpError(503, 'Resumo indisponível.');
    return `${whatsappMoneyReply(snapshot)}\n\n${reply}`;
  } catch {
    console.error(JSON.stringify({ event: 'whatsapp_money_summary_failed' }));
    return `${reply}\n\nO pedido foi salvo, mas não consegui consultar quanto sobrou agora. Confira o resumo do app antes de gastar; não vou chutar esse valor.`;
  }
}

export function compareReportedMoney(
  snapshot: Awaited<ReturnType<typeof whatsappMoneySnapshot>>,
  reported: number,
) {
  money(reported);
  return {
    reported_amount: reported,
    reported_source: 'informado pela pessoa, não consultado no banco',
    recorded_surplus: snapshot.recorded_surplus,
    free_to_plan: snapshot.free_to_plan,
    difference_from_recorded_surplus: sum([snapshot.recorded_surplus, -reported]),
    difference_from_free_to_plan: sum([snapshot.free_to_plan, -reported]),
    nothing_saved: true,
    adjustment_requires_explicit_authorization: true,
    warning:
      'Diferença numérica não identifica a causa. Não crie uma despesa sem autorização e não confunda alocação em metas com gasto.',
  };
}

export function budgetUntilDate(
  input: {
    cash: number;
    today: string;
    until: string;
    emergency_reserve: number;
    essentials_covered: boolean | null;
  },
  transactions: Transaction[],
) {
  money(input.cash);
  money(input.emergency_reserve);
  if (
    input.cash < 0 ||
    input.emergency_reserve < 0 ||
    !validDate(input.today) ||
    !validDate(input.until) ||
    input.until < input.today ||
    input.until > shiftDays(input.today, 366)
  )
    throw new HttpError(400, 'Informe uma data entre hoje e os próximos 366 dias.');
  const days =
    Math.round((Date.parse(`${input.until}T12:00:00Z`) - Date.parse(`${input.today}T12:00:00Z`)) / 86400000) +
    1;
  const bills = transactions.filter(
    (row) => row.status === 'planned' && row.type === 'expense' && row.date <= input.until,
  );
  const reserved_bills = sum(bills.map((row) => row.amount));
  const remaining = sum([input.cash, -input.emergency_reserve, -reserved_bills]);
  const available = Math.max(0, remaining);
  return {
    today: input.today,
    until: input.until,
    days_including_today: days,
    reported_cash: input.cash,
    reserved_bills,
    emergency_reserve: input.emergency_reserve,
    available,
    shortfall: Math.max(0, -remaining),
    daily_ceiling: Math.floor(available / days),
    essentials_covered: input.essentials_covered,
    bills: bills.slice(0, 20),
    total_bills: bills.length,
    nothing_saved: true,
    warning:
      'Teto diário é limite, não recomendação de gastar. Não considera recebimento futuro. Se necessidades básicas já estão garantidas, preserve a reserva e não repita sugestões de comida/transporte; confira contas ainda pendentes.',
  };
}
