import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, Mic, RefreshCw } from 'lucide-react';
import { useApp } from '../data/context';
import { invoke, supabase } from '../data/client';
import { Badge, Button, Card, Dialog, PageHeader, SectionTitle } from '../design-system/components';

type Connection = {
  connected: boolean;
  phone_last_four: string | null;
  chat_url: string;
  delivery_status: string | null;
  reply_error_code: number | null;
};
type LinkCode = { code: string; message: string; expires_at: string; whatsapp_url: string };

export function IntegrationsPage() {
  const app = useApp();
  const [link, setLink] = useState<LinkCode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [now, setNow] = useState(Date.now);
  const connection = useQuery({
    queryKey: ['whatsapp-connection', app.user?.id],
    queryFn: () => invoke<Connection>('whatsapp-link', { action: 'status' }),
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
    <>
      <PageHeader eyebrow="Integrações" title="Mande um oi para sua vida financeira."
        description="Um texto ou áudio no WhatsApp. Seus movimentos organizados no Nexo." />
      <p className="notice bottom-space" role="status">Respostas no WhatsApp temporariamente indisponíveis: a conta do Nexo aguarda liberação da Meta. Confira o vínculo e os registros pelo app; não reenvie um lançamento só porque não recebeu resposta.</p>
      <div className="grid grid-2 whatsapp-grid">
        <Card>
          <SectionTitle action={<Badge tone={connected ? 'green' : 'neutral'}>{app.demo ? 'Demonstração' : connected ? 'Conectado' : waiting ? 'Aguardando sua mensagem' : 'Não conectado'}</Badge>}>
            Nexo no WhatsApp
          </SectionTitle>
          <div className="whatsapp-icon"><MessageCircle size={32} /></div>
          <h3>{connected ? 'Seu número está vinculado.' : 'Menos formulários. Mais conversa.'}</h3>
          <p className="muted whatsapp-intro">{connected
            ? `Seu WhatsApp com final ${connection.data?.phone_last_four} está vinculado à sua conta pessoal.`
            : 'Conecte seu número uma vez. Depois, conte o que recebeu ou gastou e acompanhe tudo por aqui.'}</p>
          {connected ? (
            <div className="stack">
              <div className="notice" role="status"><CheckCircle2 size={20} /> Vínculo confirmado! Já pode enviar texto ou áudio.</div>
              {connection.data?.delivery_status === 'failed' && (
                <div className="error-message" role="alert">
                  {connection.data.reply_error_code === 131030
                    ? 'O vínculo funcionou, mas o número de teste ainda não pode responder ao seu celular. Na Meta, vá a WhatsApp → Etapa 1 → Destinatário/Até e adicione e confirme este mesmo celular. Depois envie “ajuda” na conversa.'
                    : connection.data.reply_error_code === 131031
                    ? 'A Meta bloqueou a conta WhatsApp Business do Nexo. As respostas dependem da liberação dessa conta; autorizar seu celular ou reenviar a mensagem não remove o bloqueio.'
                    : 'Não conseguimos entregar a última resposta no WhatsApp. Confira seus movimentos no app antes de reenviar um lançamento. Para testar a conversa, envie “ajuda”.'}
                </div>
              )}
              <a className="button button-primary" href={connection.data?.chat_url} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Abrir conversa com o Nexo <ExternalLink size={15} /></a>
              <Button variant="ghost" onClick={() => setRevoking(true)}>Desconectar WhatsApp</Button>
            </div>
          ) : (
            <div className="stack">
              <ol className="whatsapp-steps">
                <li><strong>Abra a conversa</strong><span>A mensagem com seu código já vai preenchida.</span></li>
                <li><strong>Toque em Enviar no WhatsApp</strong><span>É isso que confirma a vinculação com sua conta.</span></li>
                <li><strong>Confira o vínculo no app</strong><span>As boas-vindas no WhatsApp dependem da liberação da Meta.</span></li>
              </ol>
              {waiting ? (
                <>
                  <a className="button button-primary" href={link.whatsapp_url} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Abrir WhatsApp <ExternalLink size={15} /></a>
                  <p className="muted" role="status">Aguardando você enviar a mensagem. Código válido por {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}.</p>
                  <details className="whatsapp-fallback"><summary>Prefere copiar a mensagem?</summary><p>{link.message}</p>
                    <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(link.message).then(() => app.toast('Mensagem copiada. Cole na conversa com o Nexo.')).catch(() => setError('Selecione a mensagem acima e copie manualmente.'))}><Copy size={15} /> Copiar mensagem</Button>
                    <small>Não compartilhe este código com outras pessoas.</small>
                  </details>
                </>
              ) : (
                <>
                  {link && <p className="muted">O código expirou. Gere uma nova mensagem para continuar.</p>}
                  <Button disabled={pending || (!app.demo && (connection.isPending || connection.isError))} onClick={() => void connect()}><MessageCircle size={18} />{pending ? 'Preparando sua mensagem…' : link ? 'Gerar nova mensagem' : 'Conectar meu WhatsApp'}</Button>
                  <small className="muted">Ao enviar o código, você autoriza o Nexo a vincular este número à sua conta. Você pode desconectar quando quiser.</small>
                </>
              )}
            </div>
          )}
          {(error || connection.isError) && <p className="error-message" role="alert">{error || 'Não foi possível conferir sua conexão. Atualize o status para tentar novamente.'}</p>}
          {!app.demo && <Button variant="ghost" disabled={connection.isFetching} onClick={() => void connection.refetch()}><RefreshCw size={14} /> Atualizar status</Button>}
        </Card>
        <Card className="whatsapp-preview">
          <p className="eyebrow">Cabe na sua rotina</p>
          <h2>Falou, organizou.</h2>
          <p className="muted">Exemplo de conversa</p>
          <div className="chat-example">
            <div className="chat-example-user">Gastei 25 reais no almoço hoje.</div>
            <div className="chat-example-nexo"><strong>Nexo</strong><p>Registrado: R$ 25,00 em alimentação. Já está no seu app! 🌿</p></div>
            <div className="chat-example-user"><Mic size={17} aria-hidden="true" /> Você também pode mandar áudio.</div>
          </div>
          <div className="stack whatsapp-tips">
            <p><strong>Faltou algum detalhe?</strong><br /><span className="muted">O Nexo pergunta antes de registrar quando precisar de mais informação.</span></p>
            <p><strong>Quer corrigir?</strong><br /><span className="muted">Envie “desfazer” para cancelar o último lote registrado nas últimas 24 horas, ou edite no app.</span></p>
            <p><strong>Precisa de uma mão?</strong><br /><span className="muted">Envie “ajuda” e receba o tutorial novamente.</span></p>
          </div>
        </Card>
      </div>
      {revoking && <Dialog title="Desconectar WhatsApp?" onClose={() => setRevoking(false)}><p>Você precisará vincular novamente para registrar pela conversa. Seus movimentos salvos continuam no Nexo.</p><div className="form-actions"><Button variant="secondary" disabled={pending} onClick={() => setRevoking(false)}>Cancelar</Button><Button variant="danger" disabled={pending} onClick={() => void revoke()}>Confirmar desconexão</Button></div></Dialog>}
    </>
  );
}
