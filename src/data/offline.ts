import { openDB } from 'idb';
import type { Dataset, Transaction } from '../../shared/domain';
const database = () =>
  openDB('nexo-offline-v1', 1, {
    upgrade(db) {
      db.createObjectStore('keys');
      db.createObjectStore('sealed');
    },
  });
export const offlineEnabled = (owner: string) => localStorage.getItem(`nexo.offline.${owner}`) === 'yes';
async function keyFor(owner: string) {
  const db = await database();
  let key = (await db.get('keys', owner)) as CryptoKey | undefined;
  if (!key) {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await db.put('keys', key, owner);
  }
  return key;
}
async function write(owner: string, name: string, value: unknown) {
  const key = await keyFor(owner),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const db = await database();
  await db.put('sealed', { iv, data }, `${owner}:${name}`);
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
  return (await read<Transaction[]>(owner, 'queue')) ?? [];
}
export async function enqueueTransaction(owner: string, row: Transaction) {
  if (!offlineEnabled(owner)) throw new Error('Ative uso offline em Ajustes antes de ficar sem internet.');
  const queue = await pendingTransactions(owner);
  await write(owner, 'queue', [...queue.filter((item) => item.id !== row.id), row]);
}
export async function drainTransactions(owner: string, send: (row: Transaction) => Promise<void>) {
  const queue = await pendingTransactions(owner);
  for (const row of queue) {
    await send(row);
    const current = await pendingTransactions(owner);
    await write(
      owner,
      'queue',
      current.filter((item) => item.id !== row.id || JSON.stringify(item) !== JSON.stringify(row)),
    );
  }
}
export async function clearOffline(owner: string) {
  const db = await database();
  const transaction = db.transaction(['keys', 'sealed'], 'readwrite');
  await transaction.objectStore('keys').delete(owner);
  await transaction.objectStore('sealed').delete(`${owner}:cache`);
  await transaction.objectStore('sealed').delete(`${owner}:queue`);
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
