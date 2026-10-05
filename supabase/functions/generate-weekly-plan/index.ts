import { authenticate, json, serve } from '../_shared/http.ts';
import { financialContext } from '../_shared/financial-context.ts';
serve(async (request) => {
  const { user, db } = await authenticate(request, 'plan');
  const context = await financialContext(db, user.id);
  return json({ plan: context.plan, engine_version: '1.0.0', generated_at: new Date().toISOString() });
});
