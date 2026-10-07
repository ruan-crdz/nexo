export function linkingMessage(code: string) {
  if (!/^[a-f0-9]{32}$/i.test(code)) throw new Error('Código de vínculo inválido.');
  return `Olá Nexo, meu código de vinculação é ${code.toLowerCase()}`;
}

export function parseLinkingCode(text: string): string | null {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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
  'Oi! Seu WhatsApp está conectado ao Nexo 🌿\n\n' +
  'Pode conversar comigo por texto ou áudio sobre seus registros, contas, metas e perfil.\n\n' +
  'Pedidos claros são executados direto, inclusive vários de uma vez. Se faltar informação ou houver dúvida sobre qual registro mudar, eu pergunto. Depois, mando um resumo do que foi feito.\n\n' +
  'A conversa e as propostas ficam disponíveis por dez minutos. Seus registros continuam em Histórico no app.';
