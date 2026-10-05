export function linkingMessage(code: string) {
  if (!/^[a-f0-9]{32}$/i.test(code)) throw new Error('Código de vínculo inválido.');
  return `Olá Nexo, meu código de vinculação é ${code.toLowerCase()}`;
}

export function parseLinkingCode(text: string): string | null {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const match = normalized.match(
    /^(?:vincular|(?:ola\s+nexo[,!]?\s+)?meu\s+codigo\s+de\s+vinculacao\s+(?:e|:))\s*([a-f0-9]{32})[.!]?$/i,
  );
  return match?.[1].toLowerCase() ?? null;
}

export function whatsappUrl(phone: string, message?: string) {
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Número do WhatsApp inválido.');
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export const whatsappWelcome =
  'Tudo certo, seu WhatsApp está conectado ao Nexo! 🌿\n\n' +
  'Seu dinheiro, do seu jeito: envie uma mensagem ou um áudio contando o que entrou ou saiu.\n\n' +
  '💬 “Gastei 25 reais no almoço hoje.”\n' +
  '🎙️ “Recebi 150 reais de um trabalho ontem.”\n\n' +
  'Eu organizo os lançamentos na sua conta pessoal e te respondo com um resumo. Se faltar informação, eu pergunto antes.\n\n' +
  '↩️ Algo ficou errado? Envie “desfazer” para cancelar o último lote registrado nas últimas 24 horas, ou edite no app.\n' +
  '💡 Envie “ajuda” para ver estas dicas de novo.\n\n' +
  'Vamos começar? Me conte seu primeiro movimento.';
