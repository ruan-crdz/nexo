import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import { useTheme } from '../design-system/theme';
import { cacheDataset, offlineEnabled, pendingTransactions, setOffline } from '../data/offline';
import { formatDateTimePtBr } from '../../shared/date-format';
import {
  ProfileSubpageLayout,
  SettingsRadioRow,
  SettingsRow,
  SettingsToggleRow,
} from './ProfileSubpageLayout';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '')
    .join('');
}

function ProfileHeader({ title, backTo = '/perfil' }: { title: string; backTo?: string }) {
  return (
    <header className="profile-page-header">
      <Link to={backTo} className="profile-back-link" aria-label="Voltar">
        <ArrowLeft size={20} />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}

function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="profile-index-group" aria-labelledby={`profile-group-${title}`}>
      <h2 id={`profile-group-${title}`}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function ProfileRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="profile-index-row" to={to}>
      <span>{children}</span>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  );
}

function ProfileHome() {
  const app = useApp();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number | null>(0);
  const [error, setError] = useState('');

  async function openSignOut() {
    setError('');
    if (app.user && offlineEnabled(app.user.id)) {
      setPending(true);
      try {
        setPendingOfflineCount((await pendingTransactions(app.user.id)).length);
      } catch {
        setPendingOfflineCount(null);
      } finally {
        setPending(false);
      }
    } else setPendingOfflineCount(0);
    setLeaving(true);
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

  async function syncAndSignOut() {
    if (!app.user) return;
    setPending(true);
    setError('');
    try {
      await app.refresh();
      const remaining = await pendingTransactions(app.user.id);
      setPendingOfflineCount(remaining.length);
      if (remaining.length) throw new Error('Ainda há alterações sem sincronizar.');
      await app.signOut();
      navigate('/login');
    } catch {
      setError('Não foi possível sincronizar e sair. Suas pendências continuam neste aparelho.');
    } finally {
      setPending(false);
    }
  }

  if (app.demo) {
    return (
      <div className="profile-page">
        <ProfileHeader title="Perfil" backTo="/inicio" />
        <section className="profile-demo-intro">
          <span className="profile-avatar" aria-hidden="true">
            {initials(app.data.profile.name)}
          </span>
          <p>Você está no modo demonstração.</p>
          <Link className="button" to="/cadastro">
            Criar minha conta
          </Link>
        </section>
        <ProfileGroup title="Preferências">
          <ProfileRow to="/perfil/aparencia">Aparência</ProfileRow>
        </ProfileGroup>
        <ProfileGroup title="Ajuda">
          <ProfileRow to="/ajuda">Como usar o Nexo</ProfileRow>
          <ProfileRow to="/">Sobre o Nexo</ProfileRow>
        </ProfileGroup>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <ProfileHeader title="Perfil" backTo="/inicio" />
      <section className="profile-identity" aria-label="Sua conta">
        <span className="profile-avatar" aria-hidden="true">
          {initials(app.data.profile.name)}
        </span>
        <h2>{app.data.profile.name}</h2>
        {app.user?.email && <p>{app.user.email}</p>}
        <ProfileRow to="/perfil/editar">Editar perfil</ProfileRow>
      </section>
      <ProfileGroup title="Conta">
        <ProfileRow to="/perfil/aparencia">Aparência</ProfileRow>
        <ProfileRow to="/perfil/offline">Uso sem internet</ProfileRow>
      </ProfileGroup>
      <ProfileGroup title="Conexões">
        <ProfileRow to="/integracoes">WhatsApp</ProfileRow>
        <ProfileRow to="/familia">Família</ProfileRow>
        <ProfileRow to="/importar">Importar dados</ProfileRow>
      </ProfileGroup>
      <ProfileGroup title="Preferências">
        <ProfileRow to="/perfil/avisos">Avisos</ProfileRow>
        <ProfileRow to="/privacidade">Privacidade e dados</ProfileRow>
      </ProfileGroup>
      <ProfileGroup title="Segurança">
        <ProfileRow to="/seguranca">Proteção</ProfileRow>
      </ProfileGroup>
      <ProfileGroup title="Ajuda">
        <ProfileRow to="/ajuda">Como usar o Nexo</ProfileRow>
      </ProfileGroup>
      <button className="profile-signout" type="button" onClick={() => void openSignOut()}>
        Sair
      </button>
      {leaving && (
        <Dialog title="Sair do Nexo?" onClose={() => !pending && setLeaving(false)}>
          <div className="simple-form">
            {pendingOfflineCount === null ? (
              <>
                <p>Não foi possível conferir se há alterações sem sincronizar neste aparelho.</p>
                <p>Sair pode remover alterações que ainda estejam apenas neste aparelho.</p>
              </>
            ) : pendingOfflineCount > 0 ? (
              <>
                <p>
                  Há {pendingOfflineCount} {pendingOfflineCount === 1 ? 'alteração' : 'alterações'} que ainda
                  não foram sincronizadas.
                </p>
                <p>Sair agora pode removê-las deste aparelho.</p>
              </>
            ) : (
              <p>Você precisará entrar novamente para acessar sua conta.</p>
            )}
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {pendingOfflineCount === null || pendingOfflineCount > 0 ? (
              <>
                <Button disabled={pending || !navigator.onLine} onClick={() => void syncAndSignOut()}>
                  Sincronizar primeiro
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => void signOut()}>
                  Sair mesmo assim
                </Button>
              </>
            ) : (
              <Button variant="ghost" disabled={pending} onClick={() => void signOut()}>
                Sair
              </Button>
            )}
            <Button variant="secondary" disabled={pending} onClick={() => setLeaving(false)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function EditProfilePage() {
  const app = useApp();
  const [name, setName] = useState(app.data.profile.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const changed = name.trim() !== app.data.profile.name;
  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await app.repository.profile({ ...app.data.profile, name: name.trim() });
      await app.refresh();
      app.toast('Nome atualizado.');
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <ProfileSubpageLayout title="Editar perfil">
      <form className="profile-edit-form" onSubmit={(event) => void save(event)}>
        <div className="profile-identity profile-edit-identity">
          <span className="profile-avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <h2>{name.trim() || 'Seu nome'}</h2>
          <p>{app.user?.email ?? 'E-mail não disponível'}</p>
        </div>
        <label>
          Nome
          <input
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {changed && <Button disabled={pending}>{pending ? 'Salvando…' : 'Salvar alterações'}</Button>}
      </form>
    </ProfileSubpageLayout>
  );
}

function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const themes: { value: 'system' | 'light' | 'dark'; label: string; description?: string }[] = [
    {
      value: 'system',
      label: 'Usar configuração do celular',
      description: 'Acompanha automaticamente o tema do aparelho.',
    },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
  ] as const;
  return (
    <ProfileSubpageLayout title="Aparência">
      <fieldset className="profile-theme-settings">
        <legend>Tema</legend>
        {themes.map((option) => (
          <SettingsRadioRow
            key={option.value}
            title={option.label}
            description={option.description}
            name="profile-theme"
            value={option.value}
            checked={theme === option.value}
            onChange={() => setTheme(option.value)}
          />
        ))}
      </fieldset>
    </ProfileSubpageLayout>
  );
}

async function readPendingOfflineQueue(userId: string) {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      pendingTransactions(userId),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('timeout')), 8000);
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function OfflinePage() {
  const app = useApp();
  const userId = app.user?.id;
  const [enabled, setEnabled] = useState(() => (userId ? offlineEnabled(userId) : false));
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let current = true;
    if (!userId || !enabled) {
      setPendingCount(0);
      setSyncState('ready');
      return () => {
        current = false;
      };
    }
    setSyncState('loading');
    void readPendingOfflineQueue(userId)
      .then((rows) => {
        if (current) {
          setPendingCount(rows.length);
          setSyncState('ready');
        }
      })
      .catch(() => {
        if (current) {
          setPendingCount(null);
          setSyncState('error');
        }
      });
    return () => {
      current = false;
    };
  }, [enabled, userId]);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  async function update(enabledNow: boolean) {
    if (!userId || busy) return;
    setBusy(true);
    setError('');
    try {
      await setOffline(userId, enabledNow);
      if (enabledNow) await cacheDataset(userId, app.data);
      setEnabled(enabledNow);
    } catch {
      if (enabledNow) await setOffline(userId, false).catch(() => {});
      setError('Não foi possível configurar o armazenamento neste aparelho.');
    } finally {
      setBusy(false);
    }
  }
  async function syncNow() {
    if (!userId || busy || !online) return;
    setBusy(true);
    setSyncState('loading');
    setError('');
    try {
      await app.refresh();
      const rows = await readPendingOfflineQueue(userId);
      setPendingCount(rows.length);
      setSyncState('ready');
    } catch {
      setSyncState('error');
      setError('Não foi possível sincronizar agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProfileSubpageLayout title="Uso sem internet">
      {!userId || app.demo ? (
        <div className="profile-demo-guard">
          <p className="muted">O uso sem internet precisa de uma conta real.</p>
          <Link className="button button-primary" to="/cadastro">
            Criar minha conta
          </Link>
          <Link className="profile-secondary-link" to="/perfil">
            Voltar ao Perfil
          </Link>
        </div>
      ) : (
        <>
          <SettingsToggleRow
            title="Disponível neste aparelho"
            description="Use o Nexo mesmo quando estiver temporariamente sem conexão."
            checked={enabled}
            disabled={busy}
            onChange={(value) => {
              if (value && !enabled) setConfirming(true);
              else if (!value && (pendingCount === null || pendingCount > 0)) setConfirmingDisable(true);
              else void update(value);
            }}
          />
          <p className="muted">Evite ativar em aparelhos compartilhados.</p>
          {enabled && (
            <section className="profile-sync-section" aria-labelledby="offline-sync-title">
              <h2 id="offline-sync-title">Sincronização</h2>
              {syncState === 'loading' ? (
                <p role="status">Conferindo alterações…</p>
              ) : syncState === 'error' ? (
                <div className="profile-inline-status" role="alert">
                  <p>Não consegui conferir agora.</p>
                  <Button variant="secondary" disabled={busy} onClick={() => void syncNow()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : pendingCount && pendingCount > 0 ? (
                <>
                  <p role="status">{pendingCount} alterações aguardando envio.</p>
                  {!online ? (
                    <p role="status">Sem conexão. Serão enviadas quando a internet voltar.</p>
                  ) : (
                    <Button variant="secondary" disabled={busy} onClick={() => void syncNow()}>
                      {busy ? 'Sincronizando…' : 'Sincronizar agora'}
                    </Button>
                  )}
                </>
              ) : !online ? (
                <p role="status">Sem conexão. As alterações serão enviadas quando a internet voltar.</p>
              ) : (
                <p className="profile-inline-status" role="status">
                  Tudo atualizado.
                </p>
              )}
            </section>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Link className="profile-secondary-link" to="/privacidade">
            Como seus dados são protegidos
          </Link>
          {confirming && (
            <Dialog title="Usar Nexo sem internet?" onClose={() => !busy && setConfirming(false)}>
              <div className="simple-form">
                <p>Uma cópia protegida dos dados necessários será mantida neste aparelho.</p>
                <p>Evite ativar em aparelhos compartilhados.</p>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    void update(true);
                  }}
                >
                  Ativar
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            </Dialog>
          )}
          {confirmingDisable && (
            <Dialog title="Desativar uso sem internet?" onClose={() => !busy && setConfirmingDisable(false)}>
              <div className="simple-form">
                <p>
                  {pendingCount === null
                    ? 'Não foi possível conferir a fila. Desativar removerá a cópia e pode apagar alterações ainda não sincronizadas.'
                    : `${pendingCount} alterações ainda não foram sincronizadas. Desativar removerá a cópia deste aparelho.`}
                </p>
                {pendingCount !== 0 && online && (
                  <Button variant="secondary" disabled={busy} onClick={() => void syncNow()}>
                    {busy ? 'Sincronizando…' : 'Sincronizar primeiro'}
                  </Button>
                )}
                {pendingCount === 0 ? (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setConfirmingDisable(false);
                      void update(false);
                    }}
                  >
                    Desativar
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmingDisable(false);
                      void update(false);
                    }}
                  >
                    Desativar mesmo assim
                  </Button>
                )}
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDisable(false)}>
                  Cancelar
                </Button>
              </div>
            </Dialog>
          )}
        </>
      )}
    </ProfileSubpageLayout>
  );
}

function ProfileNoticesPage() {
  const app = useApp();
  const location = useLocation();
  const historyOnly = location.pathname.endsWith('/historico');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({
    reminders_enabled: app.data.profile.reminders_enabled,
    weekly_digest: app.data.profile.weekly_digest,
    whatsapp_notifications: app.data.profile.whatsapp_notifications,
  });
  async function update(key: keyof typeof preferences, enabled: boolean) {
    if (pending) return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: enabled });
    setPending(true);
    setError('');
    let stored = false;
    try {
      await app.repository.profile({ ...app.data.profile, ...previous, [key]: enabled });
      stored = true;
      await app.refresh();
    } catch {
      if (!stored) setPreferences(previous);
      setError(
        stored
          ? 'A preferência foi salva, mas a tela não atualizou. Recarregue para conferir.'
          : 'Não foi possível atualizar. A preferência anterior foi mantida.',
      );
    } finally {
      setPending(false);
    }
  }
  const history = useQuery({
    queryKey: ['financial-notifications', app.user?.id],
    enabled: historyOnly && !app.demo && !!app.user && app.data.profile.whatsapp_notifications,
    retry: 1,
    retryDelay: 1000,
    queryFn: async ({ signal }) => {
      const result = await supabase!
        .from('financial_notifications')
        .select('id,kind,state,error_code,created_at')
        .eq('user_id', app.user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(12000)]));
      if (result.error) throw new Error('Não foi possível conferir o histórico.');
      return result.data;
    },
  });
  const choices = [
    { key: 'reminders_enabled', label: 'Vencimentos e limites', group: 'Nexo' },
    { key: 'weekly_digest', label: 'Resumo semanal', group: 'Nexo' },
    { key: 'whatsapp_notifications', label: 'Enviar avisos', group: 'WhatsApp' },
  ] as const;
  const notificationStates: Record<string, string> = {
    pending: 'Aguardando',
    processing: 'Em processamento',
    accepted: 'Recebido pelo serviço',
    delivered: 'Entregue',
    read: 'Lido',
    failed: 'Não entregue',
    retry: 'Nova tentativa programada',
    reconcile: 'Status indisponível',
    uncertain: 'Status indisponível',
    cancelled: 'Cancelado',
  };
  return (
    <ProfileSubpageLayout title={historyOnly ? 'Histórico de avisos' : 'Avisos'}>
      {!historyOnly && (
        <>
          {(['Nexo', 'WhatsApp'] as const).map((group) => (
            <section className="profile-settings-section" key={group}>
              <h2>{group}</h2>
              {app.demo && group === 'WhatsApp' ? (
                <SettingsRow
                  title="Conectar WhatsApp"
                  description="Crie uma conta para gerenciar esta integração."
                  to="/cadastro"
                />
              ) : (
                choices
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <SettingsToggleRow
                      key={item.key}
                      title={item.label}
                      checked={preferences[item.key]}
                      disabled={pending}
                      onChange={(value) => void update(item.key, value)}
                    />
                  ))
              )}
            </section>
          ))}
          {!app.demo && preferences.whatsapp_notifications && (
            <Link className="profile-index-row" to="/perfil/avisos/historico">
              <span>Histórico de avisos</span>
              <ChevronRight size={20} />
            </Link>
          )}
        </>
      )}
      {historyOnly && app.demo ? (
        <div className="profile-demo-guard">
          <p className="muted">O histórico de avisos do WhatsApp precisa de uma conta real.</p>
          <Link className="button button-primary" to="/cadastro">
            Criar minha conta
          </Link>
          <Link className="profile-secondary-link" to="/perfil">
            Voltar ao Perfil
          </Link>
        </div>
      ) : historyOnly && !app.data.profile.whatsapp_notifications ? (
        <p className="muted">Ative avisos pelo WhatsApp em Avisos para consultar este histórico.</p>
      ) : (
        historyOnly && (
          <section className="profile-detail-section">
            <p className="muted">Últimos avisos enviados ao WhatsApp vinculado.</p>
            {history.isError ? (
              <p role="alert" className="error-message">
                Não foi possível conferir o histórico.
              </p>
            ) : history.isPending ? (
              <p role="status">Conferindo avisos…</p>
            ) : history.data?.length ? (
              <ul className="evidence-list">
                {history.data.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.kind === 'weekly'
                        ? 'Resumo semanal'
                        : item.kind === 'budget'
                          ? 'Limite'
                          : 'Vencimento'}
                    </span>
                    <span>
                      {notificationStates[item.state] ?? 'Status indisponível'}
                      <small>
                        {formatDateTimePtBr(item.created_at, { timeZone: app.data.profile.timezone })}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhum aviso registrado.</p>
            )}
          </section>
        )
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </ProfileSubpageLayout>
  );
}

export function ProfileExperience() {
  const { pathname } = useLocation();
  if (pathname === '/perfil/editar') return <EditProfilePage />;
  if (pathname === '/perfil/aparencia') return <AppearancePage />;
  if (pathname === '/perfil/offline') return <OfflinePage />;
  if (pathname.startsWith('/perfil/avisos')) return <ProfileNoticesPage />;
  return <ProfileHome />;
}
