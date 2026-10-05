import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import {
  clearOffline,
  drainTransactions,
  enqueueTransaction,
  pendingTransactions,
  setOffline,
} from '../../src/data/offline';
import type { Transaction } from '../../shared/domain';
const storage = new Map<string, string>();
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});
it('fila é cifrada, separada por pessoa, deduplicada por id e removida ao sair', async () => {
  await clearOffline('a');
  await clearOffline('b');
  await setOffline('a', true);
  await setOffline('b', true);
  const row: Transaction = {
    id: crypto.randomUUID(),
    description: 'Mercado',
    amount: 1234,
    date: '2026-10-05',
    type: 'expense',
    category: 'Outros',
    status: 'paid',
    source: 'manual',
    account_id: null,
  };
  await enqueueTransaction('a', row);
  await enqueueTransaction('a', row);
  expect(await pendingTransactions('b')).toEqual([]);
  expect(await pendingTransactions('a')).toEqual([row]);
  const sent: string[] = [];
  await drainTransactions('a', async (item) => {
    sent.push(item.id);
  });
  expect(sent).toEqual([row.id]);
  expect(await pendingTransactions('a')).toEqual([]);
  await clearOffline('a');
});
it('falha de sincronização preserva pendência', async () => {
  await setOffline('a', true);
  const row: Transaction = {
    id: crypto.randomUUID(),
    description: 'Teste',
    amount: 1,
    date: '2026-10-05',
    type: 'expense',
    category: 'Outros',
    status: 'paid',
    source: 'manual',
    account_id: null,
  };
  await enqueueTransaction('a', row);
  await expect(
    drainTransactions('a', async () => {
      throw new Error('offline');
    }),
  ).rejects.toThrow('offline');
  expect((await pendingTransactions('a')).some((item) => item.id === row.id)).toBe(true);
  await clearOffline('a');
});
