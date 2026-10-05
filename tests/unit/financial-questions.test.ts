import { expect, it } from 'vitest';
import { answerFinancialQuestion } from '../../shared/financial-questions';
import type { Transaction } from '../../shared/domain';
const row = (changes: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  description: 'Almoço',
  amount: 1234,
  date: '2026-10-04',
  type: 'expense',
  category: 'Alimentação',
  status: 'paid',
  source: 'manual',
  account_id: null,
  ...changes,
});
it('consulta ontem/categoria soma só registros elegíveis e não grava', () => {
  const data = {
    transactions: [
      row(),
      row({ category: 'Lazer' }),
      row({ status: 'planned' }),
      row({ date: '2026-10-05' }),
    ],
    goals: [],
    financial_accounts: [],
  };
  const original = JSON.stringify(data);
  const answer = answerFinancialQuestion(data, 'Quanto gastei em alimentação ontem?', '2026-10-05')!;
  expect(answer.records).toHaveLength(1);
  expect(answer.answer).toContain('12,34');
  expect(JSON.stringify(data)).toBe(original);
});
it('renda e conta são filtros explícitos e perguntas de caixa recusam inventar saldo', () => {
  const account = {
    id: crypto.randomUUID(),
    name: 'Conta principal',
    kind: 'checking' as const,
    opening_balance: 0,
    closing_day: null,
    due_day: null,
  };
  const data = {
    transactions: [row({ type: 'income', account_id: account.id }), row({ type: 'income' })],
    goals: [],
    financial_accounts: [account],
  };
  expect(
    answerFinancialQuestion(data, 'Quanto recebi na Conta principal hoje?', '2026-10-04')?.records,
  ).toHaveLength(1);
  expect(answerFinancialQuestion(data, 'Quanto posso gastar?', '2026-10-05')?.answer).toContain('confirmado');
});
