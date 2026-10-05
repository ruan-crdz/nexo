import { env, HttpError, safeFetch } from './http.ts';

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
  await safeFetch(graphUrl(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text.slice(0, 4000) },
    }),
  });
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
