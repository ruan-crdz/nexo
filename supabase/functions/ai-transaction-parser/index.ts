import { z } from 'zod';
import { authenticate, body, json, serve } from '../_shared/http.ts';
import { parseTransaction } from '../_shared/openai.ts';
serve(async (request) => {
  const { user, db } = await authenticate(request, 'parser');
  const input = z.object({ text: z.string().min(2).max(4000) }).parse(await body(request));
  const profile = await db.from('profiles').select('timezone').eq('id', user.id).single();
  return json(await parseTransaction(input.text, profile.data?.timezone ?? 'America/Sao_Paulo'));
});
