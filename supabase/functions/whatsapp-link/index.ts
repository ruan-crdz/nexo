import { z } from 'zod';
import { authenticate, body, env, json, serve, HttpError } from '../_shared/http.ts';
import { hashToken } from '../_shared/whatsapp.ts';
import { linkingMessage, whatsappUrl } from '../../../shared/whatsapp-link.ts';
serve(async (request) => {
  const { user, service } = await authenticate(request, 'whatsapp-link');
  const { action } = z.object({ action: z.enum(['create', 'status']).default('create') }).parse(await body(request));
  const businessPhone = env('WHATSAPP_BUSINESS_PHONE');
  const chatUrl = whatsappUrl(businessPhone);
  if (action === 'status') {
    const connection = await service.from('whatsapp_connections').select('phone,consent_at')
      .eq('user_id', user.id).maybeSingle();
    const latest = await service.from('whatsapp_messages_metadata')
      .select('sent_at,delivery_status,reply_error_code').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (connection.error || latest.error) throw new HttpError(503, 'Não foi possível conferir a conexão.');
    return json({
      connected: Boolean(connection.data?.phone && connection.data.consent_at),
      phone_last_four: connection.data?.phone?.slice(-4) ?? null,
      chat_url: chatUrl,
      delivery_status: latest.data?.delivery_status ?? (latest.data?.sent_at ? 'accepted' : null),
      reply_error_code: latest.data?.reply_error_code ?? null,
    });
  }
  const token = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error } = await service
    .from('whatsapp_connections')
    .upsert({ user_id: user.id, token_hash: await hashToken(token), token_expires_at: expires });
  if (error) throw new HttpError(503, 'Não foi possível criar o vínculo.');
  const message = linkingMessage(token);
  return json({
    code: token,
    expires_at: expires,
    message,
    whatsapp_url: whatsappUrl(businessPhone, message),
  });
});
