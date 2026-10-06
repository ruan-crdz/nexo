import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  FileUp,
  Pencil,
  Trash2,
  Camera,
  Mic,
  Plus,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Button, Card, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { categories, transactionSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays, shiftMonths, sum } from '../../shared/financial-engine';
import { monthlyFlow } from '../../shared/insights';
import { goalJourney } from '../../shared/journey';
import { merchantKey } from '../../shared/financial-decisions';
import { useCaptureFlow } from '../design-system/capture-flow';

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
function fullDateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

const sourceLabels: Record<Transaction['source'], string> = {
  manual: 'Anotado no app',
  whatsapp: 'WhatsApp',
  import: 'Arquivo importado',
};

export function MoneyForm({
  type,
  existing,
  onClose,
}: {
  type: Transaction['type'];
  existing?: Transaction;
  onClose: () => void;
}) {
  const app = useApp();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [id] = useState(() => existing?.id ?? crypto.randomUUID());
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [category, setCategory] = useState(existing?.category ?? 'Outros');
  const [account, setAccount] = useState(existing?.account_id ?? '');
  const [status, setStatus] = useState<Transaction['status']>(existing?.status ?? 'paid');
  const [kind, setKind] = useState(type);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [learnCategory, setLearnCategory] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    let value: Transaction;
    try {
      if (date > today && status === 'paid')
        throw new Error('Para uma data futura, marque “Ainda não aconteceu” nos detalhes.');
      value = transactionSchema.parse({
        id,
        description,
        amount: parseMoney(amount),
        type: kind,
        category,
        date,
        status,
        source: existing?.source ?? 'manual',
        account_id: account || null,
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith('Para uma data futura')
          ? err.message
          : 'Confira o valor (por exemplo, 25,50), a descrição e a data.',
      );
      return;
    }
    setPending(true);
    let preferenceFailed = false;
    try {
      await app.repository.save('transactions', value, null);
      if (learnCategory && merchantKey(description).length >= 3) {
        try {
          await app.repository.categoryPreference(merchantKey(description), category);
        } catch {
          preferenceFailed = true;
        }
      }
      await app.refresh();
      const pendingOffline = !app.demo && !navigator.onLine;
      const canUndo = !existing && (app.demo || navigator.onLine);
      app.toast(
        preferenceFailed
          ? 'Movimento salvo; a preferência para os próximos registros não foi atualizada.'
          : pendingOffline
            ? 'Movimento pendente neste aparelho.'
            : existing
              ? 'Movimento atualizado.'
              : 'Movimento salvo.',
        canUndo
          ? {
              label: 'Desfazer',
              onClick: async () => {
                await app.repository.remove('transactions', value.id, null);
                await app.refresh();
                app.toast('Movimento desfeito.');
              },
            }
          : undefined,
      );
      onClose();
    } catch {
      setError('Não foi possível salvar. Confira sua conexão e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={existing ? 'Corrigir movimento' : kind === 'expense' ? 'Anotar um gasto' : 'Anotar uma entrada'}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={pending} className="simple-form">
          <label>
            Quanto foi? (R$)
            <input
              autoFocus
              data-dialog-autofocus
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="money-input"
            />
          </label>
          <label>
            {kind === 'expense' ? 'Com o quê?' : 'De onde veio?'}
            <input
              placeholder={
                kind === 'expense' ? 'Ex.: mercado, farmácia, conta de luz' : 'Ex.: aposentadoria, salário'
              }
              maxLength={180}
              minLength={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <label>
            Quando?
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <small>{date === today ? 'Hoje' : 'Confira a data do movimento.'}</small>
          </label>
          <details className="simple-details">
            <summary>Mais detalhes (opcional)</summary>
            <div className="simple-form">
              <label>
                Gasto ou entrada?
                <select value={kind} onChange={(e) => setKind(e.target.value as Transaction['type'])}>
                  <option value="expense">Gasto</option>
                  <option value="income">Entrada</option>
                </select>
              </label>
              <label>
                Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {!categories.some((c) => c === category) && <option>{category}</option>}
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Já aconteceu?
                <select value={status} onChange={(e) => setStatus(e.target.value as Transaction['status'])}>
                  <option value="paid">Sim, já paguei ou recebi</option>
                  <option value="planned">Ainda não aconteceu</option>
                </select>
              </label>
              {app.data.financial_accounts.length > 0 && (
                <label>
                  Onde movimentou o dinheiro?
                  <select value={account} onChange={(e) => setAccount(e.target.value)}>
                    <option value="">Não informar</option>
                    {app.data.financial_accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          {existing && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={learnCategory}
                onChange={(event) => setLearnCategory(event.target.checked)}
              />
              Usar esta categoria nos próximos registros deste estabelecimento. Não alterar registros antigos.
            </label>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar movimento'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function CapturePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedType = (location.state as { entryType?: unknown } | null)?.entryType;
  const initialType = requestedType === 'expense' || requestedType === 'income' ? requestedType : null;
  const [adding, setAdding] = useState<Transaction['type'] | null>(initialType);
  useEffect(() => {
    if (initialType) navigate('/anotar', { replace: true, state: null });
  }, [initialType, navigate]);
  return (
    <>
      <header className="simple-heading">
        <h1>Anotar</h1>
        <p>Tudo que você adicionar aparece em Movimentos, com a origem identificada.</p>
      </header>
      <section className="capture-section" aria-labelledby="capture-manual-title">
        <h2 id="capture-manual-title">Registrar agora</h2>
        <div className="simple-inline-actions">
          <Button onClick={() => setAdding('expense')}>
            <ArrowUpRight size={18} /> Anotar gasto
          </Button>
          <Button variant="secondary" onClick={() => setAdding('income')}>
            <ArrowDownLeft size={18} /> Anotar entrada
          </Button>
        </div>
      </section>
      <section className="capture-section" aria-labelledby="capture-other-title">
        <h2 id="capture-other-title">Ou escolha como enviar</h2>
        <div className="capture-sources">
          <Link className="button button-secondary" to="/nexo">
            <Mic size={18} /> Falar ou escrever para o Nexo
          </Link>
          <Link className="button button-secondary" to="/recibo">
            <Camera size={18} /> Fotografar ou enviar uma nota
          </Link>
          <Link className="button button-secondary" to="/importar">
            <FileUp size={18} /> Importar extrato
          </Link>
          <Link className="button button-secondary" to="/integracoes">
            <MessageCircle size={18} /> Usar WhatsApp
          </Link>
        </div>
      </section>
      <p className="muted">Fotos, extratos e mensagens são conferidos antes de virar um movimento salvo.</p>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export function SimpleHome() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const { open: openCapture } = useCaptureFlow();
  const whatsapp = useQuery({
    queryKey: ['whatsapp-connection', app.user?.id],
    queryFn: () => invoke<{ connected: boolean; chat_url: string }>('whatsapp-link', { action: 'status' }),
    enabled: !app.demo && Boolean(app.user),
    retry: false,
    staleTime: 30_000,
  });
  const today = civilDate(new Date(), app.data.profile.timezone);
  const currentMonth = today.slice(0, 7);
  const posted = app.data.transactions.filter((transaction) => transaction.date <= today);
  const flow = monthlyFlow(posted, currentMonth);
  const due = app.data.transactions.filter(
    (transaction) =>
      transaction.status === 'planned' &&
      transaction.type === 'expense' &&
      transaction.date <= shiftDays(today, 7),
  );
  const activeGoal =
    app.data.goals.find((goal) => goal.id === app.data.profile.active_goal_id) ??
    app.data.goals.find((goal) => goal.saved < goal.target) ??
    null;
  const goalProgress = activeGoal
    ? goalJourney(activeGoal, activeGoal.weekly_amount, activeGoal.high_water)
    : null;
  const recent = app.data.transactions
    .filter((t) => t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const latestMonth = shiftMonths(`${currentMonth}-01`, -1).slice(0, 7);
  const previousMonth = shiftMonths(`${currentMonth}-01`, -2).slice(0, 7);
  const latestComplete = { month: latestMonth, ...monthlyFlow(posted, latestMonth) };
  const previousComplete = { month: previousMonth, ...monthlyFlow(posted, previousMonth) };
  const expenseChange =
    latestComplete && previousComplete ? latestComplete.expenses - previousComplete.expenses : null;
  const meaningfulChange =
    expenseChange !== null &&
    latestComplete &&
    previousComplete &&
    latestComplete.count > 0 &&
    previousComplete.count > 0 &&
    Math.abs(expenseChange) >= Math.max(10_000, Math.round(previousComplete.expenses * 0.15));
  const insight = due.length
    ? {
        title: `Há ${due.length} conta${due.length === 1 ? '' : 's'} prevista${due.length === 1 ? '' : 's'} nos próximos dias.`,
        summary: `${displayMoney(sum(due.map((item) => item.amount)))} até o próximo vencimento.`,
        evidence: due
          .slice(0, 5)
          .map((item) => `${item.description} · ${dateLabel(item.date)} · ${displayMoney(item.amount)}`),
        destination: '/planejar',
        action: 'Ver contas',
        question: '',
      }
    : meaningfulChange && latestComplete && previousComplete && expenseChange !== null
      ? {
          title: `Você gastou ${displayMoney(Math.abs(expenseChange))} ${expenseChange > 0 ? 'a mais' : 'a menos'}.`,
          summary: 'Comparado ao mês passado.',
          evidence: [
            `${monthLabel(latestComplete.month)}: ${displayMoney(latestComplete.expenses)} em movimentos pagos.`,
            `${monthLabel(previousComplete.month)}: ${displayMoney(previousComplete.expenses)} em movimentos pagos.`,
          ],
          destination: '/nexo',
          action: 'Entender a diferença',
          question: `Compare os gastos pagos que anotei em ${monthLabel(latestComplete.month)} e ${monthLabel(previousComplete.month)}. Calcule a diferença pelos registros disponíveis e explique apenas o que as fontes sustentarem; não invente causas.`,
        }
      : null;
  return (
    <>
      <div className="home-layout">
        <section className="simple-summary" aria-labelledby="monthly-summary-title">
          <p className="eyebrow">{monthLabel(currentMonth)}</p>
          <h1 id="monthly-summary-title">Seu mês</h1>
          <div className="home-month-result" data-month={currentMonth}>
            <strong>{displayMoney(Math.abs(flow.net))}</strong>
            <span>
              {flow.net < 0 ? 'faltou nos movimentos deste mês' : 'sobrou nos movimentos deste mês'}
            </span>
          </div>
          <p className="home-flow-line">
            Entrou {displayMoney(flow.income)} · Saiu {displayMoney(flow.expenses)}
          </p>
          <small className="muted">Com base no que você registrou no Nexo.</small>
          {flow.count === 0 && <p className="muted">Mande uma mensagem para começar.</p>}
        </section>
        {whatsapp.data?.connected ? (
          <a
            className="button button-primary home-whatsapp-cta"
            href={whatsapp.data.chat_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={20} /> Falar com o Nexo no WhatsApp <ArrowUpRight size={18} />
          </a>
        ) : (
          <Link className="button button-primary home-whatsapp-cta" to="/integracoes">
            <MessageCircle size={20} /> {app.demo ? 'Conhecer o Nexo no WhatsApp' : 'Conectar WhatsApp'}{' '}
            <ChevronRight size={18} />
          </Link>
        )}
        <nav className="home-action-rail" aria-label="Ações rápidas">
          <button className="home-quick-action" onClick={openCapture}>
            <span>
              <Plus size={22} />
            </span>
            <small>Anotar</small>
          </button>
          <Link className="home-quick-action" to="/recibo">
            <span>
              <Camera size={22} />
            </span>
            <small>Escanear recibo</small>
          </Link>
        </nav>
        {insight && (
          <section className="home-insight" aria-labelledby="home-insight-title">
            <div>
              <p className="eyebrow">O Nexo percebeu</p>
              <h2 id="home-insight-title">{insight.title}</h2>
              <p>{insight.summary}</p>
              <details>
                <summary>Ver registros usados</summary>
                <ul className="evidence-list">
                  {insight.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <small className="muted">
                  São movimentos registrados no Nexo, não um extrato bancário completo.
                </small>
              </details>
            </div>
            <Link
              className="button button-secondary"
              to={insight.destination}
              state={insight.question ? { question: insight.question } : undefined}
            >
              {insight.action} <ChevronRight size={18} />
            </Link>
          </section>
        )}
        <section className="home-goal" aria-labelledby="home-goal-title">
          {activeGoal && goalProgress ? (
            <>
              <div>
                <p className="eyebrow">Seu próximo passo</p>
                <h2 id="home-goal-title">{activeGoal.name}</h2>
                <p className="home-goal-amount">
                  {displayMoney(activeGoal.saved)} de {displayMoney(activeGoal.target)}
                </p>
                <Progress
                  value={(activeGoal.saved / activeGoal.target) * 100}
                  label={`Progresso de ${activeGoal.name}`}
                />
                <small>
                  {Math.round((activeGoal.saved / activeGoal.target) * 100)}% · faltam{' '}
                  {displayMoney(goalProgress.remaining)}
                </small>
              </div>
              <Link className="button button-secondary" to="/metas">
                Ver meta <ChevronRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <div>
                <h2 id="home-goal-title">Escolha um objetivo</h2>
              </div>
              <Link className="button button-secondary" to="/metas">
                Escolher meta <ChevronRight size={18} />
              </Link>
            </>
          )}
        </section>
        <section className="home-recent" aria-labelledby="recent-title">
          <div className="simple-section-title">
            <h2 id="recent-title">Últimos movimentos</h2>
            <Link className="text-link" to="/movimentos">
              Histórico <ChevronRight size={18} />
            </Link>
          </div>
          {recent.length ? (
            <MoneyRows rows={recent} showMetadata={false} showActions={false} />
          ) : (
            <div className="home-empty">
              <p>Ainda não tem movimentos por aqui.</p>
              <span>Mande uma mensagem ao Nexo no WhatsApp para começar.</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function MoneyRows({
  rows,
  showMetadata = true,
  showActions = true,
}: {
  rows: Transaction[];
  showMetadata?: boolean;
  showActions?: boolean;
}) {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [details, setDetails] = useState<Transaction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!deleting) return;
    setPending(true);
    setError('');
    try {
      await app.repository.remove('transactions', deleting.id, null);
      setDeleting(null);
      await app.refresh();
      app.toast('Movimento excluído.');
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <ul className="money-list">
        {rows.map((t) => (
          <li key={t.id}>
            <div className="money-row-top">
              <span className={`money-kind ${t.type}`} aria-hidden="true">
                {t.type === 'income' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
              </span>
              <div className="money-description">
                <h3>
                  <button className="money-detail-trigger" onClick={() => setDetails(t)}>
                    {t.description}
                  </button>
                </h3>
                <p className="muted">
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${t.date}T12:00:00Z`))}
                  {showMetadata && (
                    <>
                      {' '}
                      · {t.category} · {sourceLabels[t.source]}
                    </>
                  )}
                </p>
              </div>
              <strong className={t.type === 'income' ? 'positive' : ''}>
                <span className="sr-only">{t.type === 'income' ? 'Entrada' : 'Gasto'}</span>
                {t.type === 'income' ? '+' : '−'} {displayMoney(t.amount)}
              </strong>
            </div>
            {showActions && (
              <div className="money-row-bottom">
                <span className="muted">
                  {t.status === 'planned' ? 'Ainda não aconteceu' : t.type === 'income' ? 'Recebido' : 'Pago'}
                </span>
                <div>
                  <Button
                    variant="ghost"
                    aria-label={`Ver detalhes de ${t.description}`}
                    onClick={() => setDetails(t)}
                  >
                    <ChevronRight size={16} /> Detalhes
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Corrigir ${t.description}`}
                    onClick={() => setEditing(t)}
                  >
                    <Pencil size={16} /> Corrigir
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Excluir ${t.description}`}
                    onClick={() => {
                      setError('');
                      setDeleting(t);
                    }}
                  >
                    <Trash2 size={16} /> Excluir
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {details && (
        <Dialog title="Detalhes do movimento" onClose={() => setDetails(null)}>
          <div className="movement-detail">
            <h2>{details.description}</h2>
            <strong className={details.type === 'income' ? 'positive' : ''}>
              {details.type === 'income' ? '+' : '−'} {displayMoney(details.amount)}
            </strong>
            <dl>
              <div>
                <dt>Categoria</dt>
                <dd>{details.category}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{fullDateLabel(details.date)}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{sourceLabels[details.source]}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {details.status === 'planned'
                    ? 'Pendente'
                    : details.type === 'income'
                      ? 'Recebido'
                      : 'Pago'}
                </dd>
              </div>
              <div>
                <dt>Conta</dt>
                <dd>
                  {details.account_id
                    ? (app.data.financial_accounts.find((account) => account.id === details.account_id)
                        ?.name ?? 'Conta não encontrada')
                    : 'Sem conta vinculada'}
                </dd>
              </div>
            </dl>
            <p className="muted">
              {details.source === 'whatsapp'
                ? 'Registrado a partir de uma mensagem enviada pelo WhatsApp.'
                : details.source === 'import'
                  ? 'Registrado a partir de um arquivo importado.'
                  : 'Registrado manualmente no app.'}
            </p>
            <Button
              onClick={() => {
                setEditing(details);
                setDetails(null);
              }}
            >
              <Pencil size={16} /> Corrigir movimento
            </Button>
          </div>
        </Dialog>
      )}
      {editing && <MoneyForm type={editing.type} existing={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Dialog
          title="Excluir este movimento?"
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <div className="simple-form">
            <p>
              {deleting.description} · {displayMoney(deleting.amount)}
            </p>
            <p>Ela será retirada do seu resumo. Se precisar, você poderá anotar novamente.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              {pending ? 'Excluindo…' : 'Sim, excluir movimento'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>
              Não, voltar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SimpleHistory() {
  const app = useApp();
  const [month, setMonth] = useState(() => civilDate(new Date(), app.data.profile.timezone).slice(0, 7));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'pending'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | Transaction['source']>('all');
  const [adding, setAdding] = useState<Transaction['type'] | null>(null);
  const rows = app.data.transactions
    .filter(
      (t) =>
        t.date.startsWith(month) &&
        (filter === 'pending' ? t.status === 'planned' : filter === 'all' || t.type === filter) &&
        (sourceFilter === 'all' || t.source === sourceFilter) &&
        t.description.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <header className="simple-heading">
        <h1>Movimentos</h1>
        <p>Tudo que entrou no Nexo, com a origem de cada registro. Toque em “Corrigir” para mudar algo.</p>
      </header>
      <div className="simple-inline-actions">
        <Button onClick={() => setAdding('expense')}>Anotar gasto</Button>
        <Button variant="secondary" onClick={() => setAdding('income')}>
          Anotar entrada
        </Button>
      </div>
      <Card>
        <div className="month-picker">
          <Button
            variant="secondary"
            aria-label="Mês anterior"
            onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}
          >
            <ChevronLeft />
          </Button>
          <label>
            Mês dos movimentos
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <Button
            variant="secondary"
            aria-label="Próximo mês"
            onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
        <label className="history-search">
          Buscar movimentos
          <input
            type="search"
            placeholder="Ex.: mercado"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="history-filters" role="group" aria-label="Filtrar movimentos">
          {(
            [
              ['all', 'Todas'],
              ['expense', 'Gastos'],
              ['income', 'Entradas'],
              ['pending', 'Pendentes'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? 'primary' : 'secondary'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="history-filters" role="group" aria-label="Filtrar por origem">
          {(
            [
              ['all', 'Todas as origens'],
              ['manual', 'No app'],
              ['whatsapp', 'WhatsApp'],
              ['import', 'Arquivo'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={sourceFilter === value ? 'primary' : 'secondary'}
              aria-pressed={sourceFilter === value}
              onClick={() => setSourceFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {rows.length ? (
          <MoneyRows rows={rows} />
        ) : (
          <div className="simple-empty">
            <h2>Nenhum movimento por aqui.</h2>
            <p>Confira o mês e a busca, ou anote seu primeiro gasto.</p>
          </div>
        )}
      </Card>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
