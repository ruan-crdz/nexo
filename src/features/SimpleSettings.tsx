import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, ShieldCheck, ChevronRight, LogOut } from 'lucide-react';
import { useApp } from '../data/context';
import { invoke, supabase } from '../data/client';
import { useTheme } from '../design-system/theme';
import { Button, Dialog } from '../design-system/components';
import { offlineEnabled, setOffline, cacheDataset } from '../data/offline';
import { ProfileSubpageLayout, SettingsRow } from './ProfileSubpageLayout';

export function SimpleSettings() {
  const app = useApp();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(app.data.profile.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deviceOffline, setDeviceOffline] = useState(() => (app.user ? offlineEnabled(app.user.id) : false));
  const [notificationPreferences, setNotificationPreferences] = useState({
    reminders_enabled: app.data.profile.reminders_enabled,
    weekly_digest: app.data.profile.weekly_digest,
    whatsapp_notifications: app.data.profile.whatsapp_notifications,
    metrics_enabled: app.data.profile.metrics_enabled,
  });
  async function updateNotificationPreference(key: keyof typeof notificationPreferences, enabled: boolean) {
    if (pending) return;
    const previous = notificationPreferences;
    const next = { ...previous, [key]: enabled };
    setNotificationPreferences(next);
    setPending(true);
    setError('');
    let stored = false;
    try {
      await app.repository.profile({ ...app.data.profile, ...next });
      stored = true;
      await app.refresh();
    } catch {
      if (!stored) setNotificationPreferences(previous);
      setError(
        stored
          ? 'Sua preferência foi salva, mas não conseguimos atualizar a tela. Recarregue para conferir.'
          : 'Não foi possível atualizar seu consentimento. Sua preferência anterior foi mantida.',
      );
    } finally {
      setPending(false);
    }
  }
  const notificationHistory = useQuery({
    queryKey: ['financial-notifications', app.user?.id],
    enabled: !app.demo && !!app.user && app.data.profile.whatsapp_notifications,
    retry: false,
    queryFn: async () => {
      const result = await supabase!
        .from('financial_notifications')
        .select('id,kind,state,error_code,created_at')
        .eq('user_id', app.user!.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (result.error) throw new Error('Não foi possível conferir o histórico.');
      return result.data;
    },
  });
  const notificationService = useQuery({
    queryKey: ['notification-status', app.user?.id],
    enabled: !app.demo && !!app.user,
    queryFn: () => invoke<{ available: boolean; message: string }>('notification-status', {}),
    retry: false,
    staleTime: 60_000,
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setSaved(false);
    try {
      await app.repository.profile({ ...app.data.profile, name: name.trim() });
      await app.refresh();
      setSaved(true);
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function signOut() {
    setPending(true);
    setError('');
    try {
      await app.signOut();
      navigate('/login');
    } catch {
      setError('Não foi possível sair. Confira sua conexão e tente de novo.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="simple-heading">
        <h1>Perfil</h1>
        <p>Sua conta, suas preferências e sua proteção.</p>
      </header>
      <section className="profile-section simple-form">
        <form className="simple-form" onSubmit={(e) => void save(e)}>
          <h2>Minha conta</h2>
          <label>
            Como podemos chamar você?
            <input
              autoComplete="given-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <Button disabled={pending}>Salvar nome</Button>
          {saved && (
            <p className="notice" role="status">
              Seu nome foi atualizado.
            </p>
          )}
        </form>
      </section>
      <section className="profile-section simple-form">
        <div className="simple-form">
          <h2>Aparência</h2>
          <label>
            Escolha o fundo
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}>
              <option value="light">Claro</option>
              <option value="dark">Escuro (modo noturno)</option>
              <option value="system">Igual ao meu celular</option>
            </select>
          </label>
          <p className="muted">Sua escolha fica guardada neste aparelho.</p>
        </div>
      </section>
      {!app.demo && app.user && (
        <section className="simple-form">
          <h2>Uso sem internet</h2>
          <label className="check-label">
            <input
              type="checkbox"
              checked={deviceOffline}
              disabled={pending}
              onChange={(event) => {
                const enabled = event.target.checked;
                setPending(true);
                setError('');
                void setOffline(app.user!.id, enabled)
                  .then(async () => {
                    if (enabled) await cacheDataset(app.user!.id, app.data);
                    setDeviceOffline(enabled);
                  })
                  .catch(() => setError('Não foi possível configurar o armazenamento neste aparelho.'))
                  .finally(() => setPending(false));
              }}
            />
            Guardar uma cópia cifrada e permitir movimentos pendentes neste aparelho.
          </label>
          <p className="muted">
            Não ative em aparelho compartilhado. Desativar ou sair da conta remove a cópia e pendências
            locais.
          </p>
        </section>
      )}
      <section className="profile-links simple-settings-links">
        <h2>Seu dinheiro</h2>
        <Link to="/planejar">
          <span>Planejamento</span>
          <ChevronRight />
        </Link>
        <Link to="/metas">
          <span>Caixinhas</span>
          <ChevronRight />
        </Link>
        <Link to="/controle">
          <span>Posso gastar?</span>
          <ChevronRight />
        </Link>
        <h2>Nexo</h2>
        <Link to="/nexo">
          <span>Perguntar ao Nexo</span>
          <ChevronRight />
        </Link>
        <Link to="/importar">
          <span>Importar extrato</span>
          <ChevronRight />
        </Link>
        <Link to="/recibo">
          <span>Recibos</span>
          <ChevronRight />
        </Link>
        <h2>Pessoas</h2>
        <Link to="/familia">
          <span>Família</span>
          <ChevronRight />
        </Link>
        <h2>Conexões</h2>
        <Link to="/integracoes">
          <MessageCircle />
          <span>Nexo no WhatsApp</span>
          <ChevronRight />
        </Link>
        <h2>Segurança e privacidade</h2>
        <Link to="/seguranca">
          <ShieldCheck />
          <span>Proteção e autenticação</span>
          <ChevronRight />
        </Link>
        <Link to="/privacidade">
          <span>Meus dados e privacidade</span>
          <ChevronRight />
        </Link>
        <h2>Ajuda</h2>
        <Link to="/ajuda">
          <span>Como usar o Nexo</span>
          <ChevronRight />
        </Link>
        <Button variant="secondary" onClick={() => setLeaving(true)}>
          <LogOut size={20} /> Sair da minha conta
        </Button>
      </section>
      <section className="simple-form">
        <h2>Avisos no app</h2>
        <label className="check-label">
          <input
            type="checkbox"
            checked={notificationPreferences.reminders_enabled}
            disabled={pending}
            onChange={(event) => void updateNotificationPreference('reminders_enabled', event.target.checked)}
          />
          Quero avisos de vencimentos e limites no app.
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={notificationPreferences.weekly_digest}
            disabled={pending}
            onChange={(event) => void updateNotificationPreference('weekly_digest', event.target.checked)}
          />
          Quero ver o resumo semanal no app.
        </label>
      </section>
      <label className="check-label">
        <input
          type="checkbox"
          checked={notificationPreferences.whatsapp_notifications}
          disabled={pending || app.demo}
          onChange={(event) =>
            void updateNotificationPreference('whatsapp_notifications', event.target.checked)
          }
        />
        Também autorizo o envio destes avisos para meu WhatsApp vinculado.
      </label>
      {!app.demo && (
        <p role="status">
          {notificationService.isPending
            ? 'Conferindo o serviço de avisos…'
            : notificationService.isError
              ? 'Não foi possível conferir se os avisos automáticos estão disponíveis. Sua preferência fica salva; consulte os avisos no app.'
              : notificationService.data.message}
        </p>
      )}
      {!app.demo && app.data.profile.whatsapp_notifications && (
        <section className="simple-form">
          <h2>Últimos avisos no WhatsApp</h2>
          {notificationHistory.isError ? (
            <p role="alert" className="error-message">
              Não foi possível conferir o histórico de avisos.
            </p>
          ) : notificationHistory.isPending ? (
            <p role="status">Conferindo avisos…</p>
          ) : notificationHistory.data?.length ? (
            <ul className="evidence-list">
              {notificationHistory.data.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.kind === 'weekly'
                      ? 'Resumo semanal'
                      : item.kind === 'budget'
                        ? 'Limite por categoria'
                        : 'Vencimento'}
                  </span>
                  <span>
                    {(
                      {
                        pending: 'Aguardando envio',
                        processing: 'Envio em processamento',
                        accepted: 'Aceito pela Meta; entrega não confirmada',
                        delivered: 'Entregue',
                        read: 'Lido',
                        failed: 'Falha registrada na tentativa',
                        retry: 'Nova tentativa programada após rejeição temporária',
                        reconcile: 'Resultado incerto; não será reenviado automaticamente',
                        cancelled: 'Cancelado',
                      } as Record<string, string>
                    )[item.state] ?? item.state}
                    {item.error_code ? ` · código ${item.error_code}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Nenhum envio registrado. O envio depende do agendamento e de template aprovado.
            </p>
          )}
        </section>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={notificationPreferences.metrics_enabled}
          disabled={pending || app.demo}
          onChange={(event) => void updateNotificationPreference('metrics_enabled', event.target.checked)}
        />
        Autorizo métricas técnicas da minha conta, sem texto, imagens ou valores financeiros. Posso desativar
        depois.
      </label>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {leaving && (
        <Dialog
          title="Sair da sua conta?"
          onClose={() => {
            if (!pending) setLeaving(false);
          }}
        >
          <div className="simple-form">
            <p>Seus movimentos continuam salvos. Para voltar, use seu e-mail e sua senha.</p>
            <p>
              Sincronize pendências offline antes de sair: dados ainda não enviados neste aparelho serão
              removidos.
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending} onClick={() => void signOut()}>
              Sim, sair
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setLeaving(false)}>
              Continuar no Nexo
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SimpleHelp() {
  return (
    <ProfileSubpageLayout title="Como usar o Nexo">
      <section className="profile-settings-section">
        <h2>Começando</h2>
        <details className="profile-help-disclosure">
          <summary>Anotar um gasto</summary>
          <div className="profile-disclosure-content">
            <p>Escreva o valor e onde gastou, como “gastei 25 no mercado”.</p>
            <Link className="profile-secondary-link" to="/inicio">
              Anotar no aplicativo
            </Link>
          </div>
        </details>
        <details className="profile-help-disclosure">
          <summary>Anotar uma entrada</summary>
          <div className="profile-disclosure-content">
            <p>Toque em Anotar entrada e informe o valor recebido.</p>
            <Link className="profile-secondary-link" to="/inicio">
              Ir para o início
            </Link>
          </div>
        </details>
        <details className="profile-help-disclosure">
          <summary>Usar o Nexo no WhatsApp</summary>
          <div className="profile-disclosure-content">
            <p>Envie, por exemplo, “gastei 25 no mercado”, ou mande um áudio.</p>
            <Link className="profile-secondary-link" to="/integracoes">
              Abrir WhatsApp
            </Link>
          </div>
        </details>
        <details className="profile-help-disclosure">
          <summary>Corrigir um movimento</summary>
          <div className="profile-disclosure-content">
            <p>
              Abra Movimentos, escolha o registro e toque em Corrigir ou Excluir. A exclusão pede confirmação.
            </p>
            <Link className="profile-secondary-link" to="/movimentos">
              Ver movimentos
            </Link>
          </div>
        </details>
      </section>
      <section className="profile-settings-section">
        <h2>Entenda seus números</h2>
        <details className="profile-help-disclosure">
          <summary>Como o Nexo calcula seu mês</summary>
          <p className="profile-disclosure-content">
            Entrou soma o que você recebeu; Saiu soma o que pagou. A diferença usa suas anotações.
          </p>
        </details>
        <details className="profile-help-disclosure">
          <summary>Por que não é saldo bancário</summary>
          <p className="profile-disclosure-content">
            O Nexo não consulta sua conta bancária. O resumo reflete apenas os movimentos anotados ou
            importados.
          </p>
        </details>
      </section>
      <section className="profile-settings-section">
        <h2>Atalhos</h2>
        <SettingsRow title="Ir para o Início" to="/inicio" />
        <SettingsRow title="Abrir WhatsApp" to="/integracoes" />
        <SettingsRow title="Ver Histórico" to="/movimentos" />
      </section>
    </ProfileSubpageLayout>
  );
}
