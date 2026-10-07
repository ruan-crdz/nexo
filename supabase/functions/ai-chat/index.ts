import { z } from 'zod';
import { authenticate, body, json, serve, HttpError } from '../_shared/http.ts';
import { advise } from '../_shared/advice.ts';
import { chatWithWhatsApp } from '../_shared/whatsapp-chat.ts';
import { civilDate } from '../../../shared/financial-engine.ts';
serve(async (request) => {
  const { user, db, service } = await authenticate(request, 'ai');
  const input = z
    .object({
      request_id: z.string().uuid().optional(),
      question: z.string().trim().min(2).max(2000),
      organization_id: z.string().uuid().optional(),
      save_history: z.boolean().default(false),
      history: z
        .array(
          z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }).strict(),
        )
        .max(6)
        .default([]),
    })
    .parse(await body(request));
  let result;
  if (input.organization_id) {
    result = await advise(db, user.id, input.question, input.organization_id, input.history);
  } else {
    const profile = await db.from('profiles').select('timezone').eq('id', user.id).single();
    if (profile.error) throw new HttpError(503, 'Não consegui abrir seu perfil para continuar a conversa.');
    result = await chatWithWhatsApp(input.question, {
      userId: user.id,
      phone: '',
      messageId: crypto.randomUUID(),
      requestId: input.request_id ?? crypto.randomUUID(),
      today: civilDate(new Date(), profile.data.timezone),
      db,
      appMode: true,
      history: input.history,
      onCommit: () => {},
    });
  }
  if (input.save_history) {
    const saved = await service.from('ai_messages').insert([
      { user_id: user.id, role: 'user', content: input.question },
      { user_id: user.id, role: 'assistant', content: result.answer, sources: result.sources },
    ]);
    if (saved.error) throw new HttpError(503, 'Não foi possível salvar o histórico.');
  }
  return json(result);
});
