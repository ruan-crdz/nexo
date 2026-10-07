export type WhatsAppButton = { id: string; title: string };

/** WhatsApp uses a single asterisk. Malformed emphasis is safer as plain text. */
export function formatWhatsAppText(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const normalized = line.replace(/\*{2,}/g, '*');
      const markers = [...normalized.matchAll(/\*/g)].filter((match) => {
        const index = match.index!;
        return !(normalized[index - 1] === ' ' && normalized[index + 1] === ' ');
      });
      const valid =
        markers.length % 2 === 0 &&
        markers.every((match, index) => {
          if (index % 2) return true;
          const content = normalized.slice(match.index! + 1, markers[index + 1].index);
          return content.length > 0 && content.trim() === content;
        });
      if (valid) return normalized;
      const positions = new Set(markers.map((match) => match.index));
      return normalized
        .split('')
        .filter((_, index) => !positions.has(index))
        .join('');
    })
    .join('\n');
}

export function proposalButtons(id: string): WhatsAppButton[] {
  return [
    { id: `nexo:confirm:${id}`, title: 'Confirmar' },
    { id: `nexo:edit:${id}`, title: 'Corrigir' },
    { id: `nexo:cancel:${id}`, title: 'Cancelar' },
  ];
}

export const welcomeButtons: WhatsAppButton[] = [
  { id: 'nexo:menu:record', title: 'Anotar gasto' },
  { id: 'nexo:menu:summary', title: 'Consultar meu mês' },
  { id: 'nexo:menu:help', title: 'Como usar' },
];

export function parseWhatsAppAction(id: string) {
  const proposal =
    /^nexo:(confirm|edit|cancel):([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(id);
  if (proposal) return { kind: 'proposal' as const, action: proposal[1], id: proposal[2] };
  const receipt = /^nexo:receipt-(confirm|cancel):([a-f0-9]{64})$/.exec(id);
  if (receipt) return { kind: 'receipt' as const, action: receipt[1], id: receipt[2] };
  const menu = /^nexo:menu:(record|summary|help)$/.exec(id);
  return menu ? { kind: 'menu' as const, action: menu[1], id: '' } : null;
}

export function whatsAppMessageContent(text: string, buttons: WhatsAppButton[] = []) {
  const body = formatWhatsAppText(text);
  if (!buttons.length || body.length > 1024)
    return { type: 'text', text: { body: formatWhatsAppText(body.slice(0, 4000)) } };
  if (
    buttons.length > 3 ||
    new Set(buttons.map((button) => button.id)).size !== buttons.length ||
    new Set(buttons.map((button) => button.title)).size !== buttons.length ||
    buttons.some(
      (button) => !button.id || button.id.length > 256 || !button.title || button.title.length > 20,
    )
  )
    throw new Error('Botões inválidos para o WhatsApp.');
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      footer: { text: 'Nexo • Você também pode responder por texto ou áudio' },
      action: { buttons: buttons.map((reply) => ({ type: 'reply', reply })) },
    },
  };
}
