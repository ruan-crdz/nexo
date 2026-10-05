import { expect, test } from '@playwright/test';

test('duas abas preservam anotações offline e coordenam a sincronização', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  const owner = crypto.randomUUID();
  await page.evaluate(async (owner) => {
    const path = '/src/data/offline.ts';
    const offline = await import(/* @vite-ignore */ path);
    await offline.setOffline(owner, true);
  }, owner);
  await Promise.all(
    [page, other].map((tab) =>
      tab.evaluate(async (owner) => {
        const path = '/src/data/offline.ts';
        const offline = await import(/* @vite-ignore */ path);
        await Promise.all(
          Array.from({ length: 10 }, () =>
            offline.enqueueTransaction(owner, {
              id: crypto.randomUUID(),
              description: 'Teste entre abas',
              amount: 100,
              date: '2026-10-05',
              type: 'expense',
              category: 'Outros',
              status: 'paid',
              source: 'manual',
              account_id: null,
            }),
          ),
        );
      }, owner),
    ),
  );
  const pending = await page.evaluate(async (owner) => {
    const path = '/src/data/offline.ts';
    return (await (await import(/* @vite-ignore */ path)).pendingTransactions(owner)).length;
  }, owner);
  expect(pending).toBe(20);
  const results = await Promise.all(
    [page, other].map((tab) =>
      tab.evaluate(async (owner) => {
        const path = '/src/data/offline.ts';
        const offline = await import(/* @vite-ignore */ path);
        const sent: string[] = [];
        await offline.drainTransactions(owner, async (row: { id: string }) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          sent.push(row.id);
        });
        return sent;
      }, owner),
    ),
  );
  expect(results.flat()).toHaveLength(20);
  expect(new Set(results.flat()).size).toBe(20);
  await page.evaluate(async (owner) => {
    const path = '/src/data/offline.ts';
    await (await import(/* @vite-ignore */ path)).clearOffline(owner);
  }, owner);
});

test('atualização preserva pendências da versão antiga do IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const request = indexedDB.open('nexo-offline-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys');
      request.result.createObjectStore('sealed');
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const row = {
      id: crypto.randomUUID(),
      description: 'Anotação antiga',
      amount: 2500,
      date: '2026-10-05',
      type: 'expense',
      category: 'Outros',
      status: 'paid',
      source: 'manual',
      account_id: null,
    };
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify([row])),
    );
    const tx = db.transaction(['keys', 'sealed'], 'readwrite');
    tx.objectStore('keys').put(key, 'legacy');
    tx.objectStore('sealed').put({ iv, data }, 'legacy:queue');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const rows = await page.evaluate(async () => {
    const path = '/src/data/offline.ts';
    const offline = await import(/* @vite-ignore */ path);
    return offline.pendingTransactions('legacy');
  });
  expect(rows).toMatchObject([{ description: 'Anotação antiga', amount: 2500 }]);
});
