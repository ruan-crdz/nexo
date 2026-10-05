import { authenticate, json, serve, HttpError } from '../_shared/http.ts';
import { hashToken } from '../_shared/whatsapp.ts';
serve(async (request) => {
  const { user, service } = await authenticate(request, 'whatsapp-link');
  const token = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error } = await service
    .from('whatsapp_connections')
    .upsert({ user_id: user.id, token_hash: await hashToken(token), token_expires_at: expires });
  if (error) throw new HttpError(503, 'Não foi possível criar o vínculo.');
  return json({
    code: token,
    expires_at: expires,
    instruction: `Envie ao número oficial do Nexo: vincular ${token}`,
  });
});
