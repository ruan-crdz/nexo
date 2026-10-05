import { z } from 'zod';
import { authenticate, body, json, serve, HttpError } from '../_shared/http.ts';
serve(async (request) => {
  const { user, service } = await authenticate(request, 'delete');
  z.object({ confirmation: z.literal('EXCLUIR MINHA CONTA') }).parse(await body(request));
  const owned = await service.from('organizations').select('id').eq('owner_id', user.id);
  if (owned.error) throw new HttpError(503, 'Não foi possível verificar suas empresas.');
  if (owned.data.length)
    throw new HttpError(
      409,
      'Antes de excluir a conta, solicite a transferência ou exclusão das empresas das quais você é proprietário. Dados compartilhados não serão apagados implicitamente.',
    );
  const result = await service.auth.admin.deleteUser(user.id);
  if (result.error) throw new HttpError(503, 'Não foi possível excluir a conta.');
  return json({ deleted: true });
});
