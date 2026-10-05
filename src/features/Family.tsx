import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, RefreshCw, Users, X } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import { formatMoney } from '../../shared/financial-engine';
import { transactionSchema } from '../../shared/domain';
type Invite = {
  id: string;
  owner_id: string;
  viewer_id: string | null;
  owner_name: string;
  viewer_name: string | null;
  viewer_email: string | null;
  scope: 'summary' | 'transactions';
  state: 'invited' | 'pending' | 'active' | 'revoked';
  expires_at: string;
};
type Snapshot = {
  owner_name: string;
  month: string;
  scope: 'summary' | 'transactions';
  income: number;
  expenses: number;
  net: number;
  transactions: ReturnType<typeof transactionSchema.parse>[];
};
async function rpc<Reply>(name: string, body: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Entre em uma conta real para compartilhar.');
  const { data, error } = await supabase.rpc(name, body);
  if (error) throw new Error('Não foi possível concluir. Confira o convite, sua permissão e a conexão.');
  return data as Reply;
}
export function FamilyPage() {
  const app = useApp();
  const [scope, setScope] = useState<'summary' | 'transactions'>('summary');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [created, setCreated] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ invite: Invite; action: 'approve' | 'revoke' } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const invites = useQuery({
    queryKey: ['family-invites', app.user?.id],
    queryFn: () => rpc<Invite[]>('list_family_invites'),
    enabled: !app.demo && !!app.user,
    refetchInterval: 15000,
    retry: false,
  });
  const snapshot = useQuery({
    queryKey: ['family-snapshot', app.user?.id, selected],
    queryFn: () => rpc<Snapshot>('family_snapshot', { invite_id: selected }),
    enabled: !app.demo && !!selected,
    refetchInterval: 10000,
    retry: false,
  });
  async function action(operation: () => Promise<void>) {
    setPending(true);
    setError('');
    try {
      await operation();
      await invites.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setPending(false);
    }
  }
  const labels = {
    invited: 'Convite criado',
    pending: 'Aguardando aprovação do dono',
    active: 'Acesso aprovado',
    revoked: 'Acesso revogado',
  };
  return (
    <>
      <header className="simple-heading">
        <h1>Finanças em família</h1>
        <p>
          Você escolhe quem pode consultar e o que compartilhar. Ninguém recebe permissão para alterar suas
          anotações.
        </p>
      </header>
      {app.demo ? (
        <p className="notice">
          Compartilhamento requer duas contas reais. Nenhum dado desta demonstração é enviado a outra pessoa.
        </p>
      ) : (
        <>
          <section className="simple-form">
            <h2>Convidar alguém para consultar</h2>
            <label>
              O que compartilhar
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as 'summary' | 'transactions');
                  setConsent(false);
                  setCreated('');
                }}
              >
                <option value="summary">Somente resumo do mês</option>
                <option value="transactions">Resumo e últimas 100 anotações</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              Concordo em criar um convite de consulta para este escopo. Vou aprovar a pessoa antes de liberar
              os dados.
            </label>
            <div>
              <Button
                disabled={!consent || pending}
                onClick={() =>
                  void action(async () => {
                    const result = await rpc<{ code: string }>('create_family_invite', {
                      selected_scope: scope,
                    });
                    setCreated(result.code);
                    setConsent(false);
                  })
                }
              >
                <Users size={18} />
                Criar convite
              </Button>
            </div>
            {created && (
              <div className="family-code">
                <p>Código válido por 24 horas. Compartilhe apenas com a pessoa escolhida.</p>
                <code>{created}</code>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(created)
                      .then(() => app.toast('Código copiado.'))
                      .catch(() => setError('Selecione o código e copie manualmente.'))
                  }
                >
                  <Copy size={18} />
                  Copiar código
                </Button>
              </div>
            )}
          </section>
          <form
            className="simple-form"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await rpc('request_family_access', { invite_code: code.trim() });
                setCode('');
                app.toast('Pedido enviado. Aguarde a aprovação do dono.');
              });
            }}
          >
            <h2>Recebi um convite</h2>
            <label>
              Código do convite
              <input
                required
                pattern="[a-fA-F0-9]{32}"
                maxLength={32}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <div>
              <Button disabled={pending || !code.trim()}>Pedir acesso</Button>
            </div>
          </form>
          <section className="simple-form">
            <div className="simple-section-title">
              <h2>Permissões</h2>
              <Button
                variant="ghost"
                title="Atualizar permissões"
                aria-label="Atualizar permissões"
                onClick={() => void invites.refetch()}
              >
                <RefreshCw size={18} />
              </Button>
            </div>
            {invites.isError ? (
              <p className="error-message" role="alert">
                Não foi possível carregar as permissões. Confira se o banco foi atualizado.
              </p>
            ) : invites.isPending ? (
              <p role="status">Carregando permissões…</p>
            ) : invites.data?.length ? (
              <ul className="family-list">
                {invites.data.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <h3>
                        {invite.owner_id === app.user?.id
                          ? (invite.viewer_name ?? 'Convite aguardando destinatário')
                          : invite.owner_name}
                      </h3>
                      {invite.owner_id === app.user?.id && invite.viewer_email && (
                        <p className="muted">{invite.viewer_email}</p>
                      )}
                      <p>
                        {labels[invite.state]} ·{' '}
                        {invite.scope === 'summary' ? 'Somente resumo' : 'Resumo e anotações'}
                      </p>
                    </div>
                    <div className="simple-inline-actions">
                      {invite.state === 'pending' && invite.owner_id === app.user?.id && (
                        <Button disabled={pending} onClick={() => setConfirm({ invite, action: 'approve' })}>
                          <Check size={18} />
                          Aprovar pessoa
                        </Button>
                      )}
                      {invite.state === 'active' && invite.viewer_id === app.user?.id && (
                        <Button variant="secondary" onClick={() => setSelected(invite.id)}>
                          Consultar
                        </Button>
                      )}
                      {invite.state !== 'revoked' && (
                        <Button
                          variant="secondary"
                          disabled={pending}
                          onClick={() => setConfirm({ invite, action: 'revoke' })}
                        >
                          <X size={18} />
                          Revogar acesso
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum convite ou acesso compartilhado.</p>
            )}
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {selected && (
        <section className="simple-form" aria-live="polite">
          <h2>Consulta familiar</h2>
          {snapshot.isError ? (
            <p className="error-message">
              O acesso não está disponível. Pode ter sido revogado; nenhum dado será mostrado nesta consulta.
            </p>
          ) : snapshot.isPending ? (
            <p role="status">Conferindo a permissão…</p>
          ) : (
            snapshot.data && (
              <>
                <p>
                  {snapshot.data.owner_name} · {snapshot.data.month}
                </p>
                <div className="simple-totals">
                  <div>
                    <span>Entrou</span>
                    <strong>{formatMoney(snapshot.data.income)}</strong>
                  </div>
                  <div>
                    <span>Saiu</span>
                    <strong>{formatMoney(snapshot.data.expenses)}</strong>
                  </div>
                  <div>
                    <span>Diferença</span>
                    <strong>{formatMoney(snapshot.data.net)}</strong>
                  </div>
                </div>
                <p className="muted">Resumo das anotações, não saldo bancário. Somente consulta.</p>
                {snapshot.data.scope === 'transactions' && (
                  <ul className="evidence-list">
                    {transactionSchema
                      .array()
                      .parse(snapshot.data.transactions)
                      .map((record) => (
                        <li key={record.id}>
                          <span>
                            {record.description} · {record.date}
                          </span>
                          <strong>{formatMoney(record.amount)}</strong>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )
          )}
        </section>
      )}
      {confirm && (
        <Dialog
          title={confirm.action === 'approve' ? 'Aprovar compartilhamento?' : 'Revogar acesso?'}
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        >
          <div className="simple-form">
            <p>{confirm.invite.viewer_name ?? confirm.invite.owner_name}</p>
            {confirm.invite.viewer_email && <p>{confirm.invite.viewer_email}</p>}
            <p>
              {confirm.action === 'approve'
                ? `Esta pessoa poderá consultar ${confirm.invite.scope === 'summary' ? 'somente seu resumo mensal' : 'seu resumo e as últimas 100 anotações'}. Não poderá editar.`
                : 'Novas consultas serão bloqueadas. O que já foi visto ou copiado pela pessoa não pode ser apagado remotamente.'}
            </p>
            <Button
              disabled={pending}
              onClick={() =>
                void action(async () => {
                  await rpc(confirm.action === 'approve' ? 'approve_family_access' : 'revoke_family_access', {
                    invite_id: confirm.invite.id,
                  });
                  if (selected === confirm.invite.id) setSelected(null);
                  setConfirm(null);
                })
              }
            >
              Confirmar {confirm.action === 'approve' ? 'aprovação' : 'revogação'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
