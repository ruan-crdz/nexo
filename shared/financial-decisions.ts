import type { Transaction } from './domain.ts';
import { formatMoney, shiftDays, sum, validDate } from './financial-engine.ts';

export type CashAssumptions = {
  cash: number;
  confirmed_on: string;
  next_income_date: string;
  protected_amount: number;
  goal_amount: number;
  estimated_income: number;
};
export function spendingAllowance(input: CashAssumptions, transactions: Transaction[], today: string) {
  if (
    !validDate(input.confirmed_on) ||
    !validDate(input.next_income_date) ||
    input.confirmed_on !== today ||
    input.next_income_date < today ||
    input.next_income_date > shiftDays(today, 366) ||
    input.confirmed_on < shiftDays(today, -7)
  )
    throw new Error('Confirme seu dinheiro disponível hoje e o próximo recebimento.');
  for (const value of [input.cash, input.protected_amount, input.goal_amount, input.estimated_income])
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valores inválidos.');
  const changes = transactions.filter(
    (row) =>
      row.status === 'paid' && row.date > input.confirmed_on && row.date <= today && row.account_id === null,
  );
  const unassigned = changes.length > 0;
  const bills = transactions.filter(
    (row) => row.status === 'planned' && row.type === 'expense' && row.date <= input.next_income_date,
  );
  const due = sum(bills.map((row) => row.amount));
  const remaining = sum([input.cash, -input.protected_amount, -input.goal_amount, -due]);
  return {
    allowed: Math.max(0, remaining),
    shortfall: Math.max(0, -remaining),
    bills,
    needs_confirmation: unassigned || input.confirmed_on !== today,
    calculation: [
      `Dinheiro confirmado: ${formatMoney(input.cash)} em ${input.confirmed_on}.`,
      `Contas pendentes até ${input.next_income_date}, inclusive: ${formatMoney(due)}.`,
      `Reserva protegida: ${formatMoney(input.protected_amount)}.`,
      `Separado para metas: ${formatMoney(input.goal_amount)}.`,
      `${formatMoney(input.cash)} - ${formatMoney(due)} - ${formatMoney(input.protected_amount)} - ${formatMoney(input.goal_amount)} = ${formatMoney(remaining)}.`,
      `Renda prevista de ${formatMoney(input.estimated_income)} não foi tratada como dinheiro recebido. Não é uma recomendação de investimento.`,
    ],
  };
}
export function merchantKey(description: string) {
  return description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:pix|compra|pagamento|debito|credito)\b/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function reconciliationMatches(incoming: Transaction, existing: Transaction[]) {
  const words = new Set(
    merchantKey(incoming.description)
      .split(' ')
      .filter((word) => word.length > 2),
  );
  return existing.filter(
    (row) =>
      row.id !== incoming.id &&
      row.type === incoming.type &&
      row.amount === incoming.amount &&
      Math.abs(Date.parse(row.date) - Date.parse(incoming.date)) <= 2 * 86400000 &&
      (!incoming.account_id || !row.account_id || incoming.account_id === row.account_id) &&
      (merchantKey(row.description) === merchantKey(incoming.description) ||
        merchantKey(row.description)
          .split(' ')
          .some((word) => words.has(word))),
  );
}
export type PatternSignal = {
  kind: 'subscription' | 'unusual' | 'possible-duplicate';
  title: string;
  explanation: string;
  records: Transaction[];
};
export function spendingSignals(transactions: Transaction[], today: string): PatternSignal[] {
  const paid = transactions
    .filter((row) => row.type === 'expense' && row.status === 'paid' && row.date <= today)
    .sort((first, second) => first.date.localeCompare(second.date));
  const groups = new Map<string, Transaction[]>();
  for (const row of paid) {
    const key = merchantKey(row.description);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const result: PatternSignal[] = [];
  for (const [key, records] of groups) {
    const last = records.at(-1)!;
    const lastThree = records.slice(-3);
    if (lastThree.length === 3 && new Set(lastThree.map((row) => row.date.slice(0, 7))).size === 3) {
      const gaps = lastThree
        .slice(1)
        .map((row, index) => (Date.parse(row.date) - Date.parse(lastThree[index].date)) / 86400000);
      if (
        gaps.every((gap) => gap >= 25 && gap <= 35) &&
        lastThree.every((row) => Math.abs(row.amount - last.amount) <= Math.round(last.amount * 0.1))
      )
        result.push({
          kind: 'subscription',
          title: last.description,
          explanation:
            'Três cobranças semelhantes em meses consecutivos. É uma sugestão, não uma assinatura confirmada.',
          records: lastThree,
        });
    }
    const previous = records.slice(0, -1).slice(-6);
    if (previous.length >= 3 && last.date >= shiftDays(today, -30)) {
      const ordered = previous.map((row) => row.amount).sort((first, second) => first - second);
      const median = ordered[Math.floor(ordered.length / 2)];
      if (last.amount >= median * 2 && last.amount - median >= 5000)
        result.push({
          kind: 'unusual',
          title: last.description,
          explanation: `Última cobrança ${formatMoney(last.amount)}; mediana de ${previous.length} anteriores ${formatMoney(median)}. Não significa fraude.`,
          records: [...previous, last],
        });
    }
    const duplicate = records.find((row, index) =>
      records.slice(index + 1).some((other) => other.date === row.date && other.amount === row.amount),
    );
    if (duplicate)
      result.push({
        kind: 'possible-duplicate',
        title: key,
        explanation:
          'Mesmo estabelecimento, data e valor. Pode ser uma segunda compra legítima; nada foi apagado.',
        records: records.filter((row) => row.date === duplicate.date && row.amount === duplicate.amount),
      });
  }
  return result;
}
export function invoiceFor(
  transactions: Transaction[],
  accountId: string,
  closingDay: number,
  dueDay: number,
  month: string,
) {
  if (
    !Number.isInteger(closingDay) ||
    closingDay < 1 ||
    closingDay > 31 ||
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  )
    throw new Error('Confira fechamento, vencimento e mês.');
  const cycle = (date: string) => {
    const day = Number(date.slice(8));
    const key = date.slice(0, 7);
    if (day <= closingDay) return key;
    const shifted = new Date(`${key}-01T12:00:00Z`);
    shifted.setUTCMonth(shifted.getUTCMonth() + 1);
    return shifted.toISOString().slice(0, 7);
  };
  const records = transactions.filter(
    (row) => row.account_id === accountId && row.type === 'expense' && cycle(row.date) === month,
  );
  const total = sum(records.map((row) => row.amount));
  const dueBase = new Date(`${month}-01T12:00:00Z`);
  if (dueDay <= closingDay) dueBase.setUTCMonth(dueBase.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(dueBase.getUTCFullYear(), dueBase.getUTCMonth() + 1, 0)).getUTCDate();
  dueBase.setUTCDate(Math.min(dueDay, lastDay));
  return { total, due: dueBase.toISOString().slice(0, 10), records };
}
