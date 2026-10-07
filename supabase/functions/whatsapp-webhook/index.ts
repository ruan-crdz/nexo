import { z } from 'zod';
import { merchantKey } from '../../../shared/financial-decisions.ts';
import { admin, env, HttpError, json } from '../_shared/http.ts';
import {
  downloadMedia,
  hashToken,
  deliverReply,
  deliverImageReply,
  cacheImageReply,
  retryWhatsAppReply,
  showTypingIndicator,
  verifySignature,
} from '../_shared/whatsapp.ts';
import { parseLinkingCode, whatsappWelcome } from '../../../shared/whatsapp-link.ts';
import { transcribe, readReceipt } from '../_shared/openai.ts';
import { civilDate, formatMoney } from '../../../shared/financial-engine.ts';
import { chatWithWhatsApp } from '../_shared/whatsapp-chat.ts';

const messageSchema = z.object({
  id: z.string().min(1).max(300),
  from: z.string().regex(/^\d{8,15}$/),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.object({ body: z.string().max(4000) }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
  document: z
    .object({ id: z.string(), mime_type: z.string().optional(), filename: z.string().max(255).optional() })
    .optional(),
});
const webhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                metadata: z.object({ phone_number_id: z.string() }).optional(),
                messages: z.array(messageSchema).max(20).optional(),
                statuses: z
                  .array(
                    z.object({
                      id: z.string().max(300),
                      status: z.enum(['sent', 'delivered', 'read', 'failed']),
                      errors: z.array(z.object({ code: z.number().int() })).optional(),
                    }),
                  )
                  .max(100)
                  .optional(),
              }),
            }),
          )
          .max(20),
      }),
    )
    .max(20),
});
type Message = z.infer<typeof messageSchema>;
function whatsappDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
async function processMessage(message: Message) {
  const db = admin();
  const claim = await db.rpc('claim_whatsapp', { message_key: message.id });
  if (claim.error) throw new HttpError(503, 'Não foi possível receber a mensagem.');
  if (!claim.data) {
    await retryWhatsAppReply(message.id, message.from);
    return;
  }
  let committed = false;
  let messagePoints = 0;
  let showPoints = false;
  async function finish(reply: string, userId?: string) {
    if (showPoints && messagePoints > 0)
      reply += `\n\n🌱 +${messagePoints} pontos de hábito (não são dinheiro nem crédito).`;
    const result = await db
      .from('whatsapp_messages_metadata')
      .update({ state: 'complete', reply, user_id: userId ?? null, updated_at: new Date().toISOString() })
      .eq('message_id', message.id);
    if (result.error) throw new Error('metadata');
    committed = true;
    await deliverReply(message.id, message.from, reply);
  }
  async function finishImage(
    image: Uint8Array,
    caption: string,
    userId: string,
    mimeType: 'image/png' | 'image/jpeg',
  ) {
    let reply = caption;
    if (showPoints && messagePoints > 0)
      reply += `\n\n🌱 +${messagePoints} pontos de hábito (não são dinheiro nem crédito).`;
    await cacheImageReply(message.id, image, mimeType);
    const stored = await db
      .from('whatsapp_messages_metadata')
      .update({
        state: 'complete',
        reply,
        reply_kind: 'image',
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('message_id', message.id);
    if (stored.error) throw new HttpError(503, 'Não foi possível registrar a resposta visual.');
    committed = true;
    await deliverImageReply(message.id, message.from, image, reply, mimeType);
  }
  try {
    let text = message.text?.body?.trim() ?? '';
    const linkingCode = parseLinkingCode(text);
    if (linkingCode) {
      const link = await db.rpc('link_whatsapp', {
        hash: await hashToken(linkingCode),
        sender: message.from,
      });
      if (link.error) throw new Error('link');
      await finish(
        link.data
          ? whatsappWelcome
          : 'Esse código de conexão já expirou ou foi usado. No app, abra Você → WhatsApp e gere um novo código.',
        link.data ?? undefined,
      );
      return;
    }
    const connection = await db
      .from('whatsapp_connections')
      .select('user_id,consent_at')
      .eq('phone', message.from)
      .maybeSingle();
    if (connection.error) throw new Error('connection');
    if (!connection.data?.consent_at) {
      await finish(
        'Para proteger seus dados, conecte sua conta antes de enviar informações financeiras. No app, abra Você → WhatsApp e toque em “Conectar meu WhatsApp”.',
      );
      return;
    }
    const userId = connection.data.user_id;
    const rate = await db.rpc('consume_rate_limit', {
      subject: userId,
      bucket_name: 'whatsapp',
      max_requests: 15,
    });
    if (rate.error || !rate.data) {
      await finish('Recebi várias mensagens seguidas. Aguarde um minuto e tente de novo.', userId);
      return;
    }
    await showTypingIndicator(message.id);
    const profile = await db
      .from('profiles')
      .select('timezone,show_journey_points,monthly_income')
      .eq('id', userId)
      .single();
    if (profile.error) throw new Error('profile');
    if (['text', 'audio', 'image', 'document'].includes(message.type)) {
      const award = await db.rpc('award_habit_for', {
        owner: userId,
        event_kind: 'message',
        event_key: `wa:${message.id}`,
      });
      if (award.error) throw new HttpError(503, 'Não foi possível registrar o hábito.');
      messagePoints = Number(award.data);
      showPoints = profile.data.show_journey_points;
    }
    if (message.type === 'audio' && message.audio)
      text = await transcribe(await downloadMedia(message.audio.id), userId);
    const receiptMedia =
      message.type === 'image' && message.image
        ? await downloadMedia(message.image.id)
        : message.type === 'document' && message.document
          ? await downloadMedia(message.document.id)
          : null;
    if (receiptMedia) {
      if (
        message.type === 'document' &&
        message.document?.mime_type?.split(';')[0] !== 'application/pdf' &&
        !message.document?.filename?.toLowerCase().endsWith('.pdf')
      ) {
        await finish(
          'Consigo ler recibos por foto ou PDF. Envie a imagem da nota ou um arquivo PDF.',
          userId,
        );
        return;
      }
      const receipt = await readReceipt(
        receiptMedia,
        profile.data.timezone,
        userId,
        new Date(Number(message.timestamp) * 1000),
      );
      const learned = await db.from('category_preferences').select('merchant,category').eq('user_id', userId);
      if (learned.error) throw new HttpError(503, 'Não foi possível conferir preferências.');
      for (const row of receipt.transactions) {
        const preference = learned.data.find((item) => item.merchant === merchantKey(row.description));
        if (preference) row.category = preference.category;
      }
      if (!receipt.transactions.length) {
        await finish(
          receipt.parsed.clarification ??
            'Não consegui identificar o valor e a data com segurança. Tente uma foto mais nítida ou me envie esses dados por texto.',
          userId,
        );
        return;
      }
      const reply = `Encontrei isto no recibo, mas ainda não salvei:\n${receipt.transactions.map((row) => `• ${row.description} · ${whatsappDate(row.date)} · ${formatMoney(row.amount)}`).join('\n')}\n\nSe estiver certo, envie “confirmar” em até 10 minutos. Vou deixar como pendente; marque como pago no app só depois de conferir. A foto não confirma o pagamento.`;
      const pending = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId, state: 'pending', pending_payload: receipt.transactions, reply })
        .eq('message_id', message.id);
      if (pending.error) throw new HttpError(503, 'Não foi possível preparar revisão.');
      committed = true;
      await deliverReply(message.id, message.from, reply);
      return;
    }
    if (!text) {
      await finish(
        message.type === 'image'
          ? 'Não consegui abrir essa foto. Tente outra mais nítida, mostre a nota inteira ou envie um PDF.'
          : message.type === 'document'
            ? 'Envie um PDF da nota ou uma foto mostrando o recibo inteiro.'
            : 'Pode me mandar uma mensagem de texto ou áudio. Para ler um recibo, envie uma foto ou PDF.',
        userId,
      );
      return;
    }
    if (message.type === 'text' || message.type === 'audio') {
      const owned = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId })
        .eq('message_id', message.id);
      if (owned.error) throw new HttpError(503, 'Não consegui iniciar a conversa.');
      let visual: { image: Uint8Array; mime: 'image/png' | 'image/jpeg' } | undefined;
      const typingRefresh = setInterval(() => void showTypingIndicator(message.id), 20000);
      try {
        const reply = await chatWithWhatsApp(text, {
          userId,
          phone: message.from,
          messageId: message.id,
          today: civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone),
          onCommit: () => {
            committed = true;
          },
          onImage: (image, mime) => {
            visual = { image, mime };
          },
        });
        if (visual) await finishImage(visual.image, reply, userId, visual.mime);
        else await finish(reply, userId);
      } finally {
        clearInterval(typingRefresh);
      }
      return;
    }
  } catch {
    // Never retry a committed financial write. External delivery failure is kept
    // as metadata for operator reconciliation, without logging financial content.
    if (!committed) {
      await db
        .from('whatsapp_messages_metadata')
        .update({ state: 'failed', updated_at: new Date().toISOString() })
        .eq('message_id', message.id);
      try {
        await deliverReply(
          message.id,
          message.from,
          'Não consegui concluir esse pedido. Nenhuma alteração foi confirmada. Confira seus registros antes de tentar novamente.',
        );
      } catch {
        console.error(JSON.stringify({ event: 'whatsapp_failure_notice_failed' }));
      }
    }
    console.error(JSON.stringify({ event: 'whatsapp_failure', stage: committed ? 'reply' : 'processing' }));
    throw new HttpError(503, 'Falha no processamento.');
  }
}
Deno.serve(async (request) => {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (
        url.searchParams.get('hub.mode') === 'subscribe' &&
        url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN')
      )
        return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
      return new Response('Forbidden', { status: 403 });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (Number(request.headers.get('content-length') ?? 0) > 1_000_000)
      throw new HttpError(413, 'Payload muito grande.');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1_000_000) throw new HttpError(413, 'Payload muito grande.');
    if (!(await verifySignature(raw, request.headers.get('x-hub-signature-256'))))
      throw new HttpError(401, 'Assinatura inválida.');
    const payload = webhookSchema.parse(JSON.parse(raw));
    for (const entry of payload.entry)
      for (const change of entry.changes) {
        if (
          change.value.messages?.length &&
          change.value.metadata?.phone_number_id !== env('WHATSAPP_PHONE_NUMBER_ID')
        )
          throw new HttpError(403, 'Número de destino inválido.');
        for (const message of change.value.messages ?? []) await processMessage(message);
        if (change.value.metadata?.phone_number_id === env('WHATSAPP_PHONE_NUMBER_ID')) {
          for (const status of change.value.statuses ?? []) {
            // A late receipt must not downgrade a message already delivered/read.
            const allowed =
              status.status === 'read'
                ? ['accepted', 'delivered', 'failed', 'reconcile']
                : status.status === 'delivered'
                  ? ['accepted', 'failed', 'reconcile']
                  : ['accepted', 'reconcile'];
            const updated = await admin()
              .from('whatsapp_messages_metadata')
              .update({
                delivery_status: status.status === 'sent' ? 'accepted' : status.status,
                reply_error_code: status.status === 'failed' ? (status.errors?.[0]?.code ?? null) : null,
              })
              .eq('reply_message_id', status.id)
              .in('delivery_status', allowed);
            if (updated.error) throw new HttpError(503, 'Não foi possível atualizar a entrega.');
            const notification = await admin()
              .from('financial_notifications')
              .update({
                state: status.status === 'sent' ? 'accepted' : status.status,
                error_code: status.status === 'failed' ? (status.errors?.[0]?.code ?? null) : null,
                updated_at: new Date().toISOString(),
              })
              .eq('reply_message_id', status.id)
              .in('state', allowed);
            if (notification.error) throw new HttpError(503, 'Não foi possível atualizar o aviso.');
          }
        }
      }
    return json({ received: true });
  } catch (error) {
    return json({ error: 'Webhook não processado.' }, error instanceof HttpError ? error.status : 400);
  }
});
