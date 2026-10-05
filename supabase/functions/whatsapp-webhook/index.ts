import { z } from 'zod';
import { goalSchema } from '../../../shared/domain.ts';
import { isVerifiedQuestion, verifiedReply } from '../../../shared/planning.ts';
import { admin, env, HttpError, json } from '../_shared/http.ts';
import { downloadAudio, hashToken, deliverReply, verifySignature } from '../_shared/whatsapp.ts';
import { parseLinkingCode, whatsappWelcome } from '../../../shared/whatsapp-link.ts';
import { parseTransaction, transcribe } from '../_shared/openai.ts';
import { civilDate, formatMoney } from '../../../shared/financial-engine.ts';
import { transactionSchema } from '../../../shared/domain.ts';
import { isSummaryRequest, whatsappMonthSummary } from '../../../shared/whatsapp-summary.ts';

const messageSchema = z.object({
  id: z.string().min(1).max(300),
  from: z.string().regex(/^\d{8,15}$/),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.object({ body: z.string().max(4000) }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
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
async function processMessage(message: Message) {
  const db = admin();
  const claim = await db.rpc('claim_whatsapp', { message_key: message.id });
  if (claim.error) throw new HttpError(503, 'Não foi possível receber a mensagem.');
  if (!claim.data) {
    const previous = await db
      .from('whatsapp_messages_metadata')
      .select('state,reply,sent_at')
      .eq('message_id', message.id)
      .single();
    if (
      previous.data?.reply &&
      !previous.data.sent_at &&
      ['complete', 'pending'].includes(previous.data.state)
    ) {
      await deliverReply(message.id, message.from, previous.data.reply);
    }
    return;
  }
  let committed = false;
  async function finish(reply: string, userId?: string) {
    const result = await db
      .from('whatsapp_messages_metadata')
      .update({ state: 'complete', reply, user_id: userId ?? null, updated_at: new Date().toISOString() })
      .eq('message_id', message.id);
    if (result.error) throw new Error('metadata');
    committed = true;
    await deliverReply(message.id, message.from, reply);
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
          : 'Esse código já foi usado ou expirou. Abra o Nexo → WhatsApp e toque em “Conectar meu WhatsApp” para gerar uma nova mensagem.',
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
      await finish('Vincule sua conta em Nexo → WhatsApp antes de enviar dados financeiros.');
      return;
    }
    const userId = connection.data.user_id;
    const rate = await db.rpc('consume_rate_limit', {
      subject: userId,
      bucket_name: 'whatsapp',
      max_requests: 15,
    });
    if (rate.error || !rate.data) {
      await finish('Vamos com calma. Aguarde um minuto para enviar a próxima mensagem.', userId);
      return;
    }
    const profile = await db.from('profiles').select('timezone').eq('id', userId).single();
    if (profile.error) throw new Error('profile');
    if (message.type === 'audio' && message.audio)
      text = await transcribe(await downloadAudio(message.audio.id));
    if (!text) {
      await finish(
        'Nesta versão, envie texto ou áudio. Recibos em imagem ainda não são interpretados.',
        userId,
      );
      return;
    }
    if (/^(?:ajuda|menu|oi|ola|olá|tutorial)[!.\s]*$/i.test(text)) {
      await finish(whatsappWelcome, userId);
      return;
    }
    if (isSummaryRequest(text)) {
      const today = civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone);
      const rows = await db
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', `${today.slice(0, 7)}-01`)
        .lte('date', today)
        .limit(5000);
      if (rows.error || rows.data.length >= 5000)
        throw new HttpError(503, 'Não foi possível conferir todas as anotações.');
      await finish(whatsappMonthSummary(transactionSchema.array().parse(rows.data), today), userId);
      return;
    }
    if (isVerifiedQuestion(text)) {
      const [rows, goals] = await Promise.all([
        db.from('transactions').select('*').eq('user_id', userId).limit(5000),
        db.from('goals').select('*').eq('user_id', userId).limit(1001),
      ]);
      if (rows.error || goals.error || rows.data.length >= 5000 || goals.data.length > 1000)
        throw new HttpError(503, 'Leitura incompleta da resposta.');
      const reply = verifiedReply(
        {
          transactions: transactionSchema.array().parse(rows.data),
          goals: goalSchema.array().parse(goals.data),
        },
        text,
        civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone),
      );
      if (!reply) throw new HttpError(422, 'Pergunta não reconhecida.');
      const lines = [
        reply.answer,
        'Cálculo:',
        ...reply.calculation.slice(0, 12),
        'Registros usados:',
        ...reply.records
          .slice(0, 8)
          .map((record) => `${record.description} · ${record.date} · ${formatMoney(record.amount)}`),
      ];
      if (reply.records.length > 8 || reply.calculation.length > 12)
        lines.push(
          'Há mais detalhes. Veja o cálculo completo e todos os registros em Perguntar ao Nexo no app.',
        );
      await finish(lines.join('\n'), userId);
      return;
    }
    if (/^desfazer$/i.test(text)) {
      const undone = await db.rpc('undo_whatsapp', { owner: userId });
      if (undone.error) throw new Error('undo');
      await finish(
        undone.data
          ? 'Último registro por WhatsApp desfeito. Seu app já foi atualizado.'
          : 'Não encontrei registro recente para desfazer.',
        userId,
      );
      return;
    }
    if (/^confirmar$/i.test(text)) {
      const pending = await db
        .from('whatsapp_messages_metadata')
        .select('message_id,pending_payload')
        .eq('user_id', userId)
        .eq('state', 'pending')
        .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pending.error) throw new Error('pending');
      if (!pending.data) {
        await finish('Não há confirmação pendente. Envie novamente o registro completo.', userId);
        return;
      }
      const saved = await db.rpc('commit_whatsapp', {
        message_key: pending.data.message_id,
        owner: userId,
        payload: pending.data.pending_payload,
      });
      if (saved.error) throw new Error('commit');
      await finish(
        'Tudo certo, anotação salva! Você pode conferir em “Anotações” no app. Para cancelar, envie “desfazer”.',
        userId,
      );
      return;
    }
    const parsed = await parseTransaction(
      text,
      profile.data.timezone,
      new Date(Number(message.timestamp) * 1000),
    );
    if (parsed.parsed.intent === 'question') {
      await finish(
        'Posso anotar o que você gastou ou recebeu e mostrar seu resumo do mês.\n\nEnvie “resumo” para ver o que entrou, saiu e sobrou. Para conferir uma anotação específica, abra “Anotações” no app.\n\nNão salvei nenhuma anotação com esta pergunta.',
        userId,
      );
      return;
    }
    if (parsed.parsed.intent === 'unsupported') {
      await finish(
        'Ainda não faço esse tipo de pedido. Posso anotar gastos e entradas. Por exemplo: “Gastei 25 reais no almoço hoje”.\n\nPara ver o mês, envie “resumo”. Não salvei nenhuma anotação com esta mensagem.',
        userId,
      );
      return;
    }
    if (parsed.action === 'clarify') {
      await finish(
        parsed.parsed.clarification ??
          'Me conte o valor, com o que foi e quando aconteceu. Por exemplo: “Gastei 25 reais no almoço hoje”.',
        userId,
      );
      return;
    }
    const details = parsed.transactions
      .map(
        (t) =>
          `${t.type === 'income' ? 'Entrada' : 'Gasto'}: ${formatMoney(t.amount)} · ${t.description} · ${t.date.split('-').reverse().join('/')}${t.status === 'planned' ? ' (ainda não aconteceu)' : ''}`,
      )
      .join('\n');
    if (parsed.action === 'confirm') {
      const reply = `Entendi assim:\n${details}\nEnvie “confirmar” em até dez minutos ou reenvie os dados corrigidos.`;
      const pending = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId, state: 'pending', pending_payload: parsed.transactions, reply })
        .eq('message_id', message.id);
      if (pending.error) throw new Error('pending');
      committed = true;
      await deliverReply(message.id, message.from, reply);
      return;
    }
    const saved = await db.rpc('commit_whatsapp', {
      message_key: message.id,
      owner: userId,
      payload: parsed.transactions,
    });
    if (saved.error) throw new Error('commit');
    committed = true;
    await finish(
      `Anotado!\n${details}\n\n${parsed.action === 'save-correctable' ? 'Confira se entendi direitinho. ' : ''}Você pode corrigir em “Anotações” no app. Para cancelar, envie “desfazer”.`,
      userId,
    );
  } catch {
    // Never retry a committed financial write. External delivery failure is kept
    // as metadata for operator reconciliation, without logging financial content.
    if (!committed)
      await db
        .from('whatsapp_messages_metadata')
        .update({ state: 'failed', updated_at: new Date().toISOString() })
        .eq('message_id', message.id);
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
                ? ['accepted', 'delivered', 'failed']
                : status.status === 'delivered'
                  ? ['accepted', 'failed']
                  : ['accepted'];
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
