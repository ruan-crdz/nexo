import { z } from 'zod';
import { authenticate, body, json, serve } from '../_shared/http.ts';
import { searchKnowledge } from '../_shared/advice.ts';
serve(async (request) => {
  const { db } = await authenticate(request, 'rag');
  const input = z.object({ query: z.string().min(2).max(2000) }).parse(await body(request));
  return json({ sources: await searchKnowledge(db, input.query) });
});
