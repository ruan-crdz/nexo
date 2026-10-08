export type FeatureTourProgress = { status: 'pending'; step: number } | { status: 'complete' };

function storageKey(identity: string) {
  return `nexo.feature-tour.${identity}`;
}

export function readFeatureTour(identity: string): FeatureTourProgress | null {
  try {
    const value = localStorage.getItem(storageKey(identity));
    if (value === 'complete') return { status: 'complete' };
    const pending = /^pending:(\d+)$/.exec(value ?? '');
    return pending ? { status: 'pending', step: Number(pending[1]) } : null;
  } catch {
    return null;
  }
}

export function startFeatureTour(identity: string) {
  try {
    localStorage.setItem(storageKey(identity), 'pending:0');
  } catch {
    // The tour remains available for this visit even if storage is disabled.
  }
}

export function setFeatureTourStep(identity: string, step: number) {
  try {
    localStorage.setItem(storageKey(identity), `pending:${step}`);
  } catch {
    // The in-memory step still advances for this visit.
  }
}

export function completeFeatureTour(identity: string) {
  try {
    localStorage.setItem(storageKey(identity), 'complete');
  } catch {
    // Completion still navigates to the app for this visit.
  }
}

export function isFeatureTourPending(identity: string) {
  return readFeatureTour(identity)?.status === 'pending';
}