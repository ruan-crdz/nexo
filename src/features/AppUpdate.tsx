import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../design-system/components';
export function AppUpdate() {
  const {
    needRefresh: [needed, setNeeded],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needed) return null;
  return (
    <aside className="app-update" role="status">
      <p>Uma versão nova está pronta. Atualize depois de salvar suas anotações.</p>
      <div className="simple-inline-actions">
        <Button onClick={() => void updateServiceWorker(true)}>Atualizar app</Button>
        <Button variant="secondary" onClick={() => setNeeded(false)}>
          Mais tarde
        </Button>
      </div>
    </aside>
  );
}
