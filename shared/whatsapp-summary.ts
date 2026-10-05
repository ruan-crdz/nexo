import type { Transaction } from './domain.ts';
import { formatMoney } from './financial-engine.ts';
import { monthlyFlow } from './insights.ts';

export function isSummaryRequest(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return /^(?:resumo|saldo|meu resumo|meu saldo|como esta meu mes|quanto (?:gastei|recebi|sobrou)(?: (?:este|nesse|neste) mes)?)[?.!]*$/i.test(
    normalized,
  );
}

export function whatsappMonthSummary(rows: Transaction[], today: string) {
  const flow = monthlyFlow(
    rows.filter((t) => t.date <= today),
    today.slice(0, 7),
  );
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${today.slice(0, 7)}-01T12:00:00Z`),
  );
  return (
    `Seu resumo de ${month}, até agora:\n\n` +
    `Entrou: ${formatMoney(flow.income)}\n` +
    `Saiu: ${formatMoney(flow.expenses)}\n` +
    `${flow.net < 0 ? 'Faltou' : 'Sobrou'} no mês: ${formatMoney(Math.abs(flow.net))}\n\n` +
    (flow.count === 0 ? 'Você ainda não tem anotações pagas ou recebidas neste mês.\n\n' : '') +
    'Esse resumo usa suas anotações. Não é o saldo da sua conta bancária.\n' +
    'Para conferir ou corrigir, abra “Anotações” no app.'
  );
}
