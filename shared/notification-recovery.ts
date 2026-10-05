export function deliveryFailure(code: number | null, attempts: number, knownRejected: boolean) {
  if (!knownRejected) return { state: 'reconcile' as const, delaySeconds: null };
  const transient = new Set([4, 17, 32, 613, 130429, 131000, 131016, 131048, 131056]);
  if (code !== null && transient.has(code) && attempts < 3)
    return { state: 'retry' as const, delaySeconds: Math.min(3600, 60 * 2 ** attempts) };
  return { state: 'failed' as const, delaySeconds: null };
}
