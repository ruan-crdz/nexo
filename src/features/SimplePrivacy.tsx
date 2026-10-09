import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { DEMO_KEY } from '../data/repository';
import { Button, Dialog } from '../design-system/components';
import { ProfileSubpageLayout, SettingsRow, SettingsToggleRow } from './ProfileSubpageLayout';

export function SimplePrivacy() {
  const app = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [metricsEnabled, setMetricsEnabled] = useState(app.data.profile.metrics_enabled);
  async function updateMetrics(enabled: boolean) {
    if (pending) return;
    const previous = metricsEnabled;
    setMetricsEnabled(enabled);
    setPending(true);
    setError('');
    let stored = false;
    try {
      await app.repository.profile({ ...app.data.profile, metrics_enabled: enabled });
      stored = true;
      await app.refresh();
    } catch {
      if (!stored) setMetricsEnabled(previous);
      setError(
        stored
          ? 'Sua preferência foi salva, mas não conseguimos atualizar a tela. Recarregue para conferir.'
          : 'Não foi possível atualizar sua preferência. O estado anterior foi mantido.',
      );
    } finally {
      setPending(false);
    }
  }
  async function exportData() {
    setPending(true);
    setError('');
    try {
      const data = app.demo ? { mode: 'demo', ...app.data } : await invoke('account-export', {});
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'nexo-meus-dados.json';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      app.toast('Cópia dos seus dados preparada. Confira os downloads do aparelho.');
    } catch {
      setError('Não foi possível baixar os dados. Confira sua conexão e tente de novo.');
    } finally {
      setPending(false);
    }
  }
  async function removeAccount() {
    setPending(true);
    setError('');
    try {
      if (app.demo) localStorage.removeItem(DEMO_KEY);
      else await invoke('account-delete', { confirmation });
      await app.signOut();
      navigate('/');
    } catch {
      setError('Não foi possível concluir a exclusão. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  if (pathname === '/privacidade/exportar') {
    return (
      <ProfileSubpageLayout title="Baixar meus dados">
        <p className="profile-page-intro">Você receberá uma cópia dos dados da sua conta em formato JSON.</p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <Button className="profile-primary-action" disabled={pending} onClick={() => void exportData()}>
          {pending ? 'Preparando download…' : 'Preparar download'}
        </Button>
      </ProfileSubpageLayout>
    );
  }
  return (
    <ProfileSubpageLayout title="Privacidade e dados">
      <p className="profile-page-intro">
        Seus dados são seus. Veja, baixe ou controle como o Nexo usa as informações da sua conta.
      </p>
      <section className="profile-settings-section">
        <h2>Seus dados</h2>
        <SettingsRow
          title="Baixar meus dados"
          description="Prepare uma cópia em formato JSON."
          to="/privacidade/exportar"
        />
        <details className="profile-disclosure">
          <summary>Como usamos seus dados</summary>
          <div className="profile-disclosure-content">
            <p>
              Guardamos seu nome, suas anotações e o número do WhatsApp que você conectar. O Nexo não acessa
              sua conta bancária.
            </p>
            <p>
              Mensagens e áudios podem ser processados por serviços de inteligência artificial para entender
              suas anotações. Não mantemos uma biblioteca dos áudios.
            </p>
            <p>
              Suas anotações são separadas das de outras contas. A equipe responsável pelo funcionamento do
              serviço pode ter acesso técnico.
            </p>
            {app.demo && <p className="notice">Nesta demonstração, os dados ficam apenas neste navegador.</p>}
          </div>
        </details>
      </section>
      <section className="profile-settings-section">
        <h2>Privacidade</h2>
        {app.demo ? (
          <SettingsRow title="Métricas de uso" description="Disponível em uma conta real." to="/cadastro" />
        ) : (
          <SettingsToggleRow
            title="Métricas de uso"
            description="Ajude a melhorar o Nexo com dados técnicos sem conteúdo financeiro."
            checked={metricsEnabled}
            disabled={pending}
            onChange={(enabled) => void updateMetrics(enabled)}
          />
        )}
        <details className="profile-disclosure">
          <summary>Saiba mais sobre as métricas</summary>
          <p className="profile-disclosure-content">
            As métricas técnicas não incluem texto, imagens ou valores financeiros. Você pode desativar esta
            preferência depois.
          </p>
        </details>
      </section>
      <section className="profile-settings-section">
        <h2>Integrações</h2>
        <SettingsRow title="WhatsApp" description="Gerencie o número conectado." to="/integracoes" />
      </section>
      <section className="profile-settings-section profile-danger-section">
        <h2>Conta</h2>
        <SettingsRow
          title="Excluir minha conta"
          description="A exclusão é permanente."
          danger
          onClick={() => {
            setError('');
            setDeleting(true);
          }}
        />
      </section>
      {error && !deleting && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {deleting && (
        <Dialog
          title="Excluir tudo permanentemente?"
          onClose={() => {
            if (!pending) setDeleting(false);
          }}
        >
          <div className="simple-form">
            <p>Esta ação não pode ser desfeita. Para confirmar, escreva a frase abaixo.</p>
            <label>
              Digite EXCLUIR MINHA CONTA
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button
              variant="danger"
              disabled={pending || confirmation !== 'EXCLUIR MINHA CONTA'}
              onClick={() => void removeAccount()}
            >
              {pending ? 'Excluindo…' : 'Confirmar exclusão permanente'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setDeleting(false)}>
              Cancelar e voltar
            </Button>
          </div>
        </Dialog>
      )}
    </ProfileSubpageLayout>
  );
}
