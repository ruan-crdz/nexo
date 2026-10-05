import { describe, expect, it } from 'vitest';
import { isSummaryRequest, whatsappMonthSummary } from '../../shared/whatsapp-summary';
import type { Transaction } from '../../shared/domain';

const row = (overrides: Partial<Transaction>): Transaction => ({
  id: '5d82e450-f19a-416e-8003-c1c650090482',
  description: 'Teste',
  amount: 10000,
  date: '2026-10-04',
  status: 'paid',
  type: 'income',
  source: 'whatsapp',
  account_id: null,
  category: 'Outros',
  ...overrides,
});
describe('resumo simples no WhatsApp', () => {
  it('aceita comandos claros sem confundir um gasto com uma consulta', () => {
    for (const command of ['resumo', 'Meu saldo', 'Como está meu mês?', 'quanto gastei este mês?'])
      expect(isSummaryRequest(command)).toBe(true);
    for (const text of [
      'Gastei 20 reais no resumo impresso',
      'Recebi 100 hoje',
      'saldo 200 reais',
      'resumo do ano passado',
    ])
      expect(isSummaryRequest(text)).toBe(false);
  });
  it('usa centavos e exclui previsões, outros meses e datas futuras', () => {
    const reply = whatsappMonthSummary(
      [
        row({}),
        row({ type: 'expense', amount: 2500 }),
        row({ amount: 999999, status: 'planned' }),
        row({ amount: 999999, date: '2026-09-01' }),
        row({ amount: 999999, date: '2026-10-30' }),
      ],
      '2026-10-05',
    );
    expect(reply).toMatch(/Entrou: R\$\s100,00/);
    expect(reply).toMatch(/Saiu: R\$\s25,00/);
    expect(reply).toMatch(/Sobrou no mês: R\$\s75,00/);
    expect(reply).toContain('Não é o saldo da sua conta bancária');
  });
  it('mostra falta com linguagem explícita e explica um mês vazio', () => {
    expect(whatsappMonthSummary([row({ type: 'expense' })], '2026-10-05')).toMatch(
      /Faltou no mês: R\$\s100,00/,
    );
    expect(whatsappMonthSummary([], '2026-10-05')).toContain('ainda não tem anotações');
  });
});
