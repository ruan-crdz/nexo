import { z } from 'zod';
import { authenticate, body, json, serve } from '../_shared/http.ts';
import { advise } from '../_shared/advice.ts';
serve(async (request) => {
  const { user, db } = await authenticate(request, 'ai');
  const input = z
    .object({ question: z.string().min(2).max(2000), organization_id: z.string().uuid() })
    .parse(await body(request));
  return json(await advise(db, user.id, input.question, input.organization_id));
});
