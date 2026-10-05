import type { Dataset, Transaction } from './domain.ts';
import {
  civilDate,
  sum,
  savingsRate,
  nexoScore,
  nextMilestone,
  employeeCost,
  businessScenario,
} from './financial-engine.ts';

export function monthlyFlow(transactions: Transaction[], month: string) {
  const paid = transactions.filter((t) => t.date.startsWith(month) && t.status === 'paid');
  const income = sum(paid.filter((t) => t.type === 'income').map((t) => t.amount));
  const expenses = sum(paid.filter((t) => t.type === 'expense').map((t) => t.amount));
  return {
    income,
    expenses,
    net: income - expenses,
    savingsRate: savingsRate(income, expenses),
    count: paid.length,
  };
}
export function personalSummary(data: Dataset, today = civilDate(new Date(), data.profile.timezone)) {
  const month = today.slice(0, 7),
    flow = monthlyFlow(
      data.transactions.filter((t) => t.date <= today),
      month,
    );
  const posted = data.transactions.filter((t) => t.status === 'paid' && t.date <= today);
  const balance = sum([
    ...data.financial_accounts.map((a) => a.opening_balance),
    ...posted.map((t) => (t.type === 'income' ? t.amount : -t.amount)),
  ]);
  const accountBalance = (id: string) =>
    sum([
      data.financial_accounts.find((a) => a.id === id)?.opening_balance ?? 0,
      ...posted.filter((t) => t.account_id === id).map((t) => (t.type === 'income' ? t.amount : -t.amount)),
    ]);
  const reserve = sum(
    data.financial_accounts.filter((a) => a.kind === 'savings').map((a) => Math.max(0, accountBalance(a.id))),
  );
  const debts = sum(data.debts.map((d) => d.balance));
  const netWorth = sum([balance, ...data.assets.map((a) => a.value), -debts]);
  const upcoming = data.transactions.filter((t) => t.status === 'planned' && t.date.startsWith(month));
  const upcomingBills = sum(upcoming.filter((t) => t.type === 'expense').map((t) => t.amount));
  const expectedIncome = sum(upcoming.filter((t) => t.type === 'income').map((t) => t.amount));
  const goalAllocation = sum(data.goals.filter((g) => g.saved < g.target).map((g) => g.monthly_contribution));
  const free = sum([balance, expectedIncome, -upcomingBills, -reserve, -goalAllocation]);
  const expensesBaseline = Math.max(data.profile.fixed_expenses, flow.expenses);
  const milestone = nextMilestone({
    debt: debts,
    highInterestDebt: sum(data.debts.filter((d) => d.rate_bps >= 300).map((d) => d.balance)),
    liquid: reserve,
    expenses: expensesBaseline,
    netWorth,
  });
  const days = new Date(`${month}-01T12:00:00Z`);
  const daysInPeriod = new Date(Date.UTC(days.getUTCFullYear(), days.getUTCMonth() + 1, 0)).getUTCDate();
  const score = nexoScore({
    income: flow.income || data.profile.monthly_income,
    expenses: expensesBaseline,
    liquid: Math.max(0, balance),
    debt: debts,
    debtPayment: sum(data.debts.map((d) => d.minimum)),
    reserve,
    recordedDays: new Set(posted.filter((t) => t.date.startsWith(month)).map((t) => t.date)).size,
    daysInPeriod,
    previousNetWorth: null,
    netWorth,
    variableIncome: data.profile.variable_income,
    goalProgress: data.goals.length
      ? data.goals.reduce((n, g) => n + Math.min(100, (g.saved / g.target) * 100), 0) / data.goals.length
      : 0,
  });
  return {
    ...flow,
    balance,
    reserve,
    debts,
    netWorth,
    upcomingBills,
    expectedIncome,
    goalAllocation,
    free,
    expensesBaseline,
    milestone,
    score,
    accountBalance,
  };
}
export function businessSummary(data: Dataset) {
  const payroll = sum(
    data.employees.map((e) => employeeCost(e.salary, e.benefits, e.charges_bps, e.other_costs).monthly),
  );
  const b = data.business;
  const scenario = businessScenario({
    cash: b.cash,
    revenue: b.revenue,
    fixedCosts: sum([b.fixed_costs, payroll, b.pro_labore]),
    variableCostBps: Math.min(10_000, b.variable_cost_bps + b.tax_bps),
    newMonthlyCost: 0,
    revenueChangeBps: 0,
    months: 12,
  });
  return { ...scenario, payroll };
}
export function weeklyPlan(data: Dataset): { id: string; title: string; reason: string; href: string }[] {
  const s = personalSummary(data);
  const plan = [];
  if (data.debts.some((d) => d.overdue || d.rate_bps >= 300))
    plan.push({
      id: 'debt',
      title: 'Compare as opções para sua dívida prioritária',
      reason: 'Há uma dívida em atraso ou com taxa de pelo menos 3% ao mês. Simule antes de negociar.',
      href: '/dividas',
    });
  if (s.upcomingBills > 0)
    plan.push({
      id: 'bills',
      title: 'Confira as próximas contas do mês',
      reason: 'Separe os compromissos previstos antes de decidir novos gastos.',
      href: '/movimentos',
    });
  plan.push({
    id: 'reserve',
    title: s.reserve === 0 ? 'Defina seu primeiro colchão financeiro' : 'Revise o aporte da sua reserva',
    reason: 'Use um valor que caiba no seu fluxo atual, sem comprometer contas essenciais.',
    href: '/metas',
  });
  if (plan.length < 3)
    plan.push({
      id: 'records',
      title: 'Reserve dez minutos para conferir os registros',
      reason: 'Com dados completos, as projeções ficam mais úteis.',
      href: '/movimentos',
    });
  return plan.slice(0, 3);
}
