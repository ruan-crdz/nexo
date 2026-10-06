import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ChartNoAxesColumnIncreasing,
  Wallet,
  FileUp,
  Pencil,
  Trash2,
  Camera,
  Mic,
  Plus,
  Target,
} from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Card, Dialog } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { categories, transactionSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays, shiftMonths } from '../../shared/financial-engine';
import { monthlyFlow } from '../../shared/insights';
import { budgetUsage, weeklySummary } from '../../shared/planning';
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
  const { open: openCapture, chooseType } = useCaptureFlow();
  const [adding, setAdding] = useState<Transaction['type'] | null>(null);
  const today = civilDate(new Date(), app.data.profile.timezone);
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const posted = app.data.transactions.filter((transaction) => transaction.date <= today);
  const flow = monthlyFlow(posted, month);
  const weekly = weeklySummary(app.data.transactions, today);
  const due = app.data.transactions.filter(
    (transaction) =>
      transaction.status === 'planned' &&
      transaction.type === 'expense' &&
      transaction.date <= shiftDays(today, 3),
  );
  const upcomingBills = app.data.transactions
    .filter(
      (transaction) =>
        transaction.status === 'planned' &&
        transaction.type === 'expense' &&
        transaction.date >= today &&
        transaction.date <= shiftDays(today, 30),
    )
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(0, 5);
  const activeGoal =
    app.data.goals.find((goal) => goal.id === app.data.profile.active_goal_id) ??
    app.data.goals.find((goal) => goal.saved < goal.target) ??
    null;
  const goalProgress = activeGoal
    ? goalJourney(activeGoal, activeGoal.weekly_amount, activeGoal.high_water)
    : null;
  const limits = budgetUsage(app.data.budgets, app.data.transactions, today).filter(
    (budget) => budget.remaining < 0,
  );
  const months = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonths(`${currentMonth}-01`, index - 5).slice(0, 7);
    return { month: key, ...monthlyFlow(posted, key) };
  });
  const chartMaximum = Math.max(1, ...months.flatMap((item) => [item.income, item.expenses]));
  const categoryAmounts = new Map<string, number>();
  for (const transaction of posted) {
    if (transaction.status === 'paid' && transaction.type === 'expense' && transaction.date.startsWith(month))
      categoryAmounts.set(
        transaction.category,
        (categoryAmounts.get(transaction.category) ?? 0) + transaction.amount,
      );
  }
  const allSpending = [...categoryAmounts.entries()].sort((first, second) => second[1] - first[1]);
  const spending = allSpending.slice(0, 4);
  if (allSpending.length > 4)
    spending.push([
      'Outras categorias',
      allSpending.slice(4).reduce((total, [, amount]) => total + amount, 0),
    ]);
  const recent = app.data.transactions
    .filter((t) => t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const completeMonths = months.filter((item) => item.month < currentMonth);
  const latestComplete = completeMonths.at(-1);
  const previousComplete = completeMonths.at(-2);
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
        title: `${due.length} conta${due.length === 1 ? '' : 's'} vencida${due.length === 1 ? '' : 's'} ou chegando`,
        summary: 'Confira essas contas antes de decidir quanto do dinheiro está livre.',
        evidence: due
          .slice(0, 5)
          .map((item) => `${item.description} · ${dateLabel(item.date)} · ${displayMoney(item.amount)}`),
        destination: '/planejar',
        action: 'Conferir contas',
        question: '',
      }
    : meaningfulChange && latestComplete && previousComplete && expenseChange !== null
      ? {
          title: `Você anotou ${displayMoney(Math.abs(expenseChange))} ${expenseChange > 0 ? 'a mais' : 'a menos'} em gastos`,
          summary: `Comparando ${monthLabel(latestComplete.month)} com ${monthLabel(previousComplete.month)}.`,
          evidence: [
            `${monthLabel(latestComplete.month)}: ${displayMoney(latestComplete.expenses)} em gastos pagos anotados.`,
            `${monthLabel(previousComplete.month)}: ${displayMoney(previousComplete.expenses)} em gastos pagos anotados.`,
          ],
          destination: '/nexo',
          action: 'Entender a diferença',
          question: `Compare os gastos pagos que anotei em ${monthLabel(latestComplete.month)} e ${monthLabel(previousComplete.month)}. Calcule a diferença pelos registros disponíveis e explique apenas o que as fontes sustentarem; não invente causas.`,
        }
      : null;
  return (
    <>
      <div className="home-layout">
        <header className="simple-heading dashboard-heading">
          <div>
            <p className="muted">Visão geral</p>
            <h1>Olá, {app.data.profile.name.split(' ')[0]}.</h1>
            <p>Seu dinheiro com mais clareza.</p>
          </div>
          <div className="dashboard-period" role="group" aria-label="Navegar entre meses">
            <Button
              variant="ghost"
              aria-label="Mês anterior do resumo"
              title="Mês anterior"
              onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}
            >
              <ChevronLeft size={20} />
            </Button>
            <label>
              <span className="sr-only">Mês do resumo</span>
              <input
                type="month"
                value={month}
                max={currentMonth}
                onChange={(event) => {
                  if (event.target.value && event.target.value <= currentMonth) setMonth(event.target.value);
                }}
              />
            </label>
            <Button
              variant="ghost"
              aria-label="Próximo mês do resumo"
              title="Próximo mês"
              disabled={month >= currentMonth}
              onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </header>
        <section className="simple-summary" aria-labelledby="monthly-summary-title">
          <div className="simple-section-title">
            <h2 id="monthly-summary-title">Seu mês até agora</h2>
            <span>
              {flow.count} {flow.count === 1 ? 'movimento' : 'movimentos'} · {monthLabel(month)}
            </span>
          </div>
          <div className="simple-totals" data-month={month}>
            <div>
              <span>
                <ArrowDownLeft size={18} /> Entrou
              </span>
              <strong className="positive">{displayMoney(flow.income)}</strong>
            </div>
            <div>
              <span>
                <ArrowUpRight size={18} /> Saiu
              </span>
              <strong>{displayMoney(flow.expenses)}</strong>
            </div>
            <div className="simple-net">
              <span>
                <Wallet size={18} /> Resultado registrado
              </span>
              <strong>{displayMoney(Math.abs(flow.net))}</strong>
            </div>
          </div>
          <p className="muted">
            Com base no que você registrou no Nexo. Não é o saldo da sua conta bancária.
          </p>
          {flow.count === 0 && <p>Comece anotando algo que recebeu ou gastou.</p>}
        </section>
        <nav className="home-action-rail" aria-label="Ações rápidas">
          <button className="home-quick-action" onClick={openCapture}>
            <span>
              <Plus size={22} />
            </span>
            <small>Anotar</small>
          </button>
          <button className="home-quick-action" onClick={() => chooseType('income')}>
            <span>
              <ArrowDownLeft size={22} />
            </span>
            <small>Receita</small>
          </button>
          <Link className="home-quick-action" to="/recibo">
            <span>
              <Camera size={22} />
            </span>
            <small>Recibo</small>
          </Link>
          <Link className="home-quick-action" to="/importar">
            <span>
              <FileUp size={22} />
            </span>
            <small>Extrato</small>
          </Link>
          <Link className="home-quick-action" to="/integracoes">
            <span>
              <MessageCircle size={22} />
            </span>
            <small>WhatsApp</small>
          </Link>
          <Link className="home-quick-action" to="/metas">
            <span>
              <Target size={22} />
            </span>
            <small>Meta</small>
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
        {upcomingBills.length > 0 && (
          <section className="home-upcoming" aria-labelledby="upcoming-bills-title">
            <div className="simple-section-title">
              <h2 id="upcoming-bills-title">Próximas contas</h2>
              <Link className="text-link" to="/planejar">
                Ver todas
              </Link>
            </div>
            <ul className="home-upcoming-list">
              {upcomingBills.map((bill) => (
                <li key={bill.id}>
                  <time dateTime={bill.date}>{dateLabel(bill.date)}</time>
                  <span>{bill.description}</span>
                  <strong>{displayMoney(bill.amount)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="home-goal" aria-labelledby="home-goal-title">
          {activeGoal && goalProgress ? (
            <>
              <div>
                <p className="eyebrow">Próximo passo da meta</p>
                <h2 id="home-goal-title">{activeGoal.name}</h2>
                <p>
                  Guardado {displayMoney(activeGoal.saved)} de {displayMoney(activeGoal.target)} · faltam{' '}
                  {displayMoney(goalProgress.remaining)}.
                </p>
                <p>
                  {activeGoal.weekly_amount > 0
                    ? `Passo planejado: ${displayMoney(goalProgress.nextStep)} nesta semana.`
                    : 'Ritmo pausado; você pode ajustar quando quiser.'}{' '}
                  Revisar em {fullDateLabel(activeGoal.deadline)}.
                </p>
                <details>
                  <summary>Ver cálculo</summary>
                  <p>
                    {displayMoney(activeGoal.target)} − {displayMoney(activeGoal.saved)} ={' '}
                    {displayMoney(goalProgress.remaining)} restantes. O passo semanal é o valor que você
                    cadastrou; esta conta não considera rendimentos.
                  </p>
                </details>
              </div>
              <Link className="button button-secondary" to="/metas">
                Acompanhar meta <ChevronRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="eyebrow">Planejar no seu ritmo</p>
                <h2 id="home-goal-title">Escolha um próximo passo</h2>
                <p>Uma meta pode ter um valor, uma data para revisar e passos pequenos.</p>
              </div>
              <Link className="button button-secondary" to="/metas">
                Ver minhas metas <ChevronRight size={18} />
              </Link>
            </>
          )}
        </section>
        <div className="money-dashboard">
          <section className="money-recent" aria-labelledby="recent-title">
            <div className="simple-section-title">
              <h2 id="recent-title">Movimentos recentes</h2>
              <Link className="text-link" to="/movimentos">
                Ver todas <ChevronRight size={18} />
              </Link>
            </div>
            {recent.length ? (
              <MoneyRows rows={recent} />
            ) : (
              <p className="muted">Ainda não há movimentos. Use Anotar para começar.</p>
            )}
          </section>
        </div>
        <details className="simple-details home-details">
          <summary>Ver gráficos e categorias</summary>
          <div className="money-dashboard">
            <section className="money-evolution" aria-labelledby="evolution-title">
              <div className="simple-section-title">
                <div>
                  <h2 id="evolution-title">Entradas e saídas</h2>
                  <p className="muted">Últimos seis meses</p>
                </div>
                <div className="flow-legend">
                  <span>
                    <i className="income-swatch" /> Entrou
                  </span>
                  <span>
                    <i className="expense-swatch" /> Saiu
                  </span>
                </div>
              </div>
              <div className="flow-chart" aria-label="Evolução dos movimentos por mês">
                {months.map((item) => (
                  <button
                    key={item.month}
                    data-month={item.month}
                    className={`flow-month${month === item.month ? ' selected' : ''}`}
                    aria-pressed={month === item.month}
                    aria-label={`Ver ${monthLabel(item.month)}: entrou ${displayMoney(item.income)}, saiu ${displayMoney(item.expenses)}`}
                    title={`${monthLabel(item.month)}: entrou ${displayMoney(item.income)} · saiu ${displayMoney(item.expenses)}`}
                    onClick={() => setMonth(item.month)}
                  >
                    <span className="flow-bars" aria-hidden="true">
                      <span
                        className="income-bar"
                        style={{ height: `${(item.income / chartMaximum) * 100}%` }}
                      />
                      <span
                        className="expense-bar"
                        style={{ height: `${(item.expenses / chartMaximum) * 100}%` }}
                      />
                    </span>
                    <span>
                      {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                        .format(new Date(`${item.month}-01T12:00:00Z`))
                        .replace('.', '')}
                    </span>
                  </button>
                ))}
              </div>
              {!months.some((item) => item.count > 0) && (
                <p className="muted">A evolução aparece quando você anota suas entradas e gastos.</p>
              )}
            </section>
            <section className="money-breakdown" aria-labelledby="spending-title">
              <div className="simple-section-title">
                <h2 id="spending-title">Onde você gastou</h2>
                <ChartNoAxesColumnIncreasing size={20} aria-hidden="true" />
              </div>
              {spending.length ? (
                <ul className="category-list">
                  {spending.map(([category, amount]) => (
                    <li key={category}>
                      <div>
                        <span>{category}</span>
                        <strong>{displayMoney(amount)}</strong>
                      </div>
                      <div className="category-track" aria-hidden="true">
                        <span style={{ width: `${(amount / flow.expenses) * 100}%` }} />
                      </div>
                      <small className="muted">
                        {Math.round((amount / flow.expenses) * 100)}% dos gastos
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="simple-empty">
                  <p>Nenhum gasto pago em {monthLabel(month)}.</p>
                  <Button variant="secondary" onClick={() => setAdding('expense')}>
                    <ArrowUpRight size={18} /> Anotar gasto
                  </Button>
                </div>
              )}
            </section>
          </div>
        </details>
        <Link to="/planejar" className="text-link">
          Ver todos os planos
        </Link>
        {app.data.profile.reminders_enabled && (due.length > 0 || limits.length > 0) && (
          <section className="attention-band" aria-label="Avisos consentidos">
            <h2>Vale conferir</h2>
            {due.length > 0 && <p>{due.length} contas pendentes, atrasadas ou vencendo em até três dias.</p>}
            {limits.map((budget) => (
              <p key={budget.id}>
                {budget.category}: {displayMoney(-budget.remaining)} acima do limite.
              </p>
            ))}
            <Link className="text-link" to="/perguntas">
              Conferir registros
            </Link>
          </section>
        )}
        {app.data.profile.weekly_digest && (
          <section className="attention-band">
            <h2>Sua última semana completa</h2>
            <p>
              {weekly.start} a {weekly.end} · entrou {displayMoney(weekly.income)}, saiu{' '}
              {displayMoney(weekly.expenses)}; diferença {displayMoney(weekly.net)}.
            </p>
            <details>
              <summary>Registros usados</summary>
              <ul className="evidence-list">
                {weekly.records.map((record) => (
                  <li key={record.id}>
                    {record.description} · {record.date} · {displayMoney(record.amount)}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
      </div>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function MoneyRows({ rows }: { rows: Transaction[] }) {
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
                  · {t.category} · {sourceLabels[t.source]}
                </p>
              </div>
              <strong className={t.type === 'income' ? 'positive' : ''}>
                <span className="sr-only">{t.type === 'income' ? 'Entrada' : 'Gasto'}</span>
                {t.type === 'income' ? '+' : '−'} {displayMoney(t.amount)}
              </strong>
            </div>
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
