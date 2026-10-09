import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, Plus } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { parseMoney } from '../../shared/financial-engine';
import { categories, transactionSchema } from '../../shared/domain';
import { groupFamilyInvites } from '../../shared/family';
import type { FamilyInvite } from '../../shared/family';
import { formatDatePtBr, formatDateTimePtBr, formatMonthPtBr } from '../../shared/date-format';
import {
  ProfileSubpageLayout,
  SettingsRadioRow,
  SettingsRow,
  SettingsToggleRow,
} from './ProfileSubpageLayout';
type Invite = FamilyInvite;
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
async function rpc<Reply>(name: string, body: Record<string, unknown> = {}, parentSignal?: AbortSignal) {
  if (!supabase) throw new Error('Entre em uma conta real para compartilhar.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal?.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(abort, 10000);
  try {
    const { data, error } = await supabase.rpc(name, body).abortSignal(controller.signal);
    if (error) throw error;
    return data as Reply;
  } catch {
    if (parentSignal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError');
    throw new Error('Não foi possível carregar os dados. Tente novamente.');
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abort);
  }
}

export function FamilyPage() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const dateFormatOptions = { timeZone: app.data.profile.timezone };
  const [scope, setScope] = useState<'summary' | 'transactions'>('summary');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [created, setCreated] = useState('');
  const [inviteStep, setInviteStep] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
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
    retry: 1,
    refetchInterval: 15000,
    queryFn: async ({ signal }) => {
      const result = await supabase!
        .from('family_proposals')
        .select('*')
        .eq('owner_id', app.user!.id)
        .eq('state', 'pending')
        .order('created_at')
        .abortSignal(signal);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const invites = useQuery({
    queryKey: ['family-invites', app.user?.id],
    queryFn: ({ signal }) => rpc<Invite[]>('list_family_invites', {}, signal),
    enabled: !app.demo && !!app.user,
    refetchInterval: 15000,
    retry: 1,
  });
  const relationships = groupFamilyInvites(invites.data ?? [], app.user?.id ?? '');
  const incomingAccesses = relationships.flatMap((person) =>
    person.sharedWithMe.filter((invite) => invite.state === 'active').map((invite) => ({ person, invite })),
  );
  const familyRequests = relationships.flatMap((person) => [
    ...person.sharedByMe
      .filter((invite) => invite.state === 'pending' || invite.state === 'invited')
      .map((invite) => ({ person, invite, direction: 'outgoing' as const })),
    ...person.sharedWithMe
      .filter((invite) => invite.state === 'pending')
      .map((invite) => ({ person, invite, direction: 'incoming' as const })),
  ]);
  const incomingSnapshots = useQueries({
    queries: incomingAccesses.map(({ invite }) => ({
      queryKey: ['family-snapshot', app.user?.id, invite.id],
      enabled: !app.demo && !!app.user,
      retry: 1,
      retryDelay: 1000,
      staleTime: 15000,
      refetchInterval: 30000,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        rpc<Snapshot>('family_snapshot', { invite_id: invite.id }, signal),
    })),
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
    <ProfileSubpageLayout
      title="Família"
      action={
        !app.demo && (
          <Button
            variant="ghost"
            aria-label="Convidar pessoa"
            onClick={() => {
              setInviteStep(0);
              setConsent(false);
              setCreated('');
              setInviteOpen(true);
            }}
          >
            <Plus size={20} />
          </Button>
        )
      }
    >
      {app.demo ? (
        <section className="profile-demo-guard">
          <p className="notice">
            Compartilhamento requer duas contas reais. Nenhum dado desta demonstração é enviado a outra
            pessoa.
          </p>
          <Link className="button button-primary" to="/cadastro">
            Criar minha conta
          </Link>
          <Link className="profile-secondary-link" to="/perfil">
            Voltar ao Perfil
          </Link>
        </section>
      ) : (
        <>
          <p className="profile-page-intro">
            Compartilhe apenas o que quiser. Você pode remover o acesso quando quiser.
          </p>
          <SettingsRow title="Tenho um código" onClick={() => setRequestOpen(true)} />
          {invites.isError && (
            <div className="profile-inline-status" role="alert">
              <p>Não consegui carregar os acessos.</p>
              <Button variant="secondary" onClick={() => void invites.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          <section className="profile-settings-section" aria-labelledby="family-incoming-title">
            <h2 id="family-incoming-title">Quem compartilha comigo</h2>
            {invites.isError ? (
              <p className="muted">Cada acesso poderá ser consultado depois que a conexão voltar.</p>
            ) : invites.isPending ? (
              <p role="status">Carregando acessos…</p>
            ) : incomingAccesses.length ? (
              incomingAccesses.map(({ person, invite }, index) => {
                const query = incomingSnapshots[index];
                const snapshot = query?.data;
                return (
                  <article className="family-summary-card" key={invite.id}>
                    <header className="family-summary-heading">
                      <span className="profile-avatar" aria-hidden="true">
                        {person.name.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}
                      </span>
                      <div>
                        <h3>{person.name}</h3>
                        <p className="muted">
                          Compartilhando{' '}
                          {invite.scope === 'summary' ? 'resumo comigo' : 'movimentações comigo'}
                        </p>
                      </div>
                    </header>
                    {query?.isPending ? (
                      <p role="status">Carregando resumo…</p>
                    ) : query?.isError ? (
                      <div className="profile-inline-status" role="alert">
                        <p>Não consegui carregar os dados de {person.name}.</p>
                        <Button variant="secondary" onClick={() => void query.refetch()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : snapshot ? (
                      <>
                        <p className="muted">
                          {formatMonthPtBr(snapshot.month, dateFormatOptions) ?? 'Mês indisponível'}
                        </p>
                        <dl className="family-summary-totals">
                          <div>
                            <dt>Entrou</dt>
                            <dd>{displayMoney(snapshot.income)}</dd>
                          </div>
                          <div>
                            <dt>Saiu</dt>
                            <dd>{displayMoney(snapshot.expenses)}</dd>
                          </div>
                          <div>
                            <dt>Diferença</dt>
                            <dd>{displayMoney(snapshot.net)}</dd>
                          </div>
                        </dl>
                        {(snapshot.start || snapshot.end) && (
                          <p className="muted">
                            Período: {formatDatePtBr(snapshot.start, dateFormatOptions) ?? 'Início'} a{' '}
                            {formatDatePtBr(snapshot.end, dateFormatOptions) ?? 'Hoje'}
                          </p>
                        )}
                        {snapshot.scope === 'transactions' && (
                          <details className="family-transactions-details">
                            <summary>Ver movimentações</summary>
                            <ul className="evidence-list">
                              {snapshot.transactions.map((record) => (
                                <li key={record.id}>
                                  <span>
                                    {record.description} ·{' '}
                                    {formatDatePtBr(record.date, dateFormatOptions) ?? 'Data indisponível'}
                                  </span>
                                  <strong>{displayMoney(record.amount)}</strong>
                                  {snapshot.can_propose && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setSelected(invite.id);
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
                          </details>
                        )}
                        <p className="muted">Resumo compartilhado, não saldo bancário.</p>
                        <SettingsRow
                          title="Sair deste acesso"
                          danger
                          onClick={() => setConfirm({ invite, action: 'revoke' })}
                        />
                      </>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="muted">Ninguém compartilha dados com você ainda.</p>
            )}
          </section>
          <section className="profile-settings-section" aria-labelledby="family-outgoing-title">
            <h2 id="family-outgoing-title">Meus compartilhamentos</h2>
            {relationships.flatMap((person) =>
              person.sharedByMe
                .filter((invite) => invite.state === 'active' || invite.state === 'revoked')
                .map((invite) => ({ person, invite })),
            ).length ? (
              relationships
                .flatMap((person) =>
                  person.sharedByMe
                    .filter((invite) => invite.state === 'active' || invite.state === 'revoked')
                    .map((invite) => ({ person, invite })),
                )
                .map(({ person, invite }) => (
                  <article className="family-outgoing-row" key={invite.id}>
                    <div>
                      <h3>{person.name}</h3>
                      <p className="muted">
                        {invite.scope === 'summary' ? 'Resumo mensal' : 'Resumo + movimentações'} ·{' '}
                        {labels[invite.state]}
                      </p>
                    </div>
                    {invite.state === 'active' && (
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirm({ invite, action: 'revoke' })}
                      >
                        Revogar acesso
                      </Button>
                    )}
                  </article>
                ))
            ) : (
              <p className="muted">Nenhum compartilhamento ativo.</p>
            )}
          </section>
          <section className="profile-settings-section" aria-labelledby="family-requests-title">
            <h2 id="family-requests-title">Convites e pedidos</h2>
            {familyRequests.length ? (
              familyRequests.map(({ person, invite, direction }) => {
                const expired = Date.parse(invite.expires_at) < Date.now();
                return (
                  <article className="family-outgoing-row" key={invite.id}>
                    <div>
                      <h3>{person.name}</h3>
                      <p className="muted">
                        {direction === 'incoming'
                          ? 'Pedido enviado · aguardando aprovação'
                          : invite.state === 'pending'
                            ? 'Pediu acesso'
                            : expired
                              ? 'Convite expirado'
                              : `Convite · expira ${formatDateTimePtBr(invite.expires_at, dateFormatOptions) ?? 'em data indisponível'}`}
                      </p>
                      <p className="muted">
                        {invite.scope === 'summary' ? 'Resumo mensal' : 'Resumo + movimentações'}
                      </p>
                    </div>
                    {direction === 'outgoing' && invite.state === 'pending' && (
                      <Button disabled={pending} onClick={() => setConfirm({ invite, action: 'approve' })}>
                        <Check size={18} /> Revisar pedido
                      </Button>
                    )}
                    {(direction === 'incoming' || invite.state === 'invited') && (
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirm({ invite, action: 'revoke' })}
                      >
                        {direction === 'incoming' ? 'Cancelar pedido' : 'Revogar convite'}
                      </Button>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="muted">Nenhum convite ou pedido pendente.</p>
            )}
          </section>
        </>
      )}
      {inviteOpen && !app.demo && (
        <Dialog
          title={created ? 'Convite criado' : `Convidar alguém · ${inviteStep + 1} de 3`}
          onClose={() => {
            if (!pending) {
              setInviteOpen(false);
              setCreated('');
              setInviteStep(0);
            }
          }}
        >
          <div className="simple-form family-invite-form">
            {!created && inviteStep === 0 && (
              <>
                <fieldset className="family-wizard-step">
                  <legend>O que você quer compartilhar?</legend>
                  <SettingsRadioRow
                    title="Resumo mensal"
                    name="family-scope"
                    value="summary"
                    checked={scope === 'summary'}
                    onChange={() => setScope('summary')}
                  />
                  <SettingsRadioRow
                    title="Resumo + movimentações"
                    description="Últimas 100 movimentações."
                    name="family-scope"
                    value="transactions"
                    checked={scope === 'transactions'}
                    onChange={() => setScope('transactions')}
                  />
                </fieldset>
                <Button onClick={() => setInviteStep(1)}>Continuar</Button>
              </>
            )}
            {!created && inviteStep === 1 && (
              <>
                <p>O acesso pode incluir todas as contas e períodos. Limites são opcionais.</p>
                <details className="family-advanced">
                  <summary>Limitar conta ou período</summary>
                  <div className="simple-form">
                    <label>
                      Conta
                      <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                        <option value="">Todas as contas</option>
                        {app.data.financial_accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="family-date-range">
                      <label>
                        A partir de
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                        />
                      </label>
                      <label>
                        Até
                        <input
                          type="date"
                          min={startDate || undefined}
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                </details>
                {scope === 'transactions' && (
                  <SettingsToggleRow
                    title="Permitir sugestões de correção"
                    description="Nada muda sem sua aprovação."
                    checked={allowProposals}
                    onChange={setAllowProposals}
                  />
                )}
                <div className="profile-form-actions">
                  <Button variant="secondary" onClick={() => setInviteStep(0)}>
                    Voltar
                  </Button>
                  <Button
                    onClick={() => {
                      setConsent(false);
                      setInviteStep(2);
                    }}
                  >
                    Continuar
                  </Button>
                </div>
              </>
            )}
            {!created && inviteStep === 2 && (
              <>
                <h3>Confira antes de enviar</h3>
                <dl className="family-invite-summary">
                  <div>
                    <dt>O que poderá consultar</dt>
                    <dd>{scope === 'summary' ? 'Resumo mensal' : 'Resumo + últimas 100 movimentações'}</dd>
                  </div>
                  <div>
                    <dt>Conta</dt>
                    <dd>
                      {accountId
                        ? app.data.financial_accounts.find((account) => account.id === accountId)?.name
                        : 'Todas'}
                    </dd>
                  </div>
                  <div>
                    <dt>Período</dt>
                    <dd>
                      {formatDatePtBr(startDate, dateFormatOptions) ?? 'Sem limite de início'} a{' '}
                      {formatDatePtBr(endDate, dateFormatOptions) ?? 'Sem limite de término'}
                    </dd>
                  </div>
                </dl>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  Confirmo este compartilhamento. Os dados só serão liberados depois que eu aprovar a pessoa.
                </label>
                <div className="profile-form-actions">
                  <Button variant="secondary" disabled={pending} onClick={() => setInviteStep(1)}>
                    Voltar
                  </Button>
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
                        await invites.refetch();
                      })
                    }
                  >
                    Criar convite
                  </Button>
                </div>
              </>
            )}
            {created && (
              <div className="family-code" role="status">
                <p>Código válido por 24 horas. Envie somente para a pessoa escolhida.</p>
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
                  <Copy size={18} /> Copiar código
                </Button>
              </div>
            )}
            {created && (
              <Button
                variant="secondary"
                onClick={() => {
                  setInviteOpen(false);
                  setCreated('');
                  setInviteStep(0);
                }}
              >
                Concluir
              </Button>
            )}
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {requestOpen && !app.demo && (
        <Dialog title="Usar convite" onClose={() => !pending && setRequestOpen(false)}>
          <form
            className="simple-form"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await rpc('request_family_access', { invite_code: code.trim() });
                setCode('');
                setRequestOpen(false);
                app.toast('Pedido enviado. Aguarde a aprovação.');
              });
            }}
          >
            <p>
              Peça acesso com o código recebido. Os dados só aparecem depois da aprovação de quem convidou.
            </p>
            <label>
              Código do convite
              <input
                required
                pattern="[a-fA-F0-9]{32}"
                maxLength={32}
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending || !code.trim()}>Pedir acesso</Button>
          </form>
        </Dialog>
      )}
      {proposals.data?.length ? (
        <section className="simple-form">
          <h2>Propostas para revisar</h2>
          {proposals.data.map((item) => (
            <article className="verified-answer" key={item.id}>
              <h3>{item.proposed_data.description}</h3>
              <p>
                Proposto por{' '}
                {relationships.find((person) => person.id === item.proposer_id)?.name ?? 'Pessoa da família'}:{' '}
                {displayMoney(Number(item.before_data.amount))} →{' '}
                {displayMoney(Number(item.proposed_data.amount))} · {item.proposed_data.category}
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
          title={
            confirm.action === 'approve'
              ? 'Aprovar compartilhamento?'
              : confirm.invite.owner_id === app.user?.id
                ? 'Revogar acesso?'
                : 'Sair do acesso?'
          }
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        >
          <div className="simple-form">
            <p>{confirm.invite.viewer_name ?? confirm.invite.owner_name}</p>
            {confirm.invite.viewer_email && <p>{confirm.invite.viewer_email}</p>}
            <p>
              Conta: {confirm.invite.account_id ? 'Somente a conta escolhida' : 'Todas'} · período:{' '}
              {formatDatePtBr(confirm.invite.period_start, dateFormatOptions) ?? 'Início do mês atual'} a{' '}
              {formatDatePtBr(confirm.invite.period_end, dateFormatOptions) ?? 'Hoje'} · propostas:{' '}
              {confirm.invite.can_propose ? 'permitidas, sujeitas à sua aprovação' : 'não permitidas'}.
            </p>
            <p>
              {confirm.action === 'approve'
                ? `Esta pessoa poderá consultar ${confirm.invite.scope === 'summary' ? 'somente seu resumo mensal' : 'seu resumo e as últimas 100 anotações'}. Não poderá editar.`
                : confirm.invite.owner_id === app.user?.id
                  ? 'Novas consultas serão bloqueadas. O que já foi visto ou copiado pela pessoa não pode ser apagado remotamente.'
                  : 'Você deixará de consultar este compartilhamento. A outra pessoa não terá acesso às suas anotações.'}
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
    </ProfileSubpageLayout>
  );
}
