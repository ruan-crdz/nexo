import { parseWhatsAppAction } from '../../../shared/whatsapp-presentation.ts';
import { admin, HttpError } from './http.ts';
import { hashToken } from './whatsapp.ts';
import { executeChatTool } from './whatsapp-chat.ts';

type Context = Parameters<typeof executeChatTool>[2];
const expired =
  'Essa opção expirou ou já foi usada. Me diga o que você quer fazer para eu preparar uma nova revisão.';

/** Never ask the model to interpret a financial confirmation button. */
export async function handleWhatsAppAction(
  id: string,
  context: Context,
): Promise<{ reply?: string; text?: string }> {
  const action = parseWhatsAppAction(id);
  if (!action)
    return { reply: 'Não reconheci essa opção. Escreva ou mande um áudio contando o que precisa.' };
  if (action.kind === 'menu') {
    if (action.action === 'summary') return { text: 'Quanto entrou e quanto saiu neste mês?' };
    return {
      reply:
        action.action === 'record'
          ? 'O que você pagou e quanto custou?\n\nPode escrever ou mandar um áudio: “Paguei 35 reais na farmácia hoje”. Pode incluir vários gastos na mesma mensagem: eu registro e mando um resumo. Se faltar algum dado, eu pergunto.'
          : '*Seu dinheiro, sem complicação*\n\n• Mande texto ou áudio para anotar gastos e entradas, inclusive vários de uma vez.\n• Envie foto ou PDF para registrar um recibo.\n• Peça para consultar, corrigir ou excluir registros, metas e contas.\n\nPedidos claros são executados direto e eu mando um resumo. Se faltar informação ou houver dúvida sobre qual registro mudar, eu pergunto.',
    };
  }
  const db = admin();
  if (action.kind === 'proposal') {
    const pending = await db
      .from('whatsapp_chat_requests')
      .select('id')
      .eq('id', action.id)
      .eq('user_id', context.userId)
      .eq('state', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (pending.error) throw new HttpError(503, 'Não consegui conferir essa proposta.');
    if (!pending.data) return { reply: expired };
    if (action.action === 'edit')
      return {
        reply:
          'O que você quer corrigir? Pode escrever ou mandar um áudio com o novo valor, data ou descrição. Ainda não salvei essa alteração.',
      };
    const result = (await executeChatTool(
      action.action === 'confirm' ? 'confirm_change' : 'cancel_change',
      { proposal_id: action.id },
      context,
    )) as { error?: string; status?: string };
    if (result.error) return { reply: result.error };
    return {
      reply:
        action.action === 'cancel'
          ? result.status === 'cancelled'
            ? 'Pedido cancelado. Nenhuma alteração foi salva.'
            : expired
          : result.status === 'applied'
            ? 'Pronto! Alteração salva no Nexo. Você pode conferir no app ou me pedir para consultar.'
            : expired,
    };
  }
  const pending = await db
    .from('whatsapp_messages_metadata')
    .select('message_id,pending_payload')
    .eq('user_id', context.userId)
    .eq('state', 'pending')
    .gt('created_at', new Date(Date.now() - 600000).toISOString())
    .order('created_at', { ascending: false })
    .limit(150);
  if (pending.error) throw new HttpError(503, 'Não consegui conferir o recibo.');
  for (const receipt of pending.data) {
    if (!Array.isArray(receipt.pending_payload) || (await hashToken(receipt.message_id)) !== action.id)
      continue;
    if (action.action === 'cancel') {
      const result = await db
        .from('whatsapp_messages_metadata')
        .update({ state: 'complete', pending_payload: null })
        .eq('message_id', receipt.message_id)
        .eq('user_id', context.userId)
        .eq('state', 'pending')
        .select('message_id');
      if (result.error) throw new HttpError(503, 'Não consegui cancelar a revisão.');
      return { reply: result.data.length ? 'Revisão cancelada. Esse recibo não foi salvo.' : expired };
    }
    const result = await db.rpc('commit_whatsapp', {
      message_key: receipt.message_id,
      owner: context.userId,
      payload: receipt.pending_payload,
    });
    if (result.error) throw new HttpError(503, 'Não consegui salvar esse recibo.');
    if (!Array.isArray(result.data) || !result.data.length) return { reply: expired };
    context.onCommit();
    return {
      reply:
        'Recibo salvo no Nexo como pendente. Confira no app e marque como pago somente se o pagamento já aconteceu.',
    };
  }
  return { reply: expired };
}
