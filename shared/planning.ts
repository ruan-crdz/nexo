import { v5 as uuid } from 'uuid';
import type { Budget, Dataset, Goal, RecurringRule, Transaction } from './domain.ts';
import { formatMoney, shiftDays, shiftMonths, sum } from './financial-engine.ts';

const namespace = '9667e0ce-412e-47d9-a212-91d1d616f74b';
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
    for (let offset = Math.max(0, distance - 1); offset <= Math.max(0, distance) + 2; offset++) {
      const date = shiftMonths(rule.start_date, offset);
      if (date > until) continue;
      const id = uuid(`${rule.id}:${date}`, namespace);
      if (known.has(id)) continue;
      result.push({
        id,
        date,
        description: rule.description,
        amount: rule.amount,
        category: rule.category,
        type: 'expense',
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
  data: Pick<Dataset, 'profile' | 'transactions' | 'budgets'>,
  today: string,
) {
  const candidates: { key: string; kind: 'bill' | 'budget' | 'weekly'; text: string }[] = [];
  if (!data.profile.whatsapp_notifications) return candidates;
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
        text: `Conta ainda não marcada como paga: ${record.description}, ${formatMoney(record.amount)}, vencimento ${record.date}. Confira no app antes de pagar.`,
      });
    for (const budget of budgetUsage(data.budgets, data.transactions, today).filter(
      (item) => item.remaining < 0,
    ))
      candidates.push({
        key: `budget:${budget.id}:${budget.month}`,
        kind: 'budget',
        text: `${budget.category}: ${formatMoney(budget.spent)} anotados para um limite de ${formatMoney(budget.limit_amount)}. Excesso de ${formatMoney(-budget.remaining)}.`,
      });
  }
  if (data.profile.weekly_digest) {
    const weekly = weeklySummary(data.transactions, today);
    if (weekly.records.length)
      candidates.push({
        key: `weekly:${weekly.start}`,
        kind: 'weekly',
        text: `Resumo de ${weekly.start} a ${weekly.end}: entrou ${formatMoney(weekly.income)}, saiu ${formatMoney(weekly.expenses)}, diferença ${formatMoney(weekly.net)}. Valores das anotações, não saldo bancário.`,
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
    /^(?:quanto falta|como esta).*(?:meta|minhas metas)/.test(normalized) ||
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
  if (/meta/.test(normalized)) {
    const goals = data.goals;
    return {
      answer: goals.length
        ? 'Veja quanto falta para suas metas, conforme os valores que você informou.'
        : 'Você ainda não cadastrou uma meta.',
      calculation: goals.map((goal) =>
        goal.saved >= goal.target
          ? `${goal.name}: meta atingida. Objetivo ${formatMoney(goal.target)}; guardado ${formatMoney(goal.saved)}; falta ${formatMoney(0)}.`
          : `${goal.name}: ${formatMoney(goal.target)} - ${formatMoney(goal.saved)} = ${formatMoney(goal.target - goal.saved)} para chegar à meta.`,
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
        ? 'Estas contas ainda não foram marcadas como pagas, incluindo atrasadas e vencimentos dos próximos 30 dias.'
        : 'Não há contas pendentes anotadas para os próximos 30 dias.',
      calculation: [
        `${records.length} contas = ${formatMoney(sum(records.map((transaction) => transaction.amount)))}. Não entram no total de gastos pagos.`,
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
        ? 'Não há gastos pagos no período anterior para uma comparação completa.'
        : current > previous
          ? `Você anotou ${formatMoney(current - previous)} a mais no período comparável.`
          : `Seus gastos anotados não aumentaram: a diferença foi ${formatMoney(current - previous)}.`,
    calculation: [
      `${currentStart} a ${today}: ${formatMoney(current)}.`,
      `${previousStart} a ${previousEnd}: ${formatMoney(previous)}.`,
      `${formatMoney(current)} - ${formatMoney(previous)} = ${formatMoney(current - previous)}.`,
      ...[...changes.entries()]
        .sort((first, second) => second[1] - first[1])
        .map(([category, amount]) => `${category}: diferença de ${formatMoney(amount)}.`),
    ],
    records,
    goals: [],
  };
}
