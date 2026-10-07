import { admin, env, HttpError, safeFetch } from './http.ts';

export class WhatsAppAmbiguousDeliveryError extends HttpError {
  constructor() {
    super(502, 'O resultado do envio precisa ser reconciliado antes de tentar novamente.');
  }
}

export class WhatsAppDeliveryError extends HttpError {
  constructor(public code: number | null) {
    super(
      502,
      code === 131030
        ? 'Seu celular precisa ser autorizado como destinatário de teste na Meta.'
        : 'Não foi possível entregar a resposta no WhatsApp.',
    );
  }
}

export async function verifySignature(raw: string, signature: string | null): Promise<boolean> {
  if (!signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.slice(7).match(/.{2}/g)!, (hex) => parseInt(hex, 16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('WHATSAPP_APP_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(raw));
}
export async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function graphUrl(path: string) {
  const version = env('WHATSAPP_GRAPH_VERSION');
  if (!/^v\d+\.\d+$/.test(version)) throw new HttpError(503, 'Configure uma versão válida da Graph API.');
  return `https://graph.facebook.com/${version}/${path}`;
}
export async function showTypingIndicator(messageId: string) {
  try {
    const response = await fetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      console.error(JSON.stringify({ event: 'whatsapp_typing_indicator_failed', status: response.status }));
  } catch {
    console.error(JSON.stringify({ event: 'whatsapp_typing_indicator_failed', status: 'network' }));
  }
}
export async function sendText(phone: string, text: string) {
  if (!/^\d{8,15}$/.test(phone)) throw new HttpError(400, 'Número inválido.');
  const response = await fetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text.slice(0, 4000) },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (response.status >= 500) throw new WhatsAppAmbiguousDeliveryError();
  const result = await response.json();
  if (response.ok && !result.messages?.[0]?.id) throw new WhatsAppAmbiguousDeliveryError();
  if (!response.ok || !result.messages?.[0]?.id) {
    const code = Number.isInteger(result.error?.code) ? result.error.code : null;
    console.error(JSON.stringify({ event: 'whatsapp_delivery_failed', code, status: response.status }));
    throw new WhatsAppDeliveryError(code);
  }
  return result.messages[0].id as string;
}

export async function sendImage(
  phone: string,
  image: Uint8Array,
  caption: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
) {
  if (!/^\d{8,15}$/.test(phone)) throw new HttpError(400, 'Número inválido.');
  if (!image.length || image.length > 5_000_000) throw new HttpError(413, 'A imagem precisa ter até 5 MB.');
  const form = new FormData();
  const imageBuffer = new ArrayBuffer(image.byteLength);
  new Uint8Array(imageBuffer).set(image);
  form.set('messaging_product', 'whatsapp');
  form.set('type', mimeType);
  form.set(
    'file',
    new Blob([imageBuffer], { type: mimeType }),
    mimeType === 'image/png' ? 'nexo.png' : 'nexo.jpg',
  );
  const upload = await fetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/media`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  const uploaded = await upload.json();
  if (!upload.ok || typeof uploaded.id !== 'string') {
    const code = Number.isInteger(uploaded.error?.code) ? uploaded.error.code : null;
    console.error(JSON.stringify({ event: 'whatsapp_image_upload_failed', code, status: upload.status }));
    throw new WhatsAppDeliveryError(code);
  }
  let response: Response;
  try {
    response = await fetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'image',
        image: { id: uploaded.id, caption: caption.slice(0, 1024) },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new WhatsAppAmbiguousDeliveryError();
  }
  if (response.status >= 500) throw new WhatsAppAmbiguousDeliveryError();
  let result;
  try {
    result = await response.json();
  } catch {
    throw new WhatsAppAmbiguousDeliveryError();
  }
  if (!response.ok) {
    const code = Number.isInteger(result.error?.code) ? result.error.code : null;
    console.error(JSON.stringify({ event: 'whatsapp_image_delivery_failed', code, status: response.status }));
    throw new WhatsAppDeliveryError(code);
  }
  if (!result.messages?.[0]?.id) throw new WhatsAppAmbiguousDeliveryError();
  return result.messages[0].id as string;
}

export async function sendFinancialTemplate(phone: string, text: string) {
  if (!/^\d{8,15}$/.test(phone) || text.length > 1024)
    throw new HttpError(400, 'Template financeiro inválido.');
  const name = env('WHATSAPP_FINANCIAL_TEMPLATE');
  if (!/^[a-z0-9_]+$/.test(name)) throw new HttpError(503, 'Configure um template financeiro aprovado.');
  const response = await fetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name,
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const result = await response.json();
  if (response.status >= 500)
    throw new HttpError(502, 'Resultado de envio ambíguo; precisa de reconciliação.');
  if (!response.ok)
    throw new WhatsAppDeliveryError(Number.isInteger(result.error?.code) ? result.error.code : null);
  if (!result.messages?.[0]?.id) throw new HttpError(502, 'A API não confirmou o identificador de envio.');
  return String(result.messages[0].id);
}

export async function deliverReply(messageId: string, phone: string, text: string) {
  const db = admin();
  const claim = await db.rpc('claim_whatsapp_reply', { message_key: messageId });
  if (claim.error) throw new HttpError(503, 'Não consegui reservar o envio da resposta.');
  if (!claim.data) return;
  let replyId: string | null = null;
  try {
    replyId = await sendText(phone, text);
    const saved = await db
      .from('whatsapp_messages_metadata')
      .update({
        sent_at: new Date().toISOString(),
        reply_message_id: replyId,
        delivery_status: 'accepted',
        reply_error_code: null,
      })
      .eq('message_id', messageId);
    if (saved.error) throw new HttpError(503, 'Não foi possível registrar o envio.');
  } catch (error) {
    await db
      .from('whatsapp_messages_metadata')
      .update({
        delivery_status: error instanceof WhatsAppDeliveryError ? 'failed' : 'reconcile',
        reply_error_code: error instanceof WhatsAppDeliveryError ? error.code : null,
        ...(replyId ? { reply_message_id: replyId } : {}),
      })
      .eq('message_id', messageId);
    throw error;
  }
}

export async function deliverImageReply(
  messageId: string,
  phone: string,
  image: Uint8Array,
  caption: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
) {
  const db = admin();
  const claim = await db.rpc('claim_whatsapp_reply', { message_key: messageId });
  if (claim.error) throw new HttpError(503, 'Não consegui reservar o envio da imagem.');
  if (!claim.data) return;
  let replyId: string | null = null;
  try {
    replyId = await sendImage(phone, image, caption, mimeType);
    const saved = await db
      .from('whatsapp_messages_metadata')
      .update({
        sent_at: new Date().toISOString(),
        reply_message_id: replyId,
        reply: caption,
        delivery_status: 'accepted',
        reply_error_code: null,
      })
      .eq('message_id', messageId);
    if (saved.error) throw new WhatsAppAmbiguousDeliveryError();
  } catch (error) {
    await db
      .from('whatsapp_messages_metadata')
      .update({
        delivery_status: error instanceof WhatsAppAmbiguousDeliveryError ? 'reconcile' : 'failed',
        reply_error_code: error instanceof WhatsAppDeliveryError ? error.code : null,
        ...(replyId ? { reply_message_id: replyId } : {}),
      })
      .eq('message_id', messageId);
    throw error;
  }
}

export async function cacheImageReply(
  messageId: string,
  image: Uint8Array,
  mimeType: 'image/png' | 'image/jpeg',
) {
  if (!image.length || image.length > 5_000_000) throw new HttpError(413, 'A imagem precisa ter até 5 MB.');
  let binary = '';
  for (let offset = 0; offset < image.length; offset += 32768)
    binary += String.fromCharCode(...image.subarray(offset, offset + 32768));
  const saved = await admin()
    .from('whatsapp_reply_media')
    .upsert({
      message_id: messageId,
      mime_type: mimeType,
      image_base64: btoa(binary),
      expires_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(),
    });
  if (saved.error) throw new HttpError(503, 'Não consegui guardar a imagem para recuperar o envio.');
}

export async function retryWhatsAppReply(messageId: string, phone: string) {
  const db = admin();
  const previous = await db
    .from('whatsapp_messages_metadata')
    .select('state,reply,reply_kind,sent_at,reply_message_id,delivery_status,user_id')
    .eq('message_id', messageId)
    .maybeSingle();
  if (previous.error) throw new HttpError(503, 'Não consegui conferir a entrega anterior.');
  const reply = previous.data;
  if (
    !reply?.reply ||
    reply.sent_at ||
    reply.reply_message_id ||
    reply.delivery_status === 'reconcile' ||
    !['complete', 'pending'].includes(reply.state)
  )
    return false;
  if (reply.user_id) {
    const connection = await db
      .from('whatsapp_connections')
      .select('consent_at')
      .eq('user_id', reply.user_id)
      .eq('phone', phone)
      .maybeSingle();
    if (connection.error) throw new HttpError(503, 'Não consegui conferir o vínculo.');
    if (!connection.data?.consent_at) return false;
  }
  if (reply.reply_kind === 'image') {
    const stored = await db
      .from('whatsapp_reply_media')
      .select('image_base64,mime_type')
      .eq('message_id', messageId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (stored.error) throw new HttpError(503, 'Não consegui recuperar a imagem anterior.');
    if (!stored.data) {
      await deliverReply(
        messageId,
        phone,
        'A imagem anterior expirou. Envie a consulta novamente para gerar uma nova imagem; nenhuma alteração financeira foi repetida.',
      );
      return true;
    }
    if (!['image/png', 'image/jpeg'].includes(stored.data.mime_type))
      throw new HttpError(503, 'Formato armazenado inválido.');
    const bytes = Uint8Array.from(atob(stored.data.image_base64), (character) => character.charCodeAt(0));
    await deliverImageReply(
      messageId,
      phone,
      bytes,
      reply.reply,
      stored.data.mime_type as 'image/png' | 'image/jpeg',
    );
  } else {
    await deliverReply(messageId, phone, reply.reply);
  }
  return true;
}
export async function downloadMedia(mediaId: string): Promise<File> {
  if (!/^\d+$/.test(mediaId)) throw new HttpError(400, 'Identificador de mídia inválido.');
  const metadata = await (
    await safeFetch(graphUrl(mediaId), {
      headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}` },
    })
  ).json();
  const url = new URL(metadata.url);
  if (
    url.protocol !== 'https:' ||
    !(url.hostname === 'lookaside.fbsbx.com' || url.hostname.endsWith('.fbcdn.net'))
  )
    throw new HttpError(400, 'Origem de mídia não permitida.');
  if (metadata.file_size > 10_000_000) throw new HttpError(413, 'Arquivo muito grande.');
  const response = await safeFetch(url.href, {
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}` },
    redirect: 'error',
  });
  if (Number(response.headers.get('content-length') ?? 0) > 10_000_000)
    throw new HttpError(413, 'Arquivo muito grande.');
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(400, 'Mídia vazia.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10_000_000) {
      await reader.cancel();
      throw new HttpError(413, 'Arquivo muito grande.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const mime = String(metadata.mime_type ?? 'application/octet-stream');
  const extension = mime.includes('ogg')
    ? 'ogg'
    : mime === 'audio/mp4' || mime === 'audio/x-m4a'
      ? 'm4a'
      : mime === 'audio/mpeg'
        ? 'mp3'
        : mime === 'audio/wav' || mime === 'audio/x-wav'
          ? 'wav'
          : mime === 'audio/webm'
            ? 'webm'
            : mime === 'application/pdf'
              ? 'pdf'
              : 'media';
  return new File([bytes], `whatsapp.${extension}`, {
    type: mime,
  });
}
