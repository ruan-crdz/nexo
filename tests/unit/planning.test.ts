import { expect, it } from 'vitest';
import {
  budgetUsage,
  notificationCandidates,
  recurringTransactions,
  verifiedReply,
  weeklySummary,
} from '../../shared/planning';
import { emptyProfile } from '../../shared/domain';
import { goalSchema } from '../../shared/domain';
import type { RecurringRule, Transaction } from '../../shared/domain';
const transaction = (changes: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  description: 'Mercado',
  amount: 1234,
  type: 'expense',
  category: 'Alimentação',
  date: '2026-10-04',
  status: 'paid',
  source: 'manual',
  account_id: null,
  ...changes,
});
it('recorrência preserva dia âncora, é idempotente e nunca marca como pago', () => {
  const rule: RecurringRule = {
    id: crypto.randomUUID(),
    description: 'Aluguel',
    amount: 10000,
    category: 'Moradia',
    start_date: '2026-01-31',
    active: true,
    type: 'expense',
    frequency: 'monthly',
    end_date: null,
    annual_adjustment_bps: 0,
  };
  const rows = recurringTransactions([rule], [], '2026-02-28');
  expect(rows.map((row) => row.date)).toEqual(['2026-01-31', '2026-02-28']);
  expect(rows.every((row) => row.status === 'planned')).toBe(true);
  expect(recurringTransactions([rule], rows, '2026-02-28')).toEqual([]);
  expect(recurringTransactions([{ ...rule, active: false }], [], '2026-02-28')).toEqual([]);
});
it('limite soma somente gastos pagos da categoria e mostra excesso', () => {
  const budget = { id: crypto.randomUUID(), category: 'Alimentação', limit_amount: 1000, month: '2026-10' };
  expect(
    budgetUsage(
      [budget],
      [transaction(), transaction({ status: 'planned' }), transaction({ date: '2026-10-30' })],
      '2026-10-05',
    )[0],
  ).toMatchObject({ spent: 1234, remaining: -234 });
});
it('resposta inclui cálculo e registros, excluindo previsões e datas futuras', () => {
  const paid = transaction();
  const previous = transaction({ date: '2026-09-04', amount: 1000 });
  const result = verifiedReply(
    {
      transactions: [paid, previous, transaction({ status: 'planned' }), transaction({ date: '2026-10-30' })],
      goals: [],
    },
    'Por que gastei mais?',
    '2026-10-05',
  )!;
  expect(result.records).toEqual([paid, previous]);
  expect(result.answer).toContain('2,34');
  expect(verifiedReply({ transactions: [], goals: [] }, 'Gastei 20 no mercado', '2026-10-05')).toBeNull();
});
it('meta ultrapassada não inventa uma subtração com resultado zero', () => {
  const goal = {
    id: crypto.randomUUID(),
    name: 'Reserva',
    target: 1000,
    saved: 2000,
    deadline: '2026-12-01',
    monthly_contribution: 0,
    priority: 'medium' as const,
    weekly_amount: 0,
    high_water: 2000,
  };
  const result = verifiedReply(
    { transactions: [], goals: [goal] },
    'Quanto falta para minha meta?',
    '2026-10-05',
  )!;
  expect(result.calculation[0]).toContain('meta atingida');
  expect(result.calculation[0]).not.toContain(' - ');
});
it('resumo semanal cobre a última semana completa e conserva centavos', () => {
  expect(
    weeklySummary(
      [
        transaction({ date: '2026-10-04' }),
        transaction({ date: '2026-10-05' }),
        transaction({ date: '2026-10-01', status: 'planned' }),
      ],
      '2026-10-05',
    ),
  ).toMatchObject({ start: '2026-09-28', end: '2026-10-04', income: 0, expenses: 1234, net: -1234 });
});
it('avisos externos exigem consentimento e chaves impedem repetição diária', () => {
  const data = {
    profile: { ...emptyProfile, reminders_enabled: true, weekly_digest: true },
    transactions: [transaction({ status: 'planned' })],
    budgets: [],
  };
  expect(notificationCandidates(data, '2026-10-05')).toEqual([]);
  data.profile.whatsapp_notifications = true;
  const first = notificationCandidates(data, '2026-10-05');
  const second = notificationCandidates(data, '2026-10-06');
  expect(first[0].key).toBe(second[0].key);
  data.profile.reminders_enabled = false;
  expect(notificationCandidates(data, '2026-10-05')).toEqual([]);
});
it('lembrete de meta respeita pausa, check-in semanal e consentimento', () => {
  const goal = goalSchema.parse({
    id: crypto.randomUUID(),
    name: 'Reserva',
    target: 50000,
    saved: 0,
    weekly_amount: 500,
    high_water: 30000,
    monthly_contribution: 0,
    deadline: '2027-01-01',
    priority: 'medium',
  });
  const data = {
    profile: {
      ...emptyProfile,
      whatsapp_notifications: true,
      journey_reminders: true,
      active_goal_id: goal.id,
    },
    transactions: [],
    budgets: [],
    goals: [goal],
    habit_events: [],
  };
  expect(notificationCandidates(data, '2026-10-05')[0].text).toContain('não foi apagado');
  expect(
    notificationCandidates(
      { ...data, profile: { ...data.profile, journey_pause_until: '2026-10-10' } },
      '2026-10-05',
    ),
  ).toEqual([]);
  expect(
    notificationCandidates(
      { ...data, profile: { ...data.profile, whatsapp_notifications: false } },
      '2026-10-05',
    ),
  ).toEqual([]);
});
