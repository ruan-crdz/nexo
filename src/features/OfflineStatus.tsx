import { useEffect, useState } from 'react';
import { useApp } from '../data/context';
import { pendingTransactions } from '../data/offline';
export function OfflineStatus() {
  const app = useApp();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [cacheError, setCacheError] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => {
      setOnline(navigator.onLine);
      setCacheError(!!app.user && !!localStorage.getItem(`nexo.offline.error.${app.user.id}`));
      if (app.user && !app.demo)
        void pendingTransactions(app.user.id)
          .then((rows) => {
            if (active) setCount(rows.length);
          })
          .catch(() => {
            if (active) setCount(0);
          });
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const timer = setInterval(update, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [app.user, app.demo]);
  if (app.demo || (!count && online && !cacheError)) return null;
  return (
    <p className="notice" role="status">
      {online ? 'Conectado' : 'Sem internet'}
      {cacheError
        ? ' · A cópia offline não pôde ser atualizada. Libere espaço no aparelho e use a conexão para conferir seus dados.'
        : ''}
      {count
        ? ` · ${count} anotações pendentes neste aparelho. Ainda não confirmadas no servidor. Sincronize antes de sair da conta.`
        : ' · Somente cópia offline disponível neste aparelho.'}
    </p>
  );
}
