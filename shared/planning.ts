import { v5 as uuid } from 'uuid';
import type { Budget, Dataset, Goal, RecurringRule, Transaction } from './domain.ts';
import { applyRate, formatMoney, shiftDays, shiftMonths, sum } from './financial-engine.ts';
import { goalJourney } from './journey.ts';

const namespace = '9667e0ce-412e-47d9-a212-91d1d616f74b';
export function recurringOccurrenceId(ruleId: string, date: string) {
  return uuid(`${ruleId}:${date}`, namespace);
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function recurringTransactions(
  rules: RecurringRule[],
  existing: Transaction[],
  today: string,
  generated: string[] = [],
) {
  const known = new Set([...existing.map((transaction) => transaction.id), ...generated]);
  const until = shiftDays(today, 30);
  const result: Transaction[] = [];
  for (const rule of rules.filter((item) => item.active)) {
    const distance =
      (Number(today.slice(0, 4)) - Number(rule.start_date.slice(0, 4))) * 12 +
      Number(today.slice(5, 7)) -
      Number(rule.start_date.slice(5, 7));
    const frequency = rule.frequency ?? 'monthly';
    const period =
      frequency === 'weekly'
        ? Math.floor((Date.parse(today) - Date.parse(rule.start_date)) / 604800000)
        : frequency === 'yearly'
          ? Math.floor(distance / 12)
          : distance;
    for (
      let offset = Math.max(0, period - 1);
      offset <= Math.max(0, period) + (frequency === 'weekly' ? 6 : 2);
      offset++
    ) {
      const date =
        frequency === 'weekly'
          ? shiftDays(rule.start_date, offset * 7)
          : shiftMonths(rule.start_date, offset * (frequency === 'yearly' ? 12 : 1));
      if (date > until || (rule.end_date && date > rule.end_date)) continue;
      let amount = rule.amount;
      let anniversaries = Math.max(0, Number(date.slice(0, 4)) - Number(rule.start_date.slice(0, 4)));
      if (date < shiftMonths(rule.start_date, anniversaries * 12))
        anniversaries = Math.max(0, anniversaries - 1);
      for (let anniversary = 0; anniversary < anniversaries; anniversary++)
        amount = sum([amount, applyRate(amount, rule.annual_adjustment_bps ?? 0)]);
      const id = recurringOccurrenceId(rule.id, date);
      if (known.has(id)) continue;
      result.push({
        id,
        date,
        description: rule.description,
        amount,
        category: rule.category,
        type: rule.type ?? 'expense',
        status: 'planned',
        source: 'manual',
        account_id: null,
      });
      known.add(id);
    }
  }
  return result;
}

export function budgetUsage(budgets: Budget[], transactions: Transaction[], today: string) {
  return budgets
    .filter((budget) => budget.month === today.slice(0, 7))
    .map((budget) => {
      const records = transactions.filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.status === 'paid' &&
          transaction.date <= today &&
          transaction.date.startsWith(budget.month) &&
          transaction.category === budget.category,
      );
      const spent = sum(records.map((transaction) => transaction.amount));
      return { ...budget, spent, remaining: budget.limit_amount - spent, records };
    });
}

export function weeklySummary(transactions: Transaction[], today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const end = shiftDays(today, -(weekday === 0 ? 6 : weekday - 1) - 1);
  const start = shiftDays(end, -6);
  const records = transactions.filter(
    (transaction) => transaction.status === 'paid' && transaction.date >= start && transaction.date <= end,
  );
  const income = sum(
    records.filter((transaction) => transaction.type === 'income').map((transaction) => transaction.amount),
  );
  const expenses = sum(
    records.filter((transaction) => transaction.type === 'expense').map((transaction) => transaction.amount),
  );
  return { start, end, income, expenses, net: income - expenses, records };
}

