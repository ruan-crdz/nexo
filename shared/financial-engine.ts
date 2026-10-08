/** All monetary inputs/outputs are safe integer cents; rates are integer basis points. */
export const ENGINE_VERSION = '1.0.0';
export const MAX_MONEY = 9_000_000_000_000;

export function money(value: number): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MONEY)
    throw new RangeError('Valor monetário fora do limite.');
  return value;
}
function nonnegative(value: number): number {
  if (money(value) < 0) throw new RangeError('O valor não pode ser negativo.');
  return value;
}
function integer(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError('Parâmetro fora do limite.');
  return value;
}
export function sum(values: number[]): number {
  return values.reduce((a, b) => money(a + money(b)), 0);
}
export function divideRound(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new RangeError('Divisor inválido.');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator * sign;
  return money(Number(sign * ((absolute + denominator / 2n) / denominator)));
}
export function applyRate(cents: number, basisPoints: number): number {
  money(cents);
  integer(basisPoints, -10_000, 1_000_000);
  return divideRound(BigInt(cents) * BigInt(basisPoints), 10_000n);
}
export function parseMoney(input: string): number {
  const cleaned = input
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(/\s/g, '');
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(cleaned))
    throw new Error('Use um valor como 1.250,50.');
  const negative = cleaned.startsWith('-');
  const [whole, fraction = ''] = cleaned.replace('-', '').replace(/\./g, '').split(',');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return money(Number(negative ? -result : result));
}
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(money(cents) / 100);
}
export function civilDate(instant = new Date(), timezone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function shiftDays(date: string, days: number): string {
  if (!validDate(date)) throw new Error('Data inválida.');
  integer(days, -365_000, 365_000);
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shiftMonths(date: string, months: number): string {
  if (!validDate(date)) throw new Error('Data inválida.');
  integer(months, -1200, 1200);
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}
export function installments(total: number, count: number): number[] {
  nonnegative(total);
  integer(count, 1, 600);
  const base = Math.floor(total / count),
    remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
export function compound(
  initial: number,
  monthlyContribution: number,
  rateBps: number,
  months: number,
): { month: number; balance: number; contributed: number; interest: number }[] {
  nonnegative(initial);
  nonnegative(monthlyContribution);
  integer(rateBps, -10_000, 100_000);
  integer(months, 0, 600);
  let balance = initial,
    contributed = initial;
  const result = [{ month: 0, balance, contributed, interest: 0 }];
  for (let month = 1; month <= months; month++) {
    balance = sum([balance, applyRate(balance, rateBps), monthlyContribution]);
    contributed = sum([contributed, monthlyContribution]);
    result.push({ month, balance, contributed, interest: money(balance - contributed) });
  }
  return result;
}
export function inflationAdjusted(nominal: number, annualInflationBps: number, years: number): number {
  nonnegative(nominal);
  integer(annualInflationBps, 0, 100_000);
  integer(years, 0, 50);
  return divideRound(
    BigInt(nominal) * 10_000n ** BigInt(years),
    BigInt(10_000 + annualInflationBps) ** BigInt(years),
  );
}
export function goalPlan(target: number, saved: number, months: number, availableMonthly: number) {
  nonnegative(target);
  nonnegative(saved);
  nonnegative(availableMonthly);
  integer(months, 0, 600);
  const remaining = Math.max(0, target - saved);
  const required = months > 0 ? Math.ceil(remaining / months) : remaining;
  return {
    remaining,
    required,
    progress: target === 0 ? 100 : Math.min(100, (saved / target) * 100),
    monthsToGoal:
      remaining === 0 ? 0 : availableMonthly === 0 ? null : Math.ceil(remaining / availableMonthly),
    feasible: remaining === 0 || (months > 0 && availableMonthly >= required),
  };
}
export function savingsRate(income: number, expenses: number): number | null {
  nonnegative(income);
  nonnegative(expenses);
  return income === 0 ? null : ((income - expenses) / income) * 100;
}
export function runway(cash: number, revenue: number, costs: number): number | null {
  nonnegative(cash);
  nonnegative(revenue);
  nonnegative(costs);
  return costs <= revenue ? null : cash / (costs - revenue);
}
export function breakEven(fixedCosts: number, variableCostBps: number): number | null {
  nonnegative(fixedCosts);
  integer(variableCostBps, 0, 10_000);
  return variableCostBps === 10_000
    ? null
    : money(
        Number(
          (BigInt(fixedCosts) * 10_000n + BigInt(9999 - variableCostBps)) / BigInt(10_000 - variableCostBps),
        ),
      );
}
export function employeeCost(salary: number, benefits: number, chargesBps: number, other = 0) {
  [salary, benefits, other].forEach(nonnegative);
  integer(chargesBps, 0, 100_000);
  const charges = applyRate(salary, chargesBps),
    monthly = sum([salary, benefits, charges, other]);
  return { salary, benefits, charges, other, monthly, annual: money(monthly * 12) };
}
export function businessScenario(input: {
  cash: number;
  revenue: number;
  fixedCosts: number;
  variableCostBps: number;
  newMonthlyCost: number;
  revenueChangeBps: number;
  months: number;
}) {
  const { cash, revenue, fixedCosts, variableCostBps, newMonthlyCost, revenueChangeBps, months } = input;
  [cash, revenue, fixedCosts, newMonthlyCost].forEach(nonnegative);
  integer(variableCostBps, 0, 10_000);
  integer(revenueChangeBps, -10_000, 100_000);
  integer(months, 1, 120);
  const newRevenue = sum([revenue, applyRate(revenue, revenueChangeBps)]);
  const oldCosts = sum([fixedCosts, applyRate(revenue, variableCostBps)]);
  const newCosts = sum([fixedCosts, newMonthlyCost, applyRate(newRevenue, variableCostBps)]);
  const result = newRevenue - newCosts;
  return {
    revenue: newRevenue,
    costs: newCosts,
    result,
    margin: newRevenue === 0 ? null : (result / newRevenue) * 100,
    burnRate: Math.max(0, -result),
    runwayBefore: runway(cash, revenue, oldCosts),
    runwayAfter: runway(cash, newRevenue, newCosts),
    breakEven: breakEven(fixedCosts + newMonthlyCost, variableCostBps),
    additionalRevenueNeeded: Math.max(
      0,
      (breakEven(fixedCosts + newMonthlyCost, variableCostBps) ?? 0) - newRevenue,
    ),
    projection: Array.from({ length: months + 1 }, (_, month) => ({
      month,
      balance: money(cash + result * month),
    })),
  };
}
export function unitEconomics(input: {
  marketing: number;
  newCustomers: number;
  revenue: number;
  customers: number;
  grossMarginBps: number;
  churnBps: number;
}) {
  const { marketing, newCustomers, revenue, customers, grossMarginBps, churnBps } = input;
  [marketing, revenue].forEach(nonnegative);
  integer(newCustomers, 0, 1e9);
  integer(customers, 0, 1e9);
  integer(grossMarginBps, 0, 10_000);
  integer(churnBps, 0, 10_000);
  const cac = newCustomers ? divideRound(BigInt(marketing), BigInt(newCustomers)) : null;
  const arpu = customers ? divideRound(BigInt(revenue), BigInt(customers)) : null;
  const monthlyMargin = arpu === null ? null : applyRate(arpu, grossMarginBps);
  return {
    cac,
    arpu,
    ltv:
      monthlyMargin !== null && churnBps > 0
        ? divideRound(BigInt(monthlyMargin) * 10_000n, BigInt(churnBps))
        : null,
    paybackMonths: cac !== null && monthlyMargin ? cac / monthlyMargin : null,
    arr: money(revenue * 12),
  };
}
export function canSpend(input: {
  amount: number;
  cash: number;
  expectedIncome: number;
  upcomingBills: number;
  protectedReserve: number;
  goalAllocation: number;
  monthlySavings: number;
}) {
  Object.values(input).forEach(nonnegative);
  const free = sum([
    input.cash,
    input.expectedIncome,
    -input.upcomingBills,
    -input.protectedReserve,
    -input.goalAllocation,
  ]);
  const after = money(free - input.amount);
  return {
    free,
    after,
    affordable: after >= 0,
    goalDelayDays:
      input.amount === 0
        ? 0
        : input.monthlySavings > 0
          ? Number(
              (BigInt(input.amount) * 30n + BigInt(input.monthlySavings) - 1n) / BigInt(input.monthlySavings),
            )
          : null,
    assumptions: [
      'Somente renda futura informada.',
      'Reserva e aportes planejados são protegidos.',
      'Estimativa de prazo usa mês de 30 dias e não considera retorno.',
    ],
  };
}
export interface DebtInput {
  id: string;
  balance: number;
  rateBps: number;
  minimum: number;
}
export function debtPayoff(
  debts: DebtInput[],
  monthlyBudget: number,
  strategy: 'avalanche' | 'snowball',
  maxMonths = 600,
) {
  nonnegative(monthlyBudget);
  integer(maxMonths, 1, 600);
  if (new Set(debts.map((d) => d.id)).size !== debts.length) throw new Error('Dívida duplicada.');
  debts.forEach((d) => {
    nonnegative(d.balance);
    nonnegative(d.minimum);
    integer(d.rateBps, 0, 100_000);
  });
  const current = debts.map((d) => ({ ...d }));
  const schedule: { month: number; paid: number; interest: number; balance: number }[] = [];
  let interestTotal = 0;
  if (
    sum(
      current
        .filter((d) => d.balance > 0)
        .map((d) => Math.min(d.minimum, d.balance + applyRate(d.balance, d.rateBps))),
    ) > monthlyBudget
  )
    return {
      possible: false,
      reason: 'Orçamento menor que as parcelas mínimas.',
      months: null,
      interestTotal,
      schedule,
    };
  for (let month = 1; month <= maxMonths && current.some((d) => d.balance > 0); month++) {
    let remaining = monthlyBudget,
      monthlyInterest = 0;
    for (const debt of current) {
      const interest = applyRate(debt.balance, debt.rateBps);
      monthlyInterest = sum([monthlyInterest, interest]);
      debt.balance = sum([debt.balance, interest]);
      const payment = Math.min(debt.balance, debt.minimum, remaining);
      debt.balance -= payment;
      remaining -= payment;
    }
    const ordered = current
      .filter((d) => d.balance > 0)
      .sort((a, b) =>
        strategy === 'avalanche'
          ? b.rateBps - a.rateBps || a.balance - b.balance
          : a.balance - b.balance || b.rateBps - a.rateBps,
      );
    for (const debt of ordered) {
      const payment = Math.min(debt.balance, remaining);
      debt.balance -= payment;
      remaining -= payment;
    }
    interestTotal = sum([interestTotal, monthlyInterest]);
    schedule.push({
      month,
      paid: monthlyBudget - remaining,
      interest: monthlyInterest,
      balance: sum(current.map((d) => d.balance)),
    });
    if (monthlyInterest >= monthlyBudget && current.some((d) => d.balance > 0))
      return {
        possible: false,
        reason: 'Pagamento não cobre os juros.',
        months: null,
        interestTotal,
        schedule,
      };
  }
  const possible = current.every((d) => d.balance === 0);
  return {
    possible,
    reason: possible ? null : 'Prazo excede o horizonte da simulação.',
    months: possible ? schedule.length : null,
    interestTotal,
    schedule,
  };
}
export function amortization(
  principal: number,
  rateBps: number,
  months: number,
  method: 'price' | 'sac' = 'price',
) {
  nonnegative(principal);
  integer(rateBps, 0, 100_000);
  integer(months, 1, 600);
  const growth = BigInt(10_000 + rateBps) ** BigInt(months),
    base = 10_000n ** BigInt(months);
  const payment =
    rateBps === 0
      ? Math.ceil(principal / months)
      : Number(
          (BigInt(principal) * BigInt(rateBps) * growth + 10_000n * (growth - base) - 1n) /
            (10_000n * (growth - base)),
        );
  money(payment);
  let balance = principal;
  const parts = installments(principal, months);
  return Array.from({ length: months }, (_, i) => {
    const interest = applyRate(balance, rateBps);
    const amortized =
      i === months - 1
        ? balance
        : method === 'sac'
          ? Math.min(balance, parts[i])
          : Math.min(balance, Math.max(0, payment - interest));
    balance -= amortized;
    return { installment: i + 1, payment: sum([amortized, interest]), interest, amortized, balance };
  });
}
export function adaptiveReserve(
  expenses: number,
  variableIncome: boolean,
  dependents: number,
  insured: boolean,
) {
  nonnegative(expenses);
  integer(dependents, 0, 30);
  const months = Math.min(12, 3 + (variableIncome ? 3 : 0) + Math.min(3, dependents) + (insured ? 0 : 1));
  return {
    minimum: expenses,
    comfortable: money(expenses * months),
    robust: money(expenses * (months + 3)),
    months,
    rationale:
      'Heurística Nexo: estabilidade da renda, dependentes e proteção informada; ajuste ao seu contexto.',
  };
}
export function nexoScore(input: {
  income: number;
  expenses: number;
  liquid: number;
  debt: number;
  debtPayment: number;
  reserve: number;
  recordedDays: number;
  daysInPeriod: number;
  previousNetWorth: number | null;
  netWorth: number;
  variableIncome: boolean;
  goalProgress: number;
}) {
  [input.income, input.expenses, input.liquid, input.debt, input.debtPayment, input.reserve].forEach(
    nonnegative,
  );
  money(input.netWorth);
  if (input.previousNetWorth !== null) money(input.previousNetWorth);
  integer(input.daysInPeriod, 1, 366);
  integer(input.recordedDays, 0, input.daysInPeriod);
  if (!Number.isFinite(input.goalProgress) || input.goalProgress < 0 || input.goalProgress > 100)
    throw new RangeError('Progresso inválido.');
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const dimensions = [
    {
      name: 'Liquidez',
      weight: 15,
      value: input.expenses ? clamp((input.liquid / input.expenses) * 100) : null,
      action: 'Construa um colchão para as próximas contas.',
    },
    {
      name: 'Dívidas',
      weight: 15,
      value: input.income ? clamp(100 - (input.debt / (input.income * 12)) * 100) : null,
      action: 'Liste saldos e taxas antes de escolher a ordem de pagamento.',
    },
    {
      name: 'Comprometimento',
      weight: 10,
      value: input.income ? clamp(100 - (input.debtPayment / input.income) * 200) : null,
      action: 'Revise parcelas que ocupam sua renda.',
    },
    {
      name: 'Reserva',
      weight: 20,
      value: input.expenses
        ? clamp((input.reserve / (input.expenses * (input.variableIncome ? 6 : 3))) * 100)
        : null,
      action: 'Defina um aporte possível para sua reserva.',
    },
    {
      name: 'Consistência',
      weight: 5,
      value: clamp((input.recordedDays / input.daysInPeriod) * 100),
      action: 'Confira se os registros do período estão completos.',
    },
    {
      name: 'Evolução',
      weight: 10,
      value:
        input.previousNetWorth === null
          ? null
          : clamp(
              50 +
                ((input.netWorth - input.previousNetWorth) /
                  Math.max(Math.abs(input.previousNetWorth), 100_000)) *
                  100,
            ),
      action: 'Compare seu patrimônio com o período anterior.',
    },
    {
      name: 'Poupança',
      weight: 15,
      value: input.income ? clamp(((input.income - input.expenses) / input.income) * 500) : null,
      action: 'Procure um pequeno espaço entre renda e gastos.',
    },
    {
      name: 'Caixinhas',
      weight: 10,
      value: input.goalProgress,
      action: 'Revise o prazo e o valor da sua prioridade.',
    },
  ];
  const known = dimensions.filter((d) => d.value !== null),
    weight = known.reduce((a, d) => a + d.weight, 0);
  const overall =
    weight === 0 ? null : Math.round(known.reduce((a, d) => a + (d.value ?? 0) * d.weight, 0) / weight);
  const attention = [...known].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  return {
    version: ENGINE_VERSION,
    overall,
    dimensions,
    dataCoverage: weight,
    attention,
    disclaimer: 'Indicador educacional próprio; não é score de crédito. Dados ausentes reduzem a cobertura.',
  };
}
export function nextMilestone(input: {
  debt: number;
  highInterestDebt: number;
  liquid: number;
  expenses: number;
  netWorth: number;
}) {
  [input.debt, input.highInterestDebt, input.liquid, input.expenses].forEach(nonnegative);
  money(input.netWorth);
  if (input.highInterestDebt > 0)
    return {
      title: 'Sair da dívida de juros altos',
      target: input.highInterestDebt,
      current: 0,
      action: 'Compare renegociação e pagamento prioritário.',
    };
  if (input.netWorth < 0)
    return {
      title: 'Equilibrar o que você tem e deve',
      target: -input.netWorth,
      current: 0,
      action: 'Organize um plano de quitação sustentável.',
    };
  const targets = [
    { title: 'Seu primeiro colchão de R$ 500', target: 50_000 },
    { title: 'Primeiros R$ 1.000 de reserva', target: 100_000 },
    ...[1, 3, 6]
      .filter(() => input.expenses > 0)
      .map((n) => ({
        title: `Reserva de ${n} ${n === 1 ? 'mês' : 'meses'}`,
        target: money(input.expenses * n),
      })),
  ].sort((a, b) => a.target - b.target);
  const reserve = targets.find((t) => t.target > input.liquid);
  if (reserve) return { ...reserve, current: input.liquid, action: 'Separe um valor que caiba no mês.' };
  const target = [1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000].find(
    (n) => n > input.netWorth,
  );
  return {
    title: target ? `Construir ${formatMoney(target)}` : 'Planejar sua independência',
    target: target ?? input.netWorth,
    current: input.netWorth,
    action: 'Revise objetivos, riscos e horizonte de vida.',
  };
}
