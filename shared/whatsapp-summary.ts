import type { Transaction } from './domain.ts';
import { formatMoney } from './financial-engine.ts';
import { monthlyFlow } from './insights.ts';

export function isSummaryRequest(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return (
    /^(?:resumo|saldo|meu resumo|meu saldo|como esta meu mes|quanto (?:gastei|recebi|sobrou)(?: (?:este|esse|nesse|neste|desse|deste) mes)?)[?.!]*$/i.test(
      normalized,
    ) ||
    /^(?:gere|gera|crie|cria|faca|faz|mostre|me mostre)\b.*\b(?:grafico|imagem|foto)\b.*\b(?:resumo|mes)\b/i.test(
      normalized,
    )
  );
}
export function whatsappDeliveryNotice(status: string | null, messageState: string | null) {
  if (status !== 'failed') return null;
  if (messageState === 'complete')
    return 'Recebi sua mensagem, mas não consegui entregar a resposta pelo WhatsApp. Confira o Histórico no app antes de tentar de novo, para evitar duplicar o registro.';
  if (messageState === 'pending')
    return 'Preparei uma anotação para você conferir, mas não consegui entregar a resposta pelo WhatsApp. Não confirme sem ver os dados primeiro.';
  return 'Não consegui entregar a resposta pelo WhatsApp. Confira o Histórico no app antes de enviar de novo.';
}

export function whatsappMonthSummary(rows: Transaction[], today: string) {
  const flow = monthlyFlow(
    rows.filter((t) => t.date <= today),
    today.slice(0, 7),
  );
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${today.slice(0, 7)}-01T12:00:00Z`),
  );
  const difference =
    flow.net < 0
      ? `Saíram ${formatMoney(Math.abs(flow.net))} a mais do que entrou.`
      : `Entraram ${formatMoney(flow.net)} a mais do que saiu.`;
  return (
    `Resumo de ${month}, até hoje:\n\n` +
    `Entrou: ${formatMoney(flow.income)}\n` +
    `Saiu: ${formatMoney(flow.expenses)}\n` +
    `${difference}\n\n` +
    (flow.count === 0 ? 'Ainda não há registros pagos ou recebidos neste mês.\n\n' : '') +
    'Este resumo considera o que você anotou; não representa o saldo da sua conta.\n' +
    'Para conferir ou corrigir, abra Histórico no app.'
  );
}
