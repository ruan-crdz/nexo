import { authenticate, json, serve, HttpError } from '../_shared/http.ts';
import { transcribe } from '../_shared/openai.ts';
serve(async (request) => {
  const { user } = await authenticate(request, 'audio');
  if (Number(request.headers.get('content-length') ?? 0) > 11_000_000)
    throw new HttpError(413, 'Áudio muito grande.');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Envie um arquivo de áudio.');
  return json({ text: await transcribe(file, user.id) });
});
