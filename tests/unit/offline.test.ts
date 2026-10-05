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
import { openDB } from 'idb';
const storage = new Map<string, string>();
const sample = (): Transaction => ({
  id: crypto.randomUUID(),
  description: 'Mercado',
  amount: 1234,
  date: '2026-10-05',
  type: 'expense',
  category: 'Outros',
  status: 'paid',
  source: 'manual',
  account_id: null,
});
it('sincronizações concorrentes não reenviam a mesma versão da anotação', async () => {
  const owner = crypto.randomUUID();
  await setOffline(owner, true);
  await enqueueTransaction(owner, sample());
  const sent: string[] = [];
  await Promise.all(
    Array.from({ length: 3 }, () =>
      drainTransactions(owner, async (row) => {
        sent.push(row.id);
      }),
    ),
  );
  expect(sent).toHaveLength(1);
  expect(await pendingTransactions(owner)).toEqual([]);
  await clearOffline(owner);
});
it('preserva gravações simultâneas e gera uma única chave por pessoa', async () => {
  const owner = crypto.randomUUID();
  await Promise.all([setOffline(owner, true), setOffline(owner, true)]);
  const rows = Array.from({ length: 20 }, sample);
  await Promise.all(rows.map((row) => enqueueTransaction(owner, row)));
  expect((await pendingTransactions(owner)).map((row) => row.id).sort()).toEqual(
    rows.map((row) => row.id).sort(),
  );
  await clearOffline(owner);
  expect(await pendingTransactions(owner)).toEqual([]);
});
it('não apaga uma correção nem outra anotação feita durante o envio', async () => {
  const owner = crypto.randomUUID();
  await setOffline(owner, true);
  const first = sample(),
    extra = sample(),
    corrected = { ...first, amount: 5000 };
  await enqueueTransaction(owner, first);
  await drainTransactions(owner, async (sent) => {
    expect(sent).toEqual(first);
    await Promise.all([enqueueTransaction(owner, corrected), enqueueTransaction(owner, extra)]);
  });
  expect(await pendingTransactions(owner)).toEqual(expect.arrayContaining([corrected, extra]));
  await clearOffline(owner);
});
it('migra pendências antigas cifradas sem duplicar ou ressuscitar registros', async () => {
  const owner = crypto.randomUUID();
  await setOffline(owner, true);
  const db = await openDB('nexo-offline-v1', 2);
  const key = await db.get('keys', owner),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const legacy = sample();
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify([legacy])),
  );
  await db.put('sealed', { iv, data }, `${owner}:queue`);
  await Promise.all([pendingTransactions(owner), pendingTransactions(owner)]);
  expect(await pendingTransactions(owner)).toEqual([legacy]);
  await drainTransactions(owner, async () => {});
  expect(await pendingTransactions(owner)).toEqual([]);
  expect(await db.get('sealed', `${owner}:queue`)).toBeUndefined();
  await clearOffline(owner);
  db.close();
});
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
