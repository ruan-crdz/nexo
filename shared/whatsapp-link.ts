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
  'Pode me mandar um texto ou áudio contando o que entrou ou saiu. Por exemplo:\n' +
  '• “Gastei 25 reais no almoço hoje”\n' +
  '• “Recebi 150 reais ontem”\n\n' +
  'Eu aviso o que entendi. Se faltar informação, pergunto; se houver dúvida, peço para você conferir.\n\n' +
  'Para ver o mês, envie “resumo”. Para cancelar o último registro, envie “desfazer” em até 24 horas.\n' +
  'Seus registros ficam em Histórico no app. Envie “ajuda” para ver estas opções.';
