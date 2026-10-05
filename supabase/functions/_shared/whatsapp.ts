import { admin, env, HttpError, safeFetch } from './http.ts';

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
  const result = await response.json();
  if (!response.ok || !result.messages?.[0]?.id) {
    const code = Number.isInteger(result.error?.code) ? result.error.code : null;
    console.error(JSON.stringify({ event: 'whatsapp_delivery_failed', code, status: response.status }));
    throw new WhatsAppDeliveryError(code);
  }
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
  if (!response.ok || !result.messages?.[0]?.id)
    throw new WhatsAppDeliveryError(Number.isInteger(result.error?.code) ? result.error.code : null);
  return String(result.messages[0].id);
}

export async function deliverReply(messageId: string, phone: string, text: string) {
  const db = admin();
  try {
    const replyId = await sendText(phone, text);
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
        delivery_status: 'failed',
        reply_error_code: error instanceof WhatsAppDeliveryError ? error.code : null,
      })
      .eq('message_id', messageId);
    throw error;
  }
}
export async function downloadAudio(mediaId: string): Promise<File> {
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
  if (metadata.file_size > 10_000_000) throw new HttpError(413, 'Áudio muito grande.');
  const response = await safeFetch(url.href, {
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}` },
    redirect: 'error',
  });
  if (Number(response.headers.get('content-length') ?? 0) > 10_000_000)
    throw new HttpError(413, 'Áudio muito grande.');
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
      throw new HttpError(413, 'Áudio muito grande.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new File([bytes], `audio.${metadata.mime_type?.includes('ogg') ? 'ogg' : 'mp4'}`, {
    type: metadata.mime_type ?? 'audio/ogg',
  });
}
