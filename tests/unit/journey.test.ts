import { expect, it } from 'vitest';
import {
  canAward,
  goalJourney,
  goalMonthlyBudget,
  goalMonthlyPlan,
  goalPresets,
  habitSummary,
} from '../../shared/journey';
it('plano mensal respeita prazo e dinheiro restante sem inventar renda', () => {
  const goal = { target: 50000, saved: 1000, deadline: '2026-12-31' };
  expect(goalMonthlyPlan(goal, '2026-10-07', 5408)).toMatchObject({
    remaining: 49000,
    months: 3,
    required: 16334,
    suggested: 5408,
    gap: 10926,
    feasibleNow: false,
    projectedMonth: '2027-07',
  });
  expect(goalMonthlyPlan(goal, '2026-10-07', 0).suggested).toBe(0);
  expect(goalMonthlyPlan({ ...goal, saved: 50000 }, '2026-10-07', 5408).remaining).toBe(0);
  expect(goalMonthlyPlan({ ...goal, saved: 2000 }, '2026-10-07', 4408, 1000)).toMatchObject({
    monthlyTarget: 16334,
    required: 15334,
    savedThisMonth: 1000,
  });
});
it('meta sem prazo final não inventa cota nem cobrança mensal', () => {
  expect(goalMonthlyPlan({ target: 100000, saved: 2500, deadline: null }, '2026-10-08', 20000, 5000)).toMatchObject({
    remaining: 97500,
    months: null,
    required: 0,
    suggested: 0,
    gap: 0,
    monthlyTarget: null,
    savedThisMonth: 5000,
    overdue: false,
    feasibleNow: true,
    projectedMonth: null,
  });
});
it('separar dinheiro reduz livre para planejar, mas não muda entradas ou gastos', () => {
  const data = {
    transactions: [
      {
        id: crypto.randomUUID(),
        description: 'Entrada',
        amount: 6408,
        date: '2026-10-07',
        type: 'income' as const,
        category: 'Outros',
        status: 'paid' as const,
        source: 'manual' as const,
        account_id: null,
      },
    ],
    goal_events: [
      {
        id: crypto.randomUUID(),
        goal_id: crypto.randomUUID(),
        delta: 1000,
        reason: 'saving' as const,
        balance_after: 1000,
        created_at: '2026-10-07T12:00:00Z',
      },
    ],
  };
  expect(goalMonthlyBudget(data, '2026-10-07')).toMatchObject({
    net: 6408,
    allocated: 1000,
    available: 5408,
  });
  expect(
    goalMonthlyBudget(
      { ...data, goals: [{ id: 'initial-goal', saved: 1000 }], goal_events: [] },
      '2026-10-07',
    ),
  ).toMatchObject({ net: 6408, initialAllocation: 1000, allocated: 1000, available: 5408 });
  expect(
    goalMonthlyBudget(
      { ...data, goal_events: [{ ...data.goal_events[0], created_at: '2026-10-01T01:00:00Z' }] },
      '2026-10-07',
    ).allocated,
  ).toBe(0);
  const pending = {
    ...data.transactions[0],
    id: crypto.randomUUID(),
    type: 'expense' as const,
    status: 'planned' as const,
    amount: 2000,
    date: '2026-10-20',
  };
  expect(
    goalMonthlyBudget(
      { ...data, transactions: [...data.transactions, pending], profile: { fixed_expenses: 3000 } },
      '2026-10-07',
    ),
  ).toMatchObject({ reservedExpenses: 3000, available: 2408 });
  expect(
    goalMonthlyBudget(
      {
        ...data,
        goal_events: [
          ...data.goal_events,
          {
            ...data.goal_events[0],
            id: crypto.randomUUID(),
            delta: -1000,
            reason: 'withdrawal',
            balance_after: 0,
          },
        ],
      },
      '2026-10-07',
    ).available,
  ).toBe(6408);
});
it('urgência reduz dinheiro atual sem apagar conquista e sem prometer rendimento', () => {
  const journey = goalJourney({ target: 50000, saved: 0 }, 500, 30000);
  expect(journey).toMatchObject({
    recovering: true,
    peak: 30000,
    remaining: 50000,
    nextStep: 500,
    weeks: 100,
  });
  expect(journey.message).toContain('não foi apagado');
  expect(journey.message).toContain('essencial');
});
it('meta oferece passos exatos, inclusive bilhões, e permite pausa', () => {
  expect(goalPresets).toContain(100000000000);
  expect(goalJourney({ target: 50000, saved: 49999 }, 1000).nextStep).toBe(1);
  expect(goalJourney({ target: 50000, saved: 0 }, 0).weeks).toBeNull();
});
it('progresso local não confunde o próximo marco com uma meta bilionária', () => {
  const journey = goalJourney({ target: 100000000000, saved: 500 }, 500);
  expect(journey.milestone).toBe(1000);
  expect(journey.milestonePercent).toBe(50);
  expect(journey.percent).toBeLessThan(1);
});
it('pontos não somem após pausa ou emergência e não representam dinheiro', () => {
  const events = [
    { id: 'a', kind: 'checkin' as const, day: '2026-10-01', points: 5 },
    { id: 'b', kind: 'saving' as const, day: '2026-10-01', points: 10 },
  ];
  expect(habitSummary([...events, events[0]]).points).toBe(15);
  expect(habitSummary(events).label).toBe('Primeiro passo');
});
it('check-in e mensagens são limitados e reflexão vale uma vez por semana', () => {
  const events = [
    { id: 'check', kind: 'checkin' as const, day: '2026-10-05', points: 5 },
    { id: 'review', kind: 'reflection' as const, day: '2026-10-05', points: 10 },
  ];
  expect(canAward(events, 'checkin', '2026-10-05', 'another')).toBe(false);
  expect(canAward(events, 'reflection', '2026-10-06', 'another')).toBe(false);
  expect(canAward(events, 'checkin', '2026-10-06', 'another')).toBe(true);
});
