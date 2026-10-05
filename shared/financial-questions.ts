import type { Dataset } from './domain.ts';
import { formatMoney, shiftDays, shiftMonths, sum } from './financial-engine.ts';
import { merchantKey } from './financial-decisions.ts';
import { isVerifiedQuestion, verifiedReply } from './planning.ts';
export function isFinancialQuestion(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return (
    isVerifiedQuestion(text) ||
    (/^(quanto|quais|como|por que|porque|mostre|me mostre|posso)\b/.test(normalized) &&
      /gast|receb|entrou|saiu|conta|meta|dinheiro|saldo/.test(normalized))
  );
}
export function answerFinancialQuestion(
  data: Pick<Dataset, 'transactions' | 'goals' | 'financial_accounts'>,
  text: string,
  today: string,
) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!isFinancialQuestion(text)) return null;
  if (/posso gastar|posso comprar|disponivel|quanto.*(?:dinheiro|saldo)/.test(normalized))
    return {
      answer:
        'Preciso de dinheiro disponível confirmado, próximo recebimento, contas e valores protegidos. Abra Decidir no app; não vou usar sobra mensal como saldo.',
      calculation: [],
      records: [],
      goals: [],
    };
  if (/meta/.test(normalized)) return verifiedReply(data, 'Quanto falta para minha meta?', today);
  if (isVerifiedQuestion(text) && !/paguei|pagas|pagos|recebi/.test(normalized))
    return verifiedReply(data, text, today);
  let start = `${today.slice(0, 7)}-01`,
    end = today;
  if (/ontem/.test(normalized)) start = end = shiftDays(today, -1);
  else if (/hoje/.test(normalized)) start = today;
  else if (/mes passado|ultimo mes/.test(normalized)) {
    start = `${shiftMonths(today, -1).slice(0, 7)}-01`;
    end = shiftDays(`${today.slice(0, 7)}-01`, -1);
  } else {
    const last = normalized.match(/ultimos?\s+(\d{1,3})\s+dias/);
    if (last) {
      const count = Number(last[1]);
      if (count < 1 || count > 366) return null;
      start = shiftDays(today, 1 - count);
    }
  }
  const aliases: Record<string, string> = {
    comida: 'Alimentação',
    alimentacao: 'Alimentação',
    transporte: 'Transporte',
    moradia: 'Moradia',
    saude: 'Saúde',
    lazer: 'Lazer',
    compras: 'Compras',
    educacao: 'Educação',
    servicos: 'Serviços',
    investimentos: 'Investimentos',
    salario: 'Salário',
  };
  const category = Object.entries(aliases).find(([key]) => new RegExp(`\\b${key}\\b`).test(normalized))?.[1];
  const accounts = data.financial_accounts.filter((account) =>
    normalized.includes(
      account.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    ),
  );
  if (accounts.length > 1)
    return {
      answer: 'Mais de uma conta corresponde ao pedido. Informe uma conta específica.',
      calculation: [],
      records: [],
      goals: [],
    };
  if (/\b(?:na|da)\s+(?:minha\s+)?conta\b/.test(normalized) && !accounts.length)
    return {
      answer: 'Não reconheci a conta solicitada. Use o nome completo de uma conta cadastrada.',
      calculation: [],
      records: [],
      goals: [],
    };
  if (/ano passado|ultimo ano|desde|entre/.test(normalized))
    return {
      answer: 'Esse período precisa de definição explícita. Use hoje, ontem, mês passado ou últimos N dias.',
      calculation: [],
      records: [],
      goals: [],
    };
  const merchant = normalized.match(
    /\b(?:na|no|com)\s+([^?]+?)(?=\s+(?:hoje|ontem|nos ultimos|no mes|este mes|mes passado)|[?]|$)/,
  )?.[1];
  const merchantFilter =
    !category && !accounts.length && merchant && !/mes|conta|ultimos|dias/.test(merchant)
      ? merchantKey(merchant)
      : null;
  if (/por que|porque|pq/.test(normalized) && /gastei.*mais/.test(normalized))
    return verifiedReply(
      {
        ...data,
        transactions: data.transactions.filter(
          (row) =>
            (!category || row.category === category) &&
            (!accounts.length || row.account_id === accounts[0].id),
        ),
      },
      'Por que gastei mais?',
      today,
    );
  const type = /receb|entrou|ganhei/.test(normalized) ? 'income' : 'expense';
  const records = data.transactions.filter(
    (row) =>
      row.status === 'paid' &&
      row.type === type &&
      row.date >= start &&
      row.date <= end &&
      (!category || row.category === category) &&
      (!accounts.length || row.account_id === accounts[0].id) &&
      (!merchantFilter || merchantKey(row.description).includes(merchantFilter)),
  );
  const total = sum(records.map((row) => row.amount));
  return {
    answer: `${type === 'income' ? 'Entradas' : 'Gastos'} anotados: ${formatMoney(total)}.`,
    calculation: [
      `Período: ${start} a ${end}.`,
      category ? `Categoria: ${category}.` : 'Todas as categorias.',
      accounts.length ? `Conta: ${accounts[0].name}.` : 'Todas as contas.',
      `${records.length} registros pagos somados = ${formatMoney(total)}. Previsões não foram incluídas.`,
    ],
    records,
    goals: [],
  };
}
