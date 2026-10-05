import { z } from 'zod';
import { authenticate, body, json, serve, HttpError } from '../_shared/http.ts';
import { advise } from '../_shared/advice.ts';
serve(async (request) => {
  const { user, db, service } = await authenticate(request, 'ai');
  const input = z
    .object({
      question: z.string().trim().min(2).max(2000),
      organization_id: z.string().uuid().optional(),
      save_history: z.boolean().default(false),
    })
    .parse(await body(request));
  const result = await advise(db, user.id, input.question, input.organization_id);
  if (input.save_history) {
    const saved = await service.from('ai_messages').insert([
      { user_id: user.id, role: 'user', content: input.question },
      { user_id: user.id, role: 'assistant', content: result.answer, sources: result.sources },
    ]);
    if (saved.error) throw new HttpError(503, 'Não foi possível salvar o histórico.');
  }
  return json(result);
});
