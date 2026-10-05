import { expect, it } from 'vitest';
import { deliveryFailure } from '../../shared/notification-recovery';
import { readPages } from '../../shared/pagination';
it('timeout e resultado ambíguo nunca são reenviados automaticamente', () => {
  expect(deliveryFailure(null, 1, false).state).toBe('reconcile');
});
it('erro rejeitado transitório tem backoff e limite de tentativas', () => {
  expect(deliveryFailure(130429, 1, true)).toEqual({ state: 'retry', delaySeconds: 120 });
  expect(deliveryFailure(130429, 3, true).state).toBe('failed');
  expect(deliveryFailure(190, 1, true).state).toBe('failed');
});
it('a paginação do worker inclui 201 usuários sem recusar o lote', async () => {
  const users = Array.from({ length: 201 }, (_, id) => ({ id }));
  expect(
    await readPages(async (from, to) => ({ data: users.slice(from, to + 1), error: null }), 100),
  ).toEqual(users);
});
