import { authenticate, HttpError, json, serve } from '../_shared/http.ts';
import { readReceipt } from '../_shared/openai.ts';
serve(async (request) => {
  const { user, db } = await authenticate(request, 'receipt');
  if (Number(request.headers.get('content-length') ?? 0) > 11_000_000)
    throw new HttpError(413, 'A nota ou foto é muito grande.');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Envie uma foto ou PDF da nota.');
  const profile = await db.from('profiles').select('timezone').eq('id', user.id).single();
  if (profile.error) throw new HttpError(503, 'Perfil indisponível.');
  const preview = await readReceipt(file, profile.data.timezone, user.id);
  return json(preview);
});
