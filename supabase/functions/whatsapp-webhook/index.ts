import { z } from 'zod';
import { admin, env, HttpError, json } from '../_shared/http.ts';
import { downloadAudio, hashToken, sendText, verifySignature } from '../_shared/whatsapp.ts';
import { parseTransaction, transcribe } from '../_shared/openai.ts';
import { advise } from '../_shared/advice.ts';
import { formatMoney } from '../../../shared/financial-engine.ts';

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
      await sendText(message.from, previous.data.reply);
      await db
        .from('whatsapp_messages_metadata')
        .update({ sent_at: new Date().toISOString() })
        .eq('message_id', message.id);
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
    await sendText(message.from, reply);
    await db
      .from('whatsapp_messages_metadata')
      .update({ sent_at: new Date().toISOString() })
      .eq('message_id', message.id);
  }
  try {
    let text = message.text?.body?.trim() ?? '';
    if (/^vincular [a-f0-9]{32}$/i.test(text)) {
      const link = await db.rpc('link_whatsapp', {
        hash: await hashToken(text.split(' ')[1].toLowerCase()),
        sender: message.from,
      });
      if (link.error) throw new Error('link');
      await finish(
        link.data
          ? 'Conta vinculada. Envie “gastei 10 de coxinha”. Para desfazer o último registro, envie “desfazer”.'
          : 'Código inválido ou expirado. Gere outro no app.',
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
      await finish('Confirmado e registrado. Envie “desfazer” para cancelar o último registro.', userId);
      return;
    }
    const parsed = await parseTransaction(
      text,
      profile.data.timezone,
      new Date(Number(message.timestamp) * 1000),
    );
    if (parsed.parsed.intent === 'question') {
      const advice = await advise(db, userId, text);
      const sourceText = advice.sources.map((s) => `${s.title}: ${s.url}`).join('\n');
      await finish(
        `${advice.answer}\n\n${Object.entries(advice.metrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')}${sourceText ? `\n\nFontes:\n${sourceText}` : ''}`,
        userId,
      );
      return;
    }
    if (parsed.action === 'clarify') {
      await finish(
        parsed.parsed.clarification ??
          'Envie descrição, valor e data do movimento. Para metas, cartões e lembretes, use o app.',
        userId,
      );
      return;
    }
    const details = parsed.transactions
      .map((t) => `${formatMoney(t.amount)} · ${t.description} · ${t.date}`)
      .join('\n');
    if (parsed.action === 'confirm') {
      const reply = `Entendi assim:\n${details}\nEnvie “confirmar” em até dez minutos ou reenvie os dados corrigidos.`;
      const pending = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId, state: 'pending', pending_payload: parsed.transactions, reply })
        .eq('message_id', message.id);
      if (pending.error) throw new Error('pending');
      committed = true;
      await sendText(message.from, reply);
      await db
        .from('whatsapp_messages_metadata')
        .update({ sent_at: new Date().toISOString() })
        .eq('message_id', message.id);
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
      `Registrado:\n${details}\n${parsed.action === 'save-correctable' ? 'Confira a interpretação. ' : ''}Envie “desfazer” para cancelar o último registro ou edite no app.`,
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
      }
    return json({ received: true });
  } catch (error) {
    return json({ error: 'Webhook não processado.' }, error instanceof HttpError ? error.status : 400);
  }
});
