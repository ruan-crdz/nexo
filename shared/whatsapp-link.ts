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
  'Tudo certo, seu WhatsApp está conectado ao Nexo! 🌿\n\n' +
  'Pode escrever ou mandar um áudio contando o que gastou ou recebeu. Por exemplo:\n\n' +
  '💬 “Gastei 25 reais no almoço hoje.”\n' +
  '🎙️ “Recebi 150 reais ontem.”\n\n' +
  'Eu anoto no seu Nexo e te aviso quando estiver salvo. Se faltar informação, eu pergunto.\n\n' +
  'Para conferir ou corrigir, abra “Anotações” no app.\n' +
  'Quer saber como está o mês? Envie “resumo”.\n' +
  'Se quiser cancelar as anotações da sua última mensagem, envie “desfazer” em até 24 horas.\n\n' +
  'Envie “ajuda” sempre que precisar destas dicas. Vamos começar?';
