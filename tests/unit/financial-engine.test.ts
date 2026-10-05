import { describe, expect, it } from 'vitest';
import {
  adaptiveReserve,
  amortization,
  applyRate,
  breakEven,
  businessScenario,
  canSpend,
  civilDate,
  compound,
  debtPayoff,
  divideRound,
  employeeCost,
  formatMoney,
  goalPlan,
  inflationAdjusted,
  installments,
  MAX_MONEY,
  money,
  nexoScore,
  nextMilestone,
  parseMoney,
  runway,
  savingsRate,
  shiftDays,
  shiftMonths,
  sum,
  unitEconomics,
  validDate,
} from '../../shared/financial-engine';

describe('centavos seguros e arredondamento explícito', () => {
  it.each([
    ['0', 0],
    ['0,01', 1],
    ['0,1', 10],
    ['1.234,56', 123456],
    ['R$ 42,99', 4299],
    ['-10,50', -1050],
    ['1000', 100000],
  ])('converte %s', (input, expected) => expect(parseMoney(input)).toBe(expected));
  it.each(['1,234', '1.23', 'NaN', '1e6', '', '1,2,3', '1.234.56', '--1', 'Infinity'])(
    'rejeita formato ambíguo %s',
    (input) => expect(() => parseMoney(input)).toThrow(),
  );
  it('não perde centavos e limita magnitude', () => {
    expect(sum([parseMoney('0,10'), parseMoney('0,20')])).toBe(30);
    expect(() => money(0.1)).toThrow();
    expect(() => money(MAX_MONEY + 1)).toThrow();
    expect(() => sum([MAX_MONEY, 1])).toThrow();
    expect(() => parseMoney('999999999999999999999')).toThrow();
    expect(formatMoney(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });
  it('arredonda meio centavo para longe de zero', () => {
    expect(applyRate(1, 5000)).toBe(1);
    expect(applyRate(-1, 5000)).toBe(-1);
    expect(divideRound(1n, 3n)).toBe(0);
    expect(divideRound(-5n, 2n)).toBe(-3);
    expect(() => divideRound(1n, 0n)).toThrow();
    expect(() => applyRate(100, NaN)).toThrow();
  });
  it('preserva a soma de parcelas para muitos totais', () => {
    for (let total = 0; total < 500; total += 7)
      for (let count = 1; count <= 24; count++) {
        const parts = installments(total, count);
        expect(sum(parts)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    expect(installments(100, 3)).toEqual([34, 33, 33]);
    expect(() => installments(-1, 2)).toThrow();
    expect(() => installments(100, 0)).toThrow();
  });
});
describe('datas civis e timezone', () => {
  it('interpreta meia-noite UTC como dia anterior em São Paulo', () => {
    expect(civilDate(new Date('2026-10-04T01:00:00Z'), 'America/Sao_Paulo')).toBe('2026-10-03');
    expect(civilDate(new Date('2026-10-04T03:01:00Z'), 'America/Sao_Paulo')).toBe('2026-10-04');
    expect(civilDate(new Date('2026-10-04T03:01:00Z'), 'America/Manaus')).toBe('2026-10-03');
  });
  it('preserva fim do mês e ano bissexto', () => {
    expect(shiftMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(shiftMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(shiftMonths('2026-12-31', 1)).toBe('2027-01-31');
    expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftMonths('2026-01-31', -1)).toBe('2025-12-31');
  });
  it('rejeita datas impossíveis', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('xx')).toBe(false);
    expect(validDate('2026-13-01')).toBe(false);
    expect(() => shiftDays('xx', 1)).toThrow();
    expect(() => shiftMonths('2026-02-30', 1)).toThrow();
  });
});
describe('juros, projeções, inflação e metas', () => {
  it('calcula juros compostos com aporte ao fim do período', () => {
    expect(compound(10000, 1000, 100, 2)).toEqual([
      { month: 0, balance: 10000, contributed: 10000, interest: 0 },
      { month: 1, balance: 11100, contributed: 11000, interest: 100 },
      { month: 2, balance: 12211, contributed: 12000, interest: 211 },
    ]);
    expect(compound(0, 100, 0, 12).at(-1)?.balance).toBe(1200);
    expect(compound(100, 0, -10000, 1).at(-1)?.balance).toBe(0);
    expect(() => compound(-1, 1, 0, 1)).toThrow();
    expect(() => compound(100, 0, 0, 601)).toThrow();
    expect(() => compound(MAX_MONEY, MAX_MONEY, 1000, 2)).toThrow();
  });
  it('desconta inflação sem aproximação binária', () => {
    expect(inflationAdjusted(12100, 1000, 2)).toBe(10000);
    expect(inflationAdjusted(12345, 0, 20)).toBe(12345);
    expect(inflationAdjusted(100, 100, 0)).toBe(100);
    expect(() => inflationAdjusted(100, -1, 2)).toThrow();
  });
  it('mostra horizonte indefinido sem aporte', () => {
    expect(goalPlan(1000, 0, 5, 200)).toMatchObject({ required: 200, monthsToGoal: 5, feasible: true });
    expect(goalPlan(1000, 0, 0, 200).feasible).toBe(false);
    expect(goalPlan(1000, 1000, 0, 0)).toMatchObject({
      remaining: 0,
      monthsToGoal: 0,
      feasible: true,
      progress: 100,
    });
    expect(goalPlan(1000, 0, 10, 0).monthsToGoal).toBeNull();
    expect(goalPlan(0, 0, 0, 0).progress).toBe(100);
  });
  it('não divide renda zero', () => {
    expect(savingsRate(0, 100)).toBeNull();
    expect(savingsRate(1000, 800)).toBe(20);
    expect(savingsRate(1000, 1200)).toBe(-20);
  });
});
describe('dívidas e amortização', () => {
  it('conserva o principal na tabela Price e SAC', () => {
    for (const method of ['price', 'sac'] as const) {
      const rows = amortization(100_000, 300, 12, method);
      expect(sum(rows.map((r) => r.amortized))).toBe(100_000);
      expect(rows.at(-1)?.balance).toBe(0);
      expect(rows.every((r) => r.payment === r.amortized + r.interest)).toBe(true);
    }
    expect(amortization(100, 0, 3).map((r) => r.payment)).toEqual([34, 34, 32]);
    expect(amortization(0, 100, 3).every((r) => r.payment === 0)).toBe(true);
  });
  const debts = [
    { id: 'a', balance: 100_000, rateBps: 500, minimum: 5000 },
    { id: 'b', balance: 20_000, rateBps: 100, minimum: 2000 },
  ];
  it('avalanche economiza juros neste cenário de teste', () => {
    const a = debtPayoff(debts, 20_000, 'avalanche'),
      s = debtPayoff(debts, 20_000, 'snowball');
    expect(a.possible).toBe(true);
    expect(s.possible).toBe(true);
    expect(a.interestTotal).toBeLessThanOrEqual(s.interestTotal);
    expect(a.schedule.at(-1)?.balance).toBe(0);
    expect(sum(a.schedule.map((r) => r.paid))).toBe(120000 + a.interestTotal);
    expect(debts[0].balance).toBe(100000);
  });
  it('recusa orçamento inviável e amortização negativa', () => {
    expect(debtPayoff(debts, 1, 'avalanche').reason).toContain('mínimas');
    expect(
      debtPayoff([{ id: 'a', balance: 100000, rateBps: 500, minimum: 0 }], 4000, 'avalanche').reason,
    ).toContain('juros');
    expect(debtPayoff(debts, 10000, 'snowball', 1).possible).toBe(false);
    expect(debtPayoff([], 0, 'snowball').months).toBe(0);
    expect(() => debtPayoff([debts[0], debts[0]], 10000, 'snowball')).toThrow();
  });
});
describe('empresas e decisões', () => {
  it('calcula folha parametrizada', () => {
    expect(employeeCost(800000, 80000, 3500, 10000)).toEqual({
      salary: 800000,
      benefits: 80000,
      charges: 280000,
      other: 10000,
      monthly: 1170000,
      annual: 14040000,
    });
    expect(() => employeeCost(-1, 0, 0)).toThrow();
  });
  it('runway e break-even tratam denominador zero', () => {
    expect(runway(1000, 100, 200)).toBe(10);
    expect(runway(1000, 200, 100)).toBeNull();
    expect(runway(0, 100, 200)).toBe(0);
    expect(breakEven(8000, 2000)).toBe(10000);
    expect(breakEven(1, 3333)).toBe(2);
    expect(breakEven(100, 10000)).toBeNull();
  });
  it('calcula impacto e permite caixa futuro negativo', () => {
    const s = businessScenario({
      cash: 100_000,
      revenue: 100_000,
      fixedCosts: 80000,
      variableCostBps: 1000,
      newMonthlyCost: 30000,
      revenueChangeBps: -2000,
      months: 12,
    });
    expect(s.revenue).toBe(80000);
    expect(s.costs).toBe(118000);
    expect(s.result).toBe(-38000);
    expect(s.runwayBefore).toBeNull();
    expect(s.runwayAfter).toBeCloseTo(100000 / 38000);
    expect(s.projection.at(-1)?.balance).toBe(-356000);
    expect(s.additionalRevenueNeeded).toBe(42223);
    expect(
      businessScenario({
        cash: 0,
        revenue: 0,
        fixedCosts: 0,
        variableCostBps: 10000,
        newMonthlyCost: 0,
        revenueChangeBps: 0,
        months: 1,
      }).margin,
    ).toBeNull();
  });
  it('unit economics não inventa CAC/LTV sem base', () => {
    expect(
      unitEconomics({
        marketing: 100000,
        newCustomers: 10,
        revenue: 200000,
        customers: 20,
        grossMarginBps: 5000,
        churnBps: 1000,
      }),
    ).toEqual({ cac: 10000, arpu: 10000, ltv: 50000, paybackMonths: 2, arr: 2400000 });
    expect(
      unitEconomics({
        marketing: 0,
        newCustomers: 0,
        revenue: 0,
        customers: 0,
        grossMarginBps: 0,
        churnBps: 0,
      }),
    ).toMatchObject({ cac: null, arpu: null, ltv: null, paybackMonths: null });
  });
  it('protege reserva, contas e metas antes de aceitar compra', () => {
    const input = {
      amount: 42000,
      cash: 100000,
      expectedIncome: 10000,
      upcomingBills: 20000,
      protectedReserve: 30000,
      goalAllocation: 20000,
      monthlySavings: 10000,
    };
    expect(canSpend(input)).toMatchObject({
      free: 40000,
      after: -2000,
      affordable: false,
      goalDelayDays: 126,
    });
    expect(canSpend({ ...input, amount: 10000 }).affordable).toBe(true);
    expect(canSpend({ ...input, monthlySavings: 0 }).goalDelayDays).toBeNull();
    expect(canSpend({ ...input, amount: 0 }).goalDelayDays).toBe(0);
    expect(() => canSpend({ ...input, amount: -1 })).toThrow();
  });
});
describe('jornada e score auditáveis', () => {
  const base = {
    income: 100000,
    expenses: 80000,
    liquid: 240000,
    debt: 0,
    debtPayment: 0,
    reserve: 240000,
    recordedDays: 30,
    daysInPeriod: 30,
    previousNetWorth: 100000,
    netWorth: 150000,
    variableIncome: false,
    goalProgress: 100,
  };
  it('expõe pesos, evidência faltante e limites', () => {
    const s = nexoScore(base);
    expect(s.overall).toBe(100);
    expect(s.dimensions.reduce((n, d) => n + d.weight, 0)).toBe(100);
    expect(s.dataCoverage).toBe(100);
    const missing = nexoScore({ ...base, income: 0, expenses: 0, previousNetWorth: null });
    expect(missing.dataCoverage).toBeLessThan(100);
    expect(missing.dimensions.find((d) => d.name === 'Evolução')?.value).toBeNull();
    expect(nexoScore({ ...base, netWorth: -1000000, debt: 10000000 }).overall).toBeGreaterThanOrEqual(0);
    expect(() => nexoScore({ ...base, goalProgress: 101 })).toThrow();
  });
  it('adapta reserva sem regra universal', () => {
    expect(adaptiveReserve(10000, false, 0, true).months).toBe(3);
    expect(adaptiveReserve(10000, true, 2, false).months).toBe(9);
    expect(adaptiveReserve(0, false, 0, false).robust).toBe(0);
  });
  it('prioriza dívida cara e colchão antes de grandes patrimônios', () => {
    const input = { debt: 0, highInterestDebt: 0, liquid: 0, expenses: 100000, netWorth: 0 };
    expect(nextMilestone({ ...input, highInterestDebt: 100 }).title).toContain('juros altos');
    expect(nextMilestone({ ...input, netWorth: -100 }).target).toBe(100);
    expect(nextMilestone(input).target).toBe(50000);
    expect(nextMilestone({ ...input, liquid: 50000 }).target).toBe(100000);
    expect(nextMilestone({ ...input, liquid: 500000 }).target).toBe(600000);
    expect(nextMilestone({ ...input, liquid: 700000, netWorth: 1500000 }).target).toBe(2500000);
    expect(nextMilestone({ ...input, liquid: 1000000000, netWorth: 1000000000 }).title).toContain(
      'independência',
    );
  });
});
