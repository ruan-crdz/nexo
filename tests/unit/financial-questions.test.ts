import { expect, it } from 'vitest';
import {
  answerFinancialQuestion,
  imageGenerationPrompt,
  isFinancialChartRequest,
  isFinancialQuestion,
  isMonthlySummaryRequest,
} from '../../shared/financial-questions';
import type { Transaction } from '../../shared/domain';
import { validateChatChange } from '../../shared/whatsapp-chat';
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
it('chat prepara recorrência sem inventar vencimento e bloqueia campos privilegiados', () => {
  const args = {
    entity: 'recurring_rules',
    action: 'create',
    id: null,
    values: JSON.stringify({
      description: 'Internet',
      amount: 15600,
      category: 'Serviços',
      active: true,
      type: 'expense',
      frequency: 'monthly',
      end_date: null,
      annual_adjustment_bps: 0,
    }),
  };
  expect(() => validateChatChange(args, null)).toThrow();
  const change = validateChatChange(
    { ...args, values: JSON.stringify({ ...JSON.parse(args.values), start_date: '2026-10-15' }) },
    null,
  );
  expect(change.payload).toMatchObject({ description: 'Internet', amount: 15600, start_date: '2026-10-15' });
  expect(change.id).toBeTruthy();
  expect(() => validateChatChange({ ...args, id: crypto.randomUUID() }, null)).toThrow(/identificador/);
  expect(() =>
    validateChatChange(
      {
        entity: 'profiles',
        action: 'update',
        id: crypto.randomUUID(),
        values: '{"whatsapp_notifications":true}',
      },
      { name: 'Ruan' },
    ),
  ).toThrow();
  expect(() =>
    validateChatChange(
      { entity: 'transactions', action: 'update', id: crypto.randomUUID(), values: '{"user_id":"outro"}' },
      row(),
    ),
  ).toThrow();
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
  expect(answerFinancialQuestion(data, 'Quanto gastei em janeiro?', '2026-10-05')?.answer).toContain(
    'janeiro de 2026',
  );
});
it('resumo mensal soma entradas e gastos pagos e exclui previsões', () => {
  const income = row({ type: 'income', category: 'Salário', amount: 20000, date: '2026-10-02' });
  const expense = row({ category: 'Saúde', amount: 10000, date: '2026-10-04' });
  const planned = row({ amount: 70000, status: 'planned', date: '2026-10-12' });
  const data = { transactions: [income, expense, planned], goals: [], financial_accounts: [] };
  expect(isMonthlySummaryRequest('resumo mensal')).toBe(true);
  expect(isFinancialQuestion('resumo mensal')).toBe(true);
  expect(answerFinancialQuestion(data, 'resumo mensal', '2026-10-08')).toMatchObject({
    answer: expect.stringMatching(/entraram R\$\s*200,00, saíram R\$\s*100,00/),
    records: [income, expense],
    goals: [],
  });
  expect(answerFinancialQuestion(data, 'resumo deste mês: entradas e gastos pagos', '2026-10-08')?.records).toEqual([
    income,
    expense,
  ]);
});
it.each(['com Uber', 'em Uber', 'no Uber'])('filtra estabelecimento sem somar aluguel: %s', (filter) => {
  const uber = row({ description: 'Uber', category: 'Transporte', amount: 2500 });
  const data = {
    transactions: [uber, row({ description: 'Aluguel', category: 'Moradia', amount: 150000 })],
    goals: [],
    financial_accounts: [],
  };
  const answer = answerFinancialQuestion(data, `Quanto gastei ${filter}?`, '2026-10-07');
  expect(answer?.records).toEqual([uber]);
  expect(answer?.answer).toMatch(/R\$\s25,00/);
});
it('separa estabelecimento de mês nomeado usando a preposição em', () => {
  const uber = row({ description: 'Uber', category: 'Transporte', amount: 2500, date: '2026-01-10' });
  const rent = row({ description: 'Aluguel', amount: 150000, date: '2026-01-10' });
  const data = { transactions: [uber, rent], goals: [], financial_accounts: [] };
  expect(answerFinancialQuestion(data, 'Quanto gastei em Uber em janeiro?', '2026-10-07')?.records).toEqual([
    uber,
  ]);
  expect(answerFinancialQuestion(data, 'Quanto gastei em janeiro?', '2026-10-07')?.records).toEqual([
    uber,
    rent,
  ]);
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

it('reconhece uma pergunta de compra e pede as premissas sem inventar disponibilidade', () => {
  const data = { transactions: [row()], goals: [], financial_accounts: [] };
  const answer = answerFinancialQuestion(data, 'Posso comprar um Play 5 por R$ 5.000?', '2026-10-07');

  expect(answer?.answer).toContain('dinheiro disponível confirmado hoje');
  expect(answer?.answer).toContain('contas até lá');
  expect(answer?.records).toEqual([]);
  expect(answer?.answer).not.toContain('Pode comprar');
});

it('reconhece pedidos de gráfico financeiro para responder com dados verificados', () => {
  expect(isFinancialChartRequest('Faz um gráfico de gastos por categoria neste mês')).toBe(true);
  expect(isFinancialChartRequest('Gere uma foto de um cachorro no parque')).toBe(false);
});
it('gera imagens só quando pedidas explicitamente e não troca gráfico financeiro por arte', () => {
  expect(imageGenerationPrompt('Faz uma foto de um cachorro no parque')).toBe(
    'Faz uma foto de um cachorro no parque',
  );
  expect(imageGenerationPrompt('Crie um gráfico dos meus gastos deste mês')).toBeNull();
  expect(imageGenerationPrompt('Qual é a previsão para minha conta?')).toBeNull();
});

it('consulta previsões do próximo mês em lançamentos e recorrências reais', () => {
  const planned = row({
    description: 'IPTU',
    amount: 20000,
    date: '2026-11-05',
    category: 'Moradia',
    status: 'planned',
  });
  const recurringRule = {
    id: crypto.randomUUID(),
    description: 'Internet',
    amount: 9900,
    category: 'Serviços',
    start_date: '2026-04-15',
    active: true,
    type: 'expense' as const,
    frequency: 'monthly' as const,
    end_date: null,
    annual_adjustment_bps: 0,
  };
  const question = 'Previsões do próximo mês?';
  const answer = answerFinancialQuestion(
    {
      transactions: [planned],
      goals: [],
      financial_accounts: [],
      recurring_rules: [recurringRule],
      recurring_occurrences: [],
    },
    question,
    '2026-10-07',
  );

  expect(isFinancialQuestion(question)).toBe(true);
  expect(answer?.records.map((record) => record.description)).toEqual(['IPTU', 'Internet']);
  expect(answer?.answer).toContain('novembro de 2026');
  expect(answer?.answer).toMatch(/R\$\s299,00/);
});

it('encontra cassino ou loteria em todo o histórico sem incluir pendências', () => {
  const casino = row({ description: 'Cassino online', amount: 5000, date: '2026-04-12' });
  const lottery = row({ description: 'Loteria central', amount: 1500, date: '2026-02-01' });
  const lotteryCategory = row({
    description: 'Aposta online',
    category: 'Loteria',
    amount: 3500,
    date: '2026-03-02',
  });
  const answer = answerFinancialQuestion(
    {
      transactions: [
        casino,
        lottery,
        lotteryCategory,
        row({ description: 'Cinema', amount: 3000, date: '2026-04-12' }),
        row({ description: 'Cassino futuro', date: '2026-10-10', status: 'planned' }),
      ],
      goals: [],
      financial_accounts: [],
    },
    'Tive algum gasto com cassino ou loteria?',
    '2026-10-07',
  );

  expect(isFinancialQuestion('Tive algum gasto com cassino ou loteria?')).toBe(true);
  expect(answer?.records).toEqual([casino, lottery, lotteryCategory]);
  expect(answer?.answer).toMatch(/R\$\s100,00/);
  expect(answer?.answer).toContain('histórico');
});
