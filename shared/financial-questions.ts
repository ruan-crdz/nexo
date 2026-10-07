import type { Dataset } from './domain.ts';
import { formatMoney, shiftDays, shiftMonths, sum } from './financial-engine.ts';
import { questionPeriod } from './question-period.ts';
import { merchantKey } from './financial-decisions.ts';
import { isVerifiedQuestion, recurringTransactions, verifiedReply } from './planning.ts';

export function isSpendabilityQuestion(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return /\b(?:posso|consigo|da para|vale a pena)\b.*\b(?:comprar|pagar|adquirir)\b/.test(normalized);
}

export function isFinancialChartRequest(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    /\b(?:grafico|graficos|imagem|foto|visual)\b/.test(normalized) &&
    /\b(?:gastos?|gastei|recebi|entradas?|saidas?|resumo|mes|contas?|metas?|dinheiro|saldo|financas?)\b/.test(
      normalized,
    )
  );
}

export function isNextMonthForecastQuestion(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    /\b(?:previs\w*|projec\w*)\b/.test(normalized) &&
    /\b(?:proximo\s+mes|mes\s+que\s+vem|mes\s+seguinte)\b/.test(normalized)
  );
}

export function imageGenerationPrompt(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const asksForImage =
    /\b(?:gere|gera|gerar|crie|cria|criar|desenhe|desenha|desenhar|faca|faz|fazer|quero|manda|envia|produza)\b/.test(
      normalized,
    ) && /\b(?:imagens?|fotos?|ilustracoes?|desenhos?|artes?|posters?)\b/.test(normalized);
  return asksForImage && !isFinancialChartRequest(normalized) ? text.trim().slice(0, 2000) : null;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatPeriod(start: string, end: string, today: string) {
  if (start === `${today.slice(0, 7)}-01` && end === today) return `neste mês, até ${formatDate(end)}`;
  if (start === end) return `em ${formatDate(start)}`;
  return `de ${formatDate(start)} a ${formatDate(end)}`;
}

export function isFinancialQuestion(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return (
    isSpendabilityQuestion(normalized) ||
    isFinancialChartRequest(normalized) ||
    isNextMonthForecastQuestion(normalized) ||
    isVerifiedQuestion(text) ||
    (/^(quanto|quais|como|por que|porque|mostre|me mostre|posso)\b/.test(normalized) &&
      /gast|receb|entrou|saiu|conta|meta|dinheiro|saldo/.test(normalized)) ||
    /^(?:tive|houve|encontrei|achei)\b.*\b(?:gastos?|despesas?|compras?|pagamentos?|lancamentos?)\b/.test(
      normalized,
    )
  );
}
export function answerFinancialQuestion(
  data: Pick<Dataset, 'transactions' | 'goals' | 'financial_accounts'> &
    Partial<Pick<Dataset, 'recurring_rules' | 'recurring_occurrences'>>,
  text: string,
  today: string,
) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!isFinancialQuestion(text)) return null;
  if (isSpendabilityQuestion(normalized))
    return {
      answer:
        'Posso te ajudar a avaliar essa compra, mas não vou chutar com base só nos gastos anotados. Para calcular com segurança, preciso do dinheiro disponível confirmado hoje, da data do próximo recebimento, das contas até lá, da reserva que você quer proteger e do valor separado para metas. “Posso gastar?” no app calcula isso com esses dados.',
      calculation: [],
      records: [],
      goals: [],
    };
  if (isNextMonthForecastQuestion(normalized)) {
    const start = shiftMonths(`${today.slice(0, 7)}-01`, 1);
    const end = shiftDays(shiftMonths(start, 1), -1);
    const planned = data.transactions.filter(
      (row) => row.status === 'planned' && row.date >= start && row.date <= end,
    );
    const recurring = recurringTransactions(
      data.recurring_rules ?? [],
      data.transactions,
      start,
      data.recurring_occurrences ?? [],
    ).filter((row) => row.date >= start && row.date <= end);
    const records = [...new Map([...planned, ...recurring].map((row) => [row.id, row])).values()].sort(
      (first, second) => first.date.localeCompare(second.date),
    );
    const expenses = sum(records.filter((row) => row.type === 'expense').map((row) => row.amount));
    const income = sum(records.filter((row) => row.type === 'income').map((row) => row.amount));
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${start}T12:00:00Z`));
    return {
      answer: records.length
        ? `Para ${month}, encontrei ${records.length} lançamentos previstos: ${formatMoney(expenses)} em gastos e ${formatMoney(income)} em entradas.`
        : `Não encontrei lançamentos previstos nem recorrências ativas para ${month}.`,
      calculation: [
        `Gastos previstos: ${formatMoney(expenses)}.`,
        `Entradas previstas: ${formatMoney(income)}.`,
        `Diferença projetada nos registros: ${formatMoney(income - expenses)}. Isso não é saldo bancário.`,
        `${planned.length} lançamento(s) já anotado(s) e ${recurring.length} ocorrência(s) de recorrências ativas.`,
      ],
      records,
      goals: [],
    };
  }
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
    /\b(?:na|no|com|em)\s+(?!(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4})\b)([^?]+?)(?=\s+(?:hoje|ontem|nos ultimos|no mes|este mes|neste mes|mes passado|em |ano passado)|[?]|$)/,
  )?.[1];
  const merchantFilter =
    !category && !accounts.length && merchant && !/\b(mes|ano|hoje|ontem|conta|ultimos|dias)\b/.test(merchant)
      ? merchantKey(merchant)
      : null;
  const merchantTerms =
    merchantFilter
      ?.split(/\s+ou\s+/)
      .map(merchantKey)
      .filter(Boolean) ?? [];
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
  const allHistory = !period.explicit && merchantTerms.length > 0 && /\b(?:tive|houve)\b/.test(normalized);
  const records = data.transactions.filter(
    (row) =>
      row.status === 'paid' &&
      row.type === type &&
      (allHistory ? row.date <= today : row.date >= start) &&
      row.date <= end &&
      (!category || row.category === category) &&
      (!accounts.length || row.account_id === accounts[0].id) &&
      (!merchantTerms.length ||
        merchantTerms.some((term) => merchantKey(`${row.description} ${row.category}`).includes(term))),
  );
  const total = sum(records.map((row) => row.amount));
  const periodLabel = allHistory ? 'no seu histórico' : formatPeriod(start, end, today);
  const description = type === 'income' ? 'entradas recebidas' : 'gastos pagos';
  return {
    answer: records.length
      ? `Você anotou ${formatMoney(total)} em ${description} ${periodLabel}.`
      : `Não encontrei ${description} ${periodLabel}.`,
    calculation: [
      `${records.length} ${type === 'income' ? 'entradas' : 'gastos'} considerados.`,
      'Previsões não entram nesse total.',
      ...(category ? [`Categoria: ${category}.`] : []),
      ...(accounts.length ? [`Conta: ${accounts[0].name}.`] : []),
    ],
    records,
    goals: [],
  };
}
