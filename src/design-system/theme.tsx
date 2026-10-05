import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './components';

type Theme = 'system' | 'light' | 'dark';
const key = 'nexo.theme';
function preference(): Theme {
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}
const ThemeContext = createContext<{ theme: Theme; dark: boolean; setTheme: (theme: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(preference);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media.matches);
    const stored = (event: StorageEvent) => {
      if (event.key === key || event.key === null) updateTheme(preference());
    };
    media.addEventListener('change', changed);
    window.addEventListener('storage', stored);
    return () => {
      media.removeEventListener('change', changed);
      window.removeEventListener('storage', stored);
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171c19' : '#f7f3e8');
  }, [dark]);
  function setTheme(value: Theme) {
    updateTheme(value);
    try { localStorage.setItem(key, value); } catch { /* The current session still works without storage. */ }
  }
  return <ThemeContext.Provider value={{ theme, dark, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('Tema indisponível.');
  return theme;
}

export function ThemeToggle() {
  const { dark, setTheme } = useTheme();
  const label = dark ? 'Ativar modo claro' : 'Ativar modo noturno';
  return <Button variant="ghost" className="theme-toggle" aria-label={label} title={label}
    onClick={() => setTheme(dark ? 'light' : 'dark')}>
    {dark ? <Sun size={19} /> : <Moon size={19} />}
  </Button>;
}
