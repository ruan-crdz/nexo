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
  '*Seu WhatsApp está conectado!* 🌿\n\n' +
  'Sou o Nexo. Vou ajudar você a anotar gastos, acompanhar seu dinheiro e cuidar das suas Caixinhas.\n\n' +
  'Toque em *Ver opções* para começar. Ou mande um texto ou áudio, como: “Paguei 35 reais na farmácia hoje”.\n\n' +
  'Pedidos completos são salvos direto. Se faltar alguma informação, eu pergunto. Seus registros ficam disponíveis no app.\n\n' +
  'O que deseja fazer a seguir?';
