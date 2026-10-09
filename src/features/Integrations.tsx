import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../data/context';
import { invoke, supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import { ProfileSubpageLayout, SettingsRow } from './ProfileSubpageLayout';

type Connection = {
  connected: boolean;
  phone_last_four: string | null;
  chat_url: string;
  delivery_status: string | null;
  message_state: string | null;
  reply_error_code: number | null;
};
type LinkCode = { code: string; message: string; expires_at: string; whatsapp_url: string };

async function withTimeout<Value>(promise: Promise<Value>, milliseconds = 12000) {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('timeout')), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export function IntegrationsPage() {
  const app = useApp();
  const onboarding = new URLSearchParams(useLocation().search).get('onboarding') === '1';
  const [link, setLink] = useState<LinkCode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [now, setNow] = useState(Date.now);
  const connection = useQuery({
    queryKey: ['whatsapp-connection', app.user?.id],
    queryFn: () => withTimeout(invoke<Connection>('whatsapp-link', { action: 'status' })),
    enabled: !app.demo && Boolean(app.user),
    refetchInterval: link ? 6000 : false,
    retry: false,
  });
  useEffect(() => {
    if (!link) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [link]);
  const connected = connection.data?.connected === true;
  const remaining = link ? Math.max(0, Math.ceil((Date.parse(link.expires_at) - now) / 1000)) : 0;
  const waiting = link && remaining > 0 && !connected;

  async function connect() {
    if (app.demo) {
      setError('Entre na sua conta para conectar o WhatsApp. Nenhuma mensagem foi enviada.');
      return;
    }
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setPending(true);
    setError('');
    try {
      const result = await invoke<LinkCode>('whatsapp-link', { action: 'create' });
      setNow(Date.now());
      setLink(result);
      if (popup) popup.location.replace(result.whatsapp_url);
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a conexão. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function revoke() {
    setPending(true);
    const result = await supabase!.from('whatsapp_connections').delete().eq('user_id', app.user!.id);
    setPending(false);
    if (result.error) {
      setError('Não foi possível desconectar. Tente novamente.');
      return;
    }
    setLink(null);
    setRevoking(false);
    await connection.refetch();
    app.toast('WhatsApp desconectado. Seus movimentos continuam no app.');
  }
  return (
    <ProfileSubpageLayout title="WhatsApp" backTo={onboarding ? '/onboarding?step=whatsapp' : '/perfil'}>
      <section className="profile-detail-section profile-whatsapp-section">
        {!connected ? (
          <>
            <div className="profile-service-mark" aria-hidden="true">
              <MessageCircle size={28} />
            </div>
            <h2>Use o Nexo pelo WhatsApp</h2>
            <p className="muted">Anote gastos, entradas e envie áudios sem abrir o aplicativo.</p>
            {app.demo ? (
              <Link className="button button-primary" to="/cadastro">
                Criar conta para conectar
              </Link>
            ) : waiting ? (
              <>
                <p role="status">Conectando seu WhatsApp. Abra a conversa preparada para você.</p>
                <a
                  className="button button-primary"
                  href={link.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp <ExternalLink size={16} />
                </a>
                <p className="muted">
                  Código válido por {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}.
                </p>
                <details>
                  <summary>Copiar mensagem</summary>
                  <p>{link.message}</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(link.message)
                        .then(() => app.toast('Mensagem copiada.'))
                        .catch(() => setError('Selecione e copie a mensagem.'))
                    }
                  >
                    <Copy size={16} /> Copiar mensagem
                  </Button>
                </details>
                <Button
                  variant="ghost"
                  disabled={connection.isFetching}
                  onClick={() => void connection.refetch()}
                >
                  <RefreshCw size={16} /> Verificar novamente
                </Button>
              </>
            ) : (
              <>
                {connection.isPending && <p role="status">Conferindo conexão…</p>}
                {connection.isError && (
                  <Button variant="secondary" onClick={() => void connection.refetch()}>
                    Tentar novamente
                  </Button>
                )}
                <Button
                  disabled={pending || connection.isPending || connection.isError}
                  onClick={() => void connect()}
                >
                  <MessageCircle size={18} />{' '}
                  {pending ? 'Preparando…' : link ? 'Gerar novo código' : 'Conectar WhatsApp'}
                </Button>
              </>
            )}
            {link && !waiting && <p className="muted">O código expirou. Gere um novo para continuar.</p>}
          </>
        ) : (
          <>
            <p className="profile-inline-status" role="status">
              <CheckCircle2 size={20} /> Conectado
            </p>
            <p className="muted">
              +•• ••••••{connection.data?.phone_last_four ? `-${connection.data.phone_last_four}` : ''}
            </p>
            <a
              className="button button-primary"
              href={connection.data?.chat_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir conversa <ExternalLink size={16} />
            </a>
            <SettingsRow title="Desconectar WhatsApp" danger onClick={() => setRevoking(true)} />
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {onboarding && (
          <Link className="profile-secondary-link" to="/onboarding?step=objective">
            {connected ? 'Continuar' : 'Continuar sem conectar'}
          </Link>
        )}
      </section>
      <section className="profile-settings-section">
        <h2>O que você pode mandar</h2>
        <p>“Gastei 20 no almoço”</p>
        <p>“Recebi 3.500”</p>
        <p>Você também pode enviar áudios ou pedir “resumo”.</p>
      </section>
      {connected && (
        <details className="profile-management-details">
          <summary>Gerenciar</summary>
          <a
            className="profile-setting-row"
            href={`${connection.data?.chat_url}?text=ajuda`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="profile-setting-copy">
              <span className="profile-setting-title">Receber dicas no WhatsApp</span>
            </span>
            <ExternalLink size={18} aria-hidden="true" />
          </a>
          {!app.demo && (
            <Button
              variant="ghost"
              disabled={connection.isFetching}
              onClick={() => void connection.refetch()}
            >
              Atualizar conexão
            </Button>
          )}
        </details>
      )}
      {revoking && (
        <Dialog title="Desconectar WhatsApp?" onClose={() => setRevoking(false)}>
          <p>
            Você precisará vincular novamente para registrar pela conversa. Seus movimentos salvos continuam
            no Nexo.
          </p>
          <div className="form-actions">
            <Button variant="secondary" disabled={pending} onClick={() => setRevoking(false)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => void revoke()}>
              Confirmar desconexão
            </Button>
          </div>
        </Dialog>
      )}
    </ProfileSubpageLayout>
  );
}
