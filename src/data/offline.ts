import { openDB } from 'idb';
import type { Dataset, Transaction } from '../../shared/domain';
let connection: ReturnType<typeof openDB> | undefined;
function database() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      let blocked = false;
      const opening = openDB('nexo-offline-v1', 2, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore('keys');
            db.createObjectStore('sealed');
          }
          db.createObjectStore('queue', { keyPath: ['owner', 'id'] }).createIndex('owner', 'owner');
        },
        blocked() {
          blocked = true;
          connection = undefined;
          reject(
            new Error('Feche as outras abas antigas do Nexo e tente novamente para atualizar o uso offline.'),
          );
        },
        blocking() {
          void opening.then((db) => db.close());
          connection = undefined;
        },
        terminated() {
          connection = undefined;
        },
      });
      void opening.then(
        (db) => {
          if (blocked) db.close();
          else resolve(db);
        },
        (error) => {
          connection = undefined;
          reject(error);
        },
      );
    });
  return connection;
}
export const offlineEnabled = (owner: string) => localStorage.getItem(`nexo.offline.${owner}`) === 'yes';
async function keyFor(owner: string) {
  const db = await database();
  const existing = (await db.get('keys', owner)) as CryptoKey | undefined;
  if (existing) return existing;
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const transaction = db.transaction('keys', 'readwrite');
  const key = ((await transaction.store.get(owner)) as CryptoKey | undefined) ?? candidate;
  await transaction.store.put(key, owner);
  await transaction.done;
  return key;
}
async function seal(owner: string, value: unknown) {
  const key = await keyFor(owner),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return { iv, data };
}
async function write(owner: string, name: string, value: unknown) {
  const sealed = await seal(owner, value);
  const db = await database();
  await db.put('sealed', sealed, `${owner}:${name}`);
}
async function read<Value>(owner: string, name: string): Promise<Value | null> {
  const db = await database();
  const sealed = await db.get('sealed', `${owner}:${name}`);
  if (!sealed) return null;
  const key = (await db.get('keys', owner)) as CryptoKey | undefined;
  if (!key) return null;
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.data);
  return JSON.parse(new TextDecoder().decode(raw)) as Value;
}
export async function cacheDataset(owner: string, data: Dataset) {
  if (offlineEnabled(owner)) await write(owner, 'cache', data);
}
export async function offlineDataset(owner: string) {
  if (!offlineEnabled(owner)) return null;
  const cached = await read<Dataset>(owner, 'cache');
  if (!cached) return null;
  const pending = await pendingTransactions(owner);
  const merged = new Map(cached.transactions.map((row) => [row.id, row]));
  for (const row of pending) merged.set(row.id, row);
  return { ...cached, transactions: [...merged.values()] };
}
export async function pendingTransactions(owner: string) {
  await migrateQueue(owner);
  const db = await database();
  const entries = await db.getAllFromIndex('queue', 'owner', owner);
  const key = (await db.get('keys', owner)) as CryptoKey | undefined;
  if (!key) return [];
  return Promise.all(
    entries.map(async (entry): Promise<Transaction> => {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, key, entry.data);
      return JSON.parse(new TextDecoder().decode(raw)) as Transaction;
    }),
  );
}
// Keep existing offline notes when upgrading from the single encrypted queue.
async function migrateQueue(owner: string) {
  const legacy = await read<Transaction[]>(owner, 'queue');
  if (!legacy) return;
  const entries = await Promise.all(
    legacy.map(async (row) => ({ owner, id: row.id, ...(await seal(owner, row)) })),
  );
  const db = await database();
  const transaction = db.transaction(['queue', 'sealed'], 'readwrite');
  if (await transaction.objectStore('sealed').get(`${owner}:queue`)) {
    for (const entry of entries) {
      if (!(await transaction.objectStore('queue').get([owner, entry.id])))
        await transaction.objectStore('queue').put(entry);
    }
    await transaction.objectStore('sealed').delete(`${owner}:queue`);
  }
  await transaction.done;
}
export async function enqueueTransaction(owner: string, row: Transaction) {
  if (!offlineEnabled(owner)) throw new Error('Ative uso offline em Ajustes antes de ficar sem internet.');
  await migrateQueue(owner);
  const sealed = await seal(owner, row);
  const db = await database();
  await db.put('queue', { owner, id: row.id, ...sealed });
}
const drains = new Map<string, Promise<void>>();
export async function drainTransactions(owner: string, send: (row: Transaction) => Promise<void>) {
  // Web Locks serializes synchronization across tabs. The fallback serializes
  // callers in runtimes without that API; row writes remain atomic in IndexedDB.
  if (globalThis.navigator?.locks)
    return navigator.locks.request(`nexo-offline-sync:${owner}`, () => drain(owner, send));
  const previous = drains.get(owner) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(() => drain(owner, send));
  drains.set(owner, current);
  try {
    await current;
  } finally {
    if (drains.get(owner) === current) drains.delete(owner);
  }
}
async function drain(owner: string, send: (row: Transaction) => Promise<void>) {
  const queue = await pendingTransactions(owner);
  for (const row of queue) {
    const db = await database();
    const sent = await db.get('queue', [owner, row.id]);
    if (!sent) continue;
    // Read the payload from this exact version, not from an earlier snapshot.
    const key = (await db.get('keys', owner)) as CryptoKey | undefined;
    if (!key) return;
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sent.iv }, key, sent.data);
    await send(JSON.parse(new TextDecoder().decode(raw)) as Transaction);
    const transaction = db.transaction('queue', 'readwrite');
    const current = await transaction.store.get([owner, row.id]);
    if (current && current.iv.every((byte: number, index: number) => byte === sent.iv[index]))
      await transaction.store.delete([owner, row.id]);
    await transaction.done;
  }
}
export async function clearOffline(owner: string) {
  const db = await database();
  const transaction = db.transaction(['keys', 'sealed', 'queue'], 'readwrite');
  await transaction.objectStore('keys').delete(owner);
  await transaction.objectStore('sealed').delete(`${owner}:cache`);
  await transaction.objectStore('sealed').delete(`${owner}:queue`);
  const keys = await transaction.objectStore('queue').index('owner').getAllKeys(owner);
  for (const key of keys) await transaction.objectStore('queue').delete(key);
  await transaction.done;
  localStorage.removeItem(`nexo.offline.${owner}`);
}
export async function setOffline(owner: string, enabled: boolean) {
  if (!enabled) {
    await clearOffline(owner);
    return;
  }
  await keyFor(owner);
  localStorage.setItem(`nexo.offline.${owner}`, 'yes');
}
