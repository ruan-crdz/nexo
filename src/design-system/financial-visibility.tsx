import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatMoney } from '../../shared/financial-engine';

const storageKey = 'nexo.financial-values-visible';

function readVisibility() {
  try {
    return localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

type FinancialVisibility = {
  visible: boolean;
  toggle: () => void;
};

const FinancialVisibilityContext = createContext<FinancialVisibility | null>(null);

export function FinancialVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(readVisibility);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setVisible(readVisibility());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function toggle() {
    setVisible((current) => {
      const next = !current;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // The current session remains usable when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <FinancialVisibilityContext.Provider value={{ visible, toggle }}>
      {children}
    </FinancialVisibilityContext.Provider>
  );
}

export function useFinancialVisibility() {
  const value = useContext(FinancialVisibilityContext);
  if (!value) throw new Error('FinancialVisibilityProvider ausente.');
  return value;
}

export function useMoneyDisplay() {
  const { visible } = useFinancialVisibility();
  return (amount: number) => (visible ? formatMoney(amount) : 'R$ •••••');
}

export function redactFinancialText(text: string) {
  return text.replace(/R\$\s*-?\s*[\d.]+(?:,\d{1,2})?/gi, 'R$ •••••');
}