export type VerifiedReply = { answer: string; calculation: string[]; records: Transaction[]; goals: Goal[] };
export function notificationCandidates(
  data: Pick<Dataset, 'profile' | 'transactions' | 'budgets'> &
    Partial<Pick<Dataset, 'goals' | 'habit_events'>>,
  today: string,
) {
  const candidates: { key: string; kind: 'bill' | 'budget' | 'weekly' | 'journey'; text: string }[] = [];
  if (!data.profile.whatsapp_notifications) return candidates;
  const focus =
    data.goals?.find((goal) => goal.id === data.profile.active_goal_id) ??
    data.goals?.find((goal) => goal.saved < goal.target) ??
    data.goals?.[0];
  const journey = focus
    ? goalJourney(focus, focus.weekly_amount, Math.max(focus.high_water, focus.saved))
    : null;
  const paused = !!data.profile.journey_pause_until && data.profile.journey_pause_until >= today;
  if (data.profile.reminders_enabled) {
    for (const record of data.transactions.filter(
      (transaction) =>
        transaction.type === 'expense' &&
        transaction.status === 'planned' &&
        transaction.date <= shiftDays(today, 3),
    ))
      candidates.push({
        key: `bill:${record.id}:${record.date}`,
        kind: 'bill',
        text: `Lembrete: você anotou ${record.description}, de ${formatMoney(record.amount)}, com vencimento em ${formatDate(record.date)}. Ela ainda não está marcada como paga; confira no app antes de pagar.`,
      });
    for (const budget of budgetUsage(data.budgets, data.transactions, today).filter(
      (item) => item.remaining < 0,
    ))
      candidates.push({
        key: `budget:${budget.id}:${budget.month}`,
        kind: 'budget',
        text: `Seu limite de ${budget.category} passou ${formatMoney(-budget.remaining)}. Você anotou ${formatMoney(budget.spent)} para um limite de ${formatMoney(budget.limit_amount)}. Confira no app.`,
      });
  }
  if (data.profile.weekly_digest) {
    const weekly = weeklySummary(data.transactions, today);
    if (weekly.records.length || focus)
      candidates.push({
        key: `weekly:${weekly.start}`,
        kind: 'weekly',
        text: `Resumo da semana, de ${formatDate(weekly.start)} a ${formatDate(weekly.end)}: entrou ${formatMoney(weekly.income)}, saiu ${formatMoney(weekly.expenses)}. Diferença nas anotações: ${formatMoney(weekly.net)}; não é saldo bancário.${focus && journey ? ` Caixinha ${focus.name}: ${formatMoney(focus.saved)} de ${formatMoney(focus.target)}. ${paused ? 'Seus lembretes estão pausados; seu progresso continua.' : journey.message}` : ''}`,
      });
  }
  if (data.profile.journey_reminders && !paused && focus && journey && journey.remaining > 0) {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const start = shiftDays(today, -((weekday + 6) % 7));
    const checked = (data.habit_events ?? []).some(
      (event) =>
        event.kind === 'checkin' &&
        event.day >= (data.profile.checkin_frequency === 'weekly' ? start : today) &&
        event.day <= today,
    );
    if (!checked)
      candidates.push({
        key: `journey:${focus.id}:${data.profile.checkin_frequency === 'weekly' ? start : today}`,
        kind: 'journey',
        text: `Se quiser, faça seu check-in da Caixinha ${focus.name}. Você informou ${formatMoney(focus.saved)} guardados. ${journey.message} É um convite, não uma cobrança; não precisa guardar dinheiro hoje.`,
      });
  }
  return candidates;
}
export function isVerifiedQuestion(question: string) {
  const normalized = question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return (
    /^(?:por que|porque|pq)\s+(?:eu\s+)?gastei\s+mais[?!.\s]*$/.test(normalized) ||
    /^(?:quanto falta|como esta).*(?:meta|minhas metas|caixinha|minhas caixinhas)/.test(normalized) ||
    /^(?:quais|que|quanto).*(?:contas|vencem|vencer)/.test(normalized)
  );
}
export function verifiedReply(
  data: Pick<Dataset, 'transactions' | 'goals'>,
  question: string,
  today: string,
): VerifiedReply | null {
  if (!isVerifiedQuestion(question)) return null;
  const normalized = question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/meta|caixinha/.test(normalized)) {
    const goals = data.goals;
    return {
      answer: goals.length
        ? 'Veja quanto falta para chegar a cada Caixinha:'
        : 'Você ainda não tem Caixinhas. Pode criar uma no app quando quiser.',
      calculation: goals.map((goal) =>
        goal.saved >= goal.target
          ? `${goal.name}: alvo alcançado. Você informou ${formatMoney(goal.saved)} guardados.`
          : `${goal.name}: faltam ${formatMoney(goal.target - goal.saved)}. Guardado: ${formatMoney(goal.saved)} de ${formatMoney(goal.target)}.`,
      ),
      records: [],
      goals,
    };
  }
  if (/contas|vencem|vencer/.test(normalized)) {
    const records = data.transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.status === 'planned' &&
          transaction.date <= shiftDays(today, 30),
      )
      .sort((first, second) => first.date.localeCompare(second.date));
    return {
      answer: records.length
        ? 'Estas são as contas pendentes anotadas para os próximos 30 dias, incluindo as que já venceram:'
        : 'Não encontrei contas pendentes anotadas para os próximos 30 dias.',
      calculation: [
        `${records.length} ${records.length === 1 ? 'conta' : 'contas'} pendente${records.length === 1 ? '' : 's'}, somando ${formatMoney(sum(records.map((transaction) => transaction.amount)))}. Ainda não foram contadas como gastos pagos.`,
      ],
      records,
      goals: [],
    };
  }
  const previousEnd = shiftMonths(today, -1);
  const currentStart = `${today.slice(0, 7)}-01`;
  const previousStart = `${previousEnd.slice(0, 7)}-01`;
  const records = data.transactions.filter(
    (transaction) =>
      transaction.type === 'expense' &&
      transaction.status === 'paid' &&
      ((transaction.date >= currentStart && transaction.date <= today) ||
        (transaction.date >= previousStart && transaction.date <= previousEnd)),
  );
  const current = sum(
    records
      .filter((transaction) => transaction.date >= currentStart)
      .map((transaction) => transaction.amount),
  );
  const previous = sum(
    records.filter((transaction) => transaction.date < currentStart).map((transaction) => transaction.amount),
  );
  const changes = new Map<string, number>();
  for (const transaction of records)
    changes.set(
      transaction.category,
      (changes.get(transaction.category) ?? 0) +
        (transaction.date >= currentStart ? transaction.amount : -transaction.amount),
    );
  return {
    answer:
      previous === 0
        ? 'Ainda não há gastos pagos no mês passado para comparar com este.'
        : current > previous
          ? `Você anotou ${formatMoney(current - previous)} a mais neste mês, comparando o mesmo período.`
          : `Neste mês, você anotou ${formatMoney(Math.abs(current - previous))} a menos que no mesmo período do mês passado.`,
    calculation: [
      `Este mês, até ${formatDate(today)}: ${formatMoney(current)}.`,
      `No mesmo período do mês passado (${formatDate(previousStart)} a ${formatDate(previousEnd)}): ${formatMoney(previous)}.`,
      `Variação por categoria:`,
      ...[...changes.entries()]
        .sort((first, second) => second[1] - first[1])
        .map(([category, amount]) =>
          amount > 0
            ? `${category}: aumentou ${formatMoney(amount)}.`
            : amount < 0
              ? `${category}: diminuiu ${formatMoney(Math.abs(amount))}.`
              : `${category}: sem variação.`,
        ),
    ],
    records,
    goals: [],
  };
}
