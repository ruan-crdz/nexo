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
it('respeita mês nomeado, ano e estabelecimento sem trocar pelo mês atual', () => {
  const january = row({ date: '2026-01-10', amount: 9900, description: 'Mercado Central' });
  const previous = row({ date: '2025-01-10', amount: 4500, description: 'Mercado Central' });
  const data = {
    transactions: [january, previous, row({ amount: 1200 })],
    goals: [],
    financial_accounts: [],
  };
  expect(answerFinancialQuestion(data, 'Quanto gastei em janeiro?', '2026-10-05')?.records).toEqual([
    january,
  ]);
  expect(
    answerFinancialQuestion(data, 'Quanto gastei no Mercado Central em janeiro de 2025?', '2026-10-05')
      ?.records,
  ).toEqual([previous]);
  expect(
    answerFinancialQuestion(data, 'Quanto gastei em janeiro do ano passado?', '2026-10-05')?.records,
  ).toEqual([previous]);
  expect(answerFinancialQuestion(data, 'Quanto gastei em janeiro?', '2026-10-05')?.calculation[0]).toContain(
    '2026-01-01 a 2026-01-31',
  );
});
it.each([
  'em janeiro e fevereiro',
  'na semana passada',
  'entre 01/01/2026 e 31/01/2026',
  'nos últimos 0 dias',
  'nos últimos 400 dias',
  'em janeiro ontem',
  'em novembro de 2026',
  'anteontem',
  'em janeiro do ano retrasado',
  'em 15 de janeiro',
  'em janeiro de 2024 do ano passado',
])('pede esclarecimento para período ambíguo ou não suportado: %s', (period) => {
  const data = { transactions: [row()], goals: [], financial_accounts: [] };
  const result = answerFinancialQuestion(data, `Quanto gastei ${period}?`, '2026-10-05');
  expect(result).not.toBeNull();
  expect(result?.records).toEqual([]);
  expect(result?.calculation).toEqual([]);
  expect(result?.answer).not.toContain('Gastos anotados');
});
it('fevereiro bissexto e últimos dias incluem os limites corretos', () => {
  const leap = row({ date: '2024-02-29' });
  const data = {
    transactions: [leap, row({ date: '2026-10-03' }), row({ date: '2026-10-02' })],
    goals: [],
    financial_accounts: [],
  };
  expect(answerFinancialQuestion(data, 'Quanto gastei em fevereiro de 2024?', '2026-10-05')?.records).toEqual(
    [leap],
  );
  expect(
    answerFinancialQuestion(data, 'Quanto gastei nos últimos 3 dias?', '2026-10-05')?.records,
  ).toHaveLength(1);
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
