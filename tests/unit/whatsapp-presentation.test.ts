import { describe, it, expect } from 'vitest';
import {
  formatWhatsAppText,
  whatsAppMessageContent,
  proposalButtons,
  parseWhatsAppAction,
} from '../../shared/whatsapp-presentation';

describe('mensagens nativas do WhatsApp', () => {
  it('converte Markdown e preserva negrito válido, acentos, emojis e multiplicação', () => {
    expect(formatWhatsAppText('Seu nome é **Ruan**.')).toBe('Seu nome é *Ruan*.');
    expect(formatWhatsAppText('Seu nome é *Ruan*.')).toBe('Seu nome é *Ruan*.');
    expect(formatWhatsAppText('🌿 **Serviços**\n2 * 3 = 6')).toBe('🌿 *Serviços*\n2 * 3 = 6');
  });
  it('recupera a mensagem real com delimitadores quebrados sem alterar valor ou data', () => {
    const broken =
      'Proponho cadastrar a conta recorrente de internet por *R$ 156,00, na categoria **Serviços, com vencimento todo dia 20, a partir de **20/10/2026*. Ainda não foi cadastrada. Posso confirmar?';
    const formatted = formatWhatsAppText(broken);
    expect(formatted).toBe(broken.replaceAll('*', ''));
    expect(formatWhatsAppText(formatted)).toBe(formatted);
    expect(formatWhatsAppText('🌿 Valor **156')).toBe('🌿 Valor 156');
  });
  it('envia escolhas vinculadas à proposta e reconhece somente IDs conhecidos', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    const buttons = proposalButtons(id);
    const message = whatsAppMessageContent('Valor: **R$ 156,00**\nPosso salvar?', buttons);
    expect(message.type).toBe('interactive');
    expect(message.interactive?.body.text).toContain('*R$ 156,00*');
    expect(message.interactive?.action.buttons?.map((button) => button.reply.title)).toEqual([
      'Confirmar',
      'Corrigir',
      'Cancelar',
    ]);
    expect(parseWhatsAppAction(buttons[0].id)).toEqual({ kind: 'proposal', action: 'confirm', id });
    expect(parseWhatsAppAction('confirmar')).toBeNull();
    expect(parseWhatsAppAction('nexo:confirm:inventado')).toBeNull();
  });
  it('não corta uma revisão para encaixar botões', () => {
    const text = 'x'.repeat(1100);
    const message = whatsAppMessageContent(text, proposalButtons('id'));
    expect(message.type).toBe('text');
    expect(message.text?.body).toBe(text);
  });
});
