import { expect, it } from 'vitest';
import {
  invoiceFor,
  merchantKey,
  reconciliationMatches,
  spendingAllowance,
  spendingSignals,
} from '../../shared/financial-decisions';
import { recurringTransactions } from '../../shared/planning';
import { recurringRuleSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
const row = (changes: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  description: 'NETFLIX',
  amount: 3990,
  date: '2026-10-05',
  type: 'expense',
  category: 'Lazer',
  status: 'paid',
  source: 'whatsapp',
  account_id: null,
  ...changes,
});
it('saldo confirmado protege contas, reservas e metas sem antecipar renda', () => {
  const result = spendingAllowance(
    {
      cash: 100000,
      confirmed_on: '2026-10-05',
      next_income_date: '2026-10-15',
      protected_amount: 10000,
      goal_amount: 20000,
      estimated_income: 500000,
    },
    [row({ amount: 30000, status: 'planned', date: '2026-10-10' })],
    '2026-10-05',
  );
  expect(result.allowed).toBe(40000);
  expect(result.needs_confirmation).toBe(false);
  expect(() =>
    spendingAllowance(
      {
        cash: 1,
        confirmed_on: '2026-01-01',
        next_income_date: '2026-10-15',
        protected_amount: 0,
        goal_amount: 0,
        estimated_income: 0,
      },
      [],
      '2026-10-05',
    ),
  ).toThrow(/Confirme/);
});
it('conciliação sugere fontes diferentes sem apagar compras iguais', () => {
  const incoming = row({ description: 'PIX NETFLIX 012345', source: 'import' });
  const previous = row();
  expect(merchantKey(incoming.description)).toBe('netflix');
  expect(reconciliationMatches(incoming, [previous])).toEqual([previous]);
  expect(reconciliationMatches({ ...incoming, amount: 4000 }, [previous])).toEqual([]);
});
it('assinaturas e cobrança incomum incluem evidências e não acusam fraude', () => {
  const records = ['2026-07-05', '2026-08-05', '2026-09-05'].map((date) => row({ date }));
  expect(spendingSignals(records, '2026-10-05')[0]).toMatchObject({ kind: 'subscription', records });
  const signals = spendingSignals([...records, row({ amount: 15000 })], '2026-10-05');
  expect(signals.find((signal) => signal.kind === 'unusual')?.explanation).toContain('Não significa fraude');
});
it('faturas agrupam parcelas por fechamento sem duplicá-las', () => {
  const account = crypto.randomUUID();
  const records = [
    row({ account_id: account, date: '2026-10-10' }),
    row({ account_id: account, date: '2026-10-11' }),
  ];
  expect(invoiceFor(records, account, 10, 20, '2026-10').records).toHaveLength(1);
  expect(invoiceFor(records, account, 10, 20, '2026-11').records).toHaveLength(1);
});
it('recorrência semanal de renda e anual respeita data final e reajuste', () => {
  const rule = recurringRuleSchema.parse({
    id: crypto.randomUUID(),
    description: 'Renda',
    amount: 10000,
    category: 'Salário',
    start_date: '2026-10-01',
    active: true,
    type: 'income',
    frequency: 'weekly',
    end_date: '2026-10-15',
  });
  expect(recurringTransactions([rule], [], '2026-10-05').map((record) => record.date)).toEqual([
    '2026-10-01',
    '2026-10-08',
    '2026-10-15',
  ]);
  const annual = {
    ...rule,
    start_date: '2025-10-01',
    frequency: 'yearly' as const,
    end_date: null,
    annual_adjustment_bps: 1000,
  };
  expect(
    recurringTransactions([annual], [], '2026-10-05').find((record) => record.date === '2026-10-01')?.amount,
  ).toBe(11000);
});
