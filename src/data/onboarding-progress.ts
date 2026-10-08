export type OnboardingStep = 'name' | 'whatsapp' | 'objective';

function key(identity: string) {
  return `nexo.onboarding.${identity}`;
}

export function readOnboardingStep(identity: string): OnboardingStep | null {
  try {
    const value = sessionStorage.getItem(key(identity));
    return value === 'name' || value === 'whatsapp' || value === 'objective' ? value : null;
  } catch {
    return null;
  }
}

export function saveOnboardingStep(identity: string, step: OnboardingStep) {
  try {
    sessionStorage.setItem(key(identity), step);
  } catch {
    // Keep the current step in memory when session storage is unavailable.
  }
}

export function clearOnboardingStep(identity: string) {
  try {
    sessionStorage.removeItem(key(identity));
  } catch {
    // The profile onboarding flag remains the source of truth.
  }
}