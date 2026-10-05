import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, RefreshCw, Users, X } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import { formatMoney, parseMoney } from '../../shared/financial-engine';
import { categories, transactionSchema } from '../../shared/domain';
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
  account_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  can_propose?: boolean;
};
type Snapshot = {
  owner_name: string;
  month: string;
  start?: string;
  end?: string;
  scope: 'summary' | 'transactions';
  income: number;
  expenses: number;
  net: number;
  can_propose?: boolean;
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
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allowProposals, setAllowProposals] = useState(false);
  const [proposal, setProposal] = useState<Snapshot['transactions'][number] | null>(null);
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalCategory, setProposalCategory] = useState('Outros');
  const proposals = useQuery({
    queryKey: ['family-proposals', app.user?.id],
    enabled: !app.demo && !!app.user,
    retry: false,
    refetchInterval: 15000,
    queryFn: async () => {
      const result = await supabase!
        .from('family_proposals')
        .select('*')
        .eq('owner_id', app.user!.id)
        .eq('state', 'pending')
        .order('created_at');
      if (result.error) throw result.error;
      return result.data;
    },
  });
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
            <label>
              Conta compartilhada
              <select
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value);
                  setConsent(false);
                }}
              >
                <option value="">Todas as contas</option>
                {app.data.financial_accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Período inicial (opcional)
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setConsent(false);
                }}
              />
            </label>
            <label>
              Período final (opcional)
              <input
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setConsent(false);
                }}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                disabled={scope !== 'transactions'}
                checked={allowProposals && scope === 'transactions'}
                onChange={(event) => {
                  setAllowProposals(event.target.checked);
                  setConsent(false);
                }}
              />
              Permitir propostas de correção. Só eu posso aprovar alterações.
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
                      allowed_account: accountId || null,
                      start_date: startDate || null,
                      end_date: endDate || null,
                      allow_proposals: allowProposals && scope === 'transactions',
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
      {proposals.data?.length ? (
        <section className="simple-form">
          <h2>Propostas para revisar</h2>
          {proposals.data.map((item) => (
            <article className="verified-answer" key={item.id}>
              <h3>{item.proposed_data.description}</h3>
              <p>
                Proposto por {item.proposer_id}: {formatMoney(Number(item.before_data.amount))} →{' '}
                {formatMoney(Number(item.proposed_data.amount))} · {item.proposed_data.category}
              </p>
              <div className="simple-inline-actions">
                <Button
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      await rpc('decide_family_proposal', { proposal_id: item.id, approve: true });
                      await proposals.refetch();
                    })
                  }
                >
                  Aprovar proposta
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      await rpc('decide_family_proposal', { proposal_id: item.id, approve: false });
                      await proposals.refetch();
                    })
                  }
                >
                  Rejeitar
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
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
                  {snapshot.data.owner_name} · {snapshot.data.start ?? snapshot.data.month}
                  {snapshot.data.end ? ` a ${snapshot.data.end}` : ''}
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
                          {snapshot.data?.can_propose && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setProposal(record);
                                setProposalDescription(record.description);
                                setProposalAmount(String(record.amount / 100).replace('.', ','));
                                setProposalCategory(record.category);
                              }}
                            >
                              Propor correção
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )
          )}
        </section>
      )}
      {proposal && (
        <Dialog
          title="Propor correção ao dono"
          onClose={() => {
            if (!pending) setProposal(null);
          }}
        >
          <form
            className="simple-form"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await rpc('propose_family_correction', {
                  invite_id: selected,
                  record_id: proposal.id,
                  new_description: proposalDescription,
                  new_amount: parseMoney(proposalAmount),
                  new_category: proposalCategory,
                });
                setProposal(null);
              });
            }}
          >
            <label>
              Descrição
              <input
                required
                minLength={2}
                maxLength={180}
                value={proposalDescription}
                onChange={(event) => setProposalDescription(event.target.value)}
              />
            </label>
            <label>
              Valor sugerido (R$)
              <input
                inputMode="decimal"
                value={proposalAmount}
                onChange={(event) => setProposalAmount(event.target.value)}
              />
            </label>
            <label>
              Categoria
              <select value={proposalCategory} onChange={(event) => setProposalCategory(event.target.value)}>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <p>Nada será alterado até o dono aprovar.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending}>Enviar proposta</Button>
          </form>
        </Dialog>
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
              Conta: {confirm.invite.account_id ? 'Somente a conta escolhida' : 'Todas'} · período:{' '}
              {confirm.invite.period_start ?? 'Início do mês atual'} a {confirm.invite.period_end ?? 'Hoje'} ·
              propostas:{' '}
              {confirm.invite.can_propose ? 'permitidas, sujeitas à sua aprovação' : 'não permitidas'}.
            </p>
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
