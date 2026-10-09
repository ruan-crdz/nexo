import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../design-system/components';

export function AppUpdate() {
  const {
    needRefresh: [needed, setNeeded],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needed) return null;
  return (
    <aside className="app-update" role="status" aria-labelledby="app-update-title">
      <div>
        <h2 id="app-update-title">Atualização pronta</h2>
      </div>
      <div className="simple-inline-actions">
        <Button onClick={() => void updateServiceWorker(true)}>Atualizar</Button>
        <Button variant="secondary" onClick={() => setNeeded(false)}>
          Depois
        </Button>
      </div>
    </aside>
  );
}
