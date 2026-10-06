import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../design-system/components';

type ReleaseNotes = { version: string; changes: string[] };

const fallbackNotes: ReleaseNotes = {
  version: '',
  changes: ['Melhorias de uso e correções.'],
};

export function AppUpdate() {
  const {
    needRefresh: [needed, setNeeded],
    updateServiceWorker,
  } = useRegisterSW();
  const [notes, setNotes] = useState(fallbackNotes);

  useEffect(() => {
    if (!needed) return;
    const controller = new AbortController();
    void fetch(`${import.meta.env.BASE_URL}release-notes.json`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Release notes unavailable');
        return response.json() as Promise<ReleaseNotes>;
      })
      .then((result) => {
        if (Array.isArray(result.changes) && result.changes.every((change) => typeof change === 'string'))
          setNotes(result);
      })
      .catch(() => setNotes(fallbackNotes));
    return () => controller.abort();
  }, [needed]);

  if (!needed) return null;
  return (
    <aside className="app-update" role="status" aria-labelledby="app-update-title">
      <div>
        <h2 id="app-update-title">Uma atualização está pronta</h2>
        {notes.version && <p className="muted">Versão {notes.version}</p>}
        <p>O que mudou:</p>
        <ul>
          {notes.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
        <p className="muted">Salve suas anotações em andamento antes de atualizar.</p>
      </div>
      <div className="simple-inline-actions">
        <Button onClick={() => void updateServiceWorker(true)}>Atualizar agora</Button>
        <Button variant="secondary" onClick={() => setNeeded(false)}>
          Mais tarde
        </Button>
      </div>
    </aside>
  );
}
