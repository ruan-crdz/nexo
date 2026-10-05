import { expect, it } from 'vitest';
import { extractionDecision } from '../../shared/extraction';
const transaction = {
  description: 'Coxinha',
  amount: 1000,
  type: 'expense',
  category: 'Alimentação',
  date: '2026-10-04',
  status: 'paid',
  confidence: 0.95,
  installments: 1,
};
it('valida e determina confiança sem salvar texto livre', () => {
  expect(
    extractionDecision({ intent: 'record', clarification: null, transactions: [transaction] }).action,
  ).toBe('save');
  expect(
    extractionDecision({
      intent: 'record',
      clarification: null,
      transactions: [{ ...transaction, confidence: 0.8 }],
    }).action,
  ).toBe('save-correctable');
  expect(
    extractionDecision({
      intent: 'record',
      clarification: null,
      transactions: [{ ...transaction, confidence: 0.69 }],
    }).action,
  ).toBe('confirm');
  expect(
    extractionDecision({
      intent: 'record',
      clarification: 'Quanto?',
      transactions: [{ ...transaction, amount: null }],
    }).action,
  ).toBe('clarify');
  expect(
    extractionDecision({ intent: 'question', clarification: null, transactions: [] }).transactions,
  ).toHaveLength(0);
  expect(() =>
    extractionDecision({
      intent: 'record',
      clarification: null,
      transactions: [{ ...transaction, amount: -10 }],
    }),
  ).toThrow();
});
it('expande parcelas com datas calculadas e estado previsto', () => {
  const result = extractionDecision({
    intent: 'record',
    clarification: null,
    transactions: [
      { ...transaction, description: 'Notebook', amount: 32000, installments: 10, date: '2026-01-31' },
    ],
  });
  expect(result.transactions).toHaveLength(10);
  expect(result.transactions[1]).toMatchObject({ date: '2026-02-28', amount: 32000, status: 'planned' });
  expect(result.transactions.reduce((n, t) => n + t.amount, 0)).toBe(320000);
});
it('mantém dois gastos e impede lotes enormes', () => {
  expect(
    extractionDecision({
      intent: 'record',
      clarification: null,
      transactions: [transaction, { ...transaction, description: 'Ônibus', amount: 1200 }],
    }).transactions,
  ).toHaveLength(2);
  expect(() =>
    extractionDecision({
      intent: 'record',
      clarification: null,
      transactions: [
        { ...transaction, installments: 20 },
        { ...transaction, installments: 2 },
      ],
    }),
  ).toThrow();
});
