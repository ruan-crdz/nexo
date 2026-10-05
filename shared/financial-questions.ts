import type { Dataset } from './domain.ts';
import { formatMoney, sum } from './financial-engine.ts';
import { questionPeriod } from './question-period.ts';
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
  const period = questionPeriod(normalized, today);
  if ('error' in period) return { answer: period.error, calculation: [], records: [], goals: [] };
  if (isVerifiedQuestion(text) && !/paguei|pagas|pagos|recebi/.test(normalized) && !period.explicit)
    return verifiedReply(data, text, today);
  const { start, end } = period;
  if (
    period.explicit &&
    /vencem|vencer|contas|por que|porque/.test(normalized) &&
    !/paguei|pagas|pagos|recebi/.test(normalized)
  )
    return {
      answer:
        'Para esse período, pergunte quanto gastou ou recebeu. Para contas pendentes, pergunte “Quais contas vencem?”. Para comparar os meses atuais, pergunte “Por que gastei mais?”.',
      calculation: [],
      records: [],
      goals: [],
    };
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
  const merchant = normalized.match(
    /\b(?:na|no|com)\s+([^?]+?)(?=\s+(?:hoje|ontem|nos ultimos|no mes|este mes|mes passado|em |ano passado)|[?]|$)/,
  )?.[1];
  const merchantFilter =
    !category && !accounts.length && merchant && !/\b(mes|ano|hoje|ontem|conta|ultimos|dias)\b/.test(merchant)
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
