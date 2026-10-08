import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronRight, MoreHorizontal, Plus, Wallet } from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { budgetSchema, categories, recurringRuleSchema, transactionSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays, sum } from '../../shared/financial-engine';
import { budgetUsage } from '../../shared/planning';

type Frequency = 'once' | 'weekly' | 'monthly' | 'yearly';

function parseOptionalMoney(value: string) {
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

function currentMonthLabel(today: string) {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${today.slice(0, 7)}-15T12:00:00Z`));
  return label[0].toLocaleUpperCase('pt-BR') + label.slice(1);
}

function dateLabel(date: string, today: string) {
  if (date === today) return 'Hoje';
  if (date < today) {
    const days = Math.round(
      (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000,
    );
    return days === 1 ? 'Venceu ontem' : `Venceu há ${days} dias`;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace('.', '')
    .toLocaleUpperCase('pt-BR');
}

function pendingBills(transactions: Transaction[], today: string) {
  const through = shiftDays(today, 30);
  return transactions
    .filter(
      (transaction) =>
        transaction.type === 'expense' && transaction.status === 'planned' && transaction.date <= through,
    )
    .sort((first, second) => first.date.localeCompare(second.date));
}

function groupBills(bills: Transaction[], today: string) {
  const groups = new Map<string, Transaction[]>();
  for (const bill of bills) groups.set(bill.date, [...(groups.get(bill.date) ?? []), bill]);
  return [...groups.entries()].map(([date, items]) => ({
    date,
    label: dateLabel(date, today),
    overdue: date < today,
    items,
  }));
}

function frequencyLabel(frequency: Frequency) {
  if (frequency === 'weekly') return 'Toda semana';
  if (frequency === 'yearly') return 'Todo ano';
  if (frequency === 'once') return 'Só desta vez';
  return 'Todo mês';
}

function PlanningHeader({ title, backTo }: { title: string; backTo?: string }) {
  return (
    <header className="planning-page-heading">
      {backTo ? (
        <Link className="planning-back-link" to={backTo} aria-label="Voltar">
          <ArrowLeft size={20} />
        </Link>
      ) : null}
      <h1>{title}</h1>
    </header>
  );
}

function PlanningMenu() {
  return (
    <details className="planning-overflow">
      <summary aria-label="Mais opções de planejamento" title="Mais opções">
        <MoreHorizontal size={22} />
      </summary>
      <div className="planning-overflow-menu">
        <Link to="/planejar/contas">Contas</Link>
        <Link to="/planejar/limites">Limites do mês</Link>
      </div>
    </details>
  );
}

function BillGroups({ bills, today }: { bills: Transaction[]; today: string }) {
  const displayMoney = useMoneyDisplay();
  return (
    <div className="planning-bill-groups">
      {groupBills(bills, today).map((group) => (
        <section
          className={`planning-bill-group${group.overdue ? ' is-overdue' : ''}`}
          key={group.date}
          aria-label={group.label}
        >
          <time dateTime={group.date}>{group.label}</time>
          <ul>
            {group.items.map((bill) => (
              <li key={bill.id}>
                <span>{bill.description}</span>
                <strong>{displayMoney(bill.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PlanningOverview() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const bills = pendingBills(app.data.transactions, today);
  const previewBills = bills.slice(0, 3);
  const usage = budgetUsage(app.data.budgets, app.data.transactions, today)
    .sort((first, second) => {
      const firstUse = first.limit_amount ? first.spent / first.limit_amount : 0;
      const secondUse = second.limit_amount ? second.spent / second.limit_amount : 0;
      return secondUse - firstUse;
    })
    .slice(0, 2);

  return (
    <div className="planning-overview">
      <div className="planning-overview-topline">
        <PlanningHeader title="Planejamento" />
        <PlanningMenu />
      </div>
      <p className="planning-month">{currentMonthLabel(today)}</p>

      <section className="planning-overview-section" aria-labelledby="planning-bills-title">
        <div className="planning-overview-section-title">
          <h2 id="planning-bills-title">Próximos 30 dias</h2>
        </div>
        <div className="planning-total">
          <strong>{displayMoney(sum(bills.map((bill) => bill.amount)))}</strong>
          <span>em contas previstas</span>
        </div>
        {previewBills.length ? (
          <BillGroups bills={previewBills} today={today} />
        ) : (
          <p className="planning-empty">Nada previsto por enquanto.</p>
        )}
        <Link className="planning-section-link" to="/planejar/contas">
          Ver todas as contas <ChevronRight size={19} />
        </Link>
      </section>

      <section className="planning-overview-section" aria-labelledby="planning-limits-title">
        <div className="planning-overview-section-title">
          <h2 id="planning-limits-title">Limites do mês</h2>
          <Link className="planning-section-link" to="/planejar/limites" aria-label="Ver todos os limites">
            <ChevronRight size={20} />
          </Link>
        </div>
        {usage.length ? (
          <div className="planning-limit-list">
            {usage.map((budget) => (
              <Link className="planning-limit-row" to={`/planejar/limites/${budget.id}`} key={budget.id}>
                <span className="planning-row-title">{budget.category}</span>
                <span className="planning-limit-values">
                  <strong>
                    {displayMoney(budget.spent)} de {displayMoney(budget.limit_amount)}
                  </strong>
                  <span className={budget.remaining < 0 ? 'is-over-budget' : ''}>
                    {budget.remaining < 0
                      ? `${displayMoney(Math.abs(budget.remaining))} acima`
                      : `${displayMoney(budget.remaining)} livres`}
                  </span>
                </span>
                <Progress
                  value={budget.limit_amount ? (budget.spent / budget.limit_amount) * 100 : 100}
                  label={`Limite de ${budget.category}`}
                />
              </Link>
            ))}
          </div>
        ) : (
          <p className="planning-empty">Nenhum limite definido para este mês.</p>
        )}
      </section>

      <Link className="button planning-add-button" to="/planejar/adicionar">
        <Plus size={20} /> Adicionar planejamento
      </Link>
    </div>
  );
}

function PlanningChoice() {
  return (
    <div className="planning-flow-page">
      <PlanningHeader title="Adicionar planejamento" backTo="/planejar" />
      <section className="planning-flow-step">
        <h2>O que quer planejar?</h2>
        <div className="planning-choice-list">
          <Link to="/planejar/adicionar?tipo=conta" className="planning-choice">
            <CalendarDays size={22} />
            <span>Conta</span>
            <ChevronRight size={20} />
          </Link>
          <Link to="/planejar/adicionar?tipo=limite" className="planning-choice">
            <Wallet size={22} />
            <span>Limite de gastos</span>
            <ChevronRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ProgressHeader({
  title,
  step,
  total,
  onBack,
}: {
  title: string;
  step: number;
  total: number;
  onBack: () => void;
}) {
  return (
    <header className="planning-flow-header">
      <Button variant="ghost" aria-label="Voltar" onClick={onBack}>
        <ArrowLeft size={20} />
      </Button>
      <h1>{title}</h1>
      <span>
        {step + 1} de {total}
      </span>
    </header>
  );
}

function AccountWizard({ editingId }: { editingId: string | null }) {
  const app = useApp();
  const navigate = useNavigate();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const existing = editingId ? app.data.recurring_rules.find((rule) => rule.id === editingId) : undefined;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100).replace('.', ',') : '');
  const [date, setDate] = useState(existing?.start_date ?? today);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [category, setCategory] = useState(existing?.category ?? 'Outros');
  const [type, setType] = useState<'income' | 'expense'>(existing?.type ?? 'expense');
  const [endDate, setEndDate] = useState(existing?.end_date ?? '');
  const [adjustment, setAdjustment] = useState(existing?.annual_adjustment_bps ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const cents = parseOptionalMoney(amount);
  const totalSteps = 5;

  function goBack() {
    if (step > 0) setStep((current) => current - 1);
    else navigate(existing ? `/planejar/contas/${existing.id}` : '/planejar/adicionar');
  }

  function continueFlow() {
    setError('');
    if (step === 0 && name.trim().length < 2) {
      setError('Informe o nome da conta.');
      return;
    }
    if (step === 1 && (cents === null || cents <= 0)) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (step === 2 && !date) {
      setError('Escolha a data do vencimento.');
      return;
    }
    if (step < totalSteps - 1) setStep((current) => current + 1);
    else void save();
  }

  async function save() {
    if (cents === null || cents <= 0) return;
    setPending(true);
    setError('');
    try {
      const id = existing?.id ?? crypto.randomUUID();
      if (frequency === 'once') {
        await app.repository.save(
          'transactions',
          transactionSchema.parse({
            id,
            description: name.trim(),
            amount: cents,
            type,
            category,
            date,
            status: 'planned',
            source: 'manual',
            account_id: null,
          }),
          null,
        );
      } else {
        await app.repository.saveRecurring(
          recurringRuleSchema.parse({
            id,
            description: name.trim(),
            amount: cents,
            category,
            start_date: date,
            active: existing?.active ?? true,
            frequency,
            type,
            end_date: endDate || null,
            annual_adjustment_bps: adjustment,
          }),
        );
      }
      await app.refresh();
      app.toast(frequency === 'once' ? 'Conta anotada como pendente.' : 'Conta programada.');
      navigate(frequency === 'once' ? '/planejar/contas' : `/planejar/contas/${id}`);
    } catch {
      setError('Confira os dados e sua conexão. Nada foi confirmado nesta tela.');
    } finally {
      setPending(false);
    }
  }

  const stepTitles = [
    'Qual conta você quer lembrar?',
    'Quanto costuma custar?',
    'Quando vence?',
    'Essa conta se repete?',
    'Confira os dados',
  ];

  return (
    <div className="planning-flow-page">
      <ProgressHeader
        title={existing ? 'Editar conta' : 'Adicionar conta'}
        step={step}
        total={totalSteps}
        onBack={goBack}
      />
      <div className="planning-flow-progress" aria-label={`Etapa ${step + 1} de ${totalSteps}`}>
        <span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>
      <section className="planning-flow-step" aria-live="polite">
        <h2>{stepTitles[step]}</h2>
        {step === 0 && (
          <label className="planning-flow-field">
            Nome da conta
            <input
              autoFocus
              minLength={2}
              maxLength={180}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        {step === 1 && (
          <label className="planning-flow-field">
            Valor (R$)
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        )}
        {step === 2 && (
          <label className="planning-flow-field">
            Data de vencimento
            <input
              type="date"
              min={existing ? undefined : today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        )}
        {step === 3 && (
          <>
            <div className="planning-frequency-list" role="group" aria-label="Frequência da conta">
              {(['monthly', 'weekly', 'yearly', ...(!existing ? ['once' as const] : [])] as Frequency[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={frequency === option}
                    onClick={() => setFrequency(option)}
                  >
                    {frequencyLabel(option)}
                  </button>
                ),
              )}
            </div>
            <details className="planning-advanced-options">
              <summary>Mais opções</summary>
              <label>
                Categoria
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as 'income' | 'expense')}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Renda</option>
                </select>
              </label>
              {frequency !== 'once' && (
                <>
                  <label>
                    Data final (opcional)
                    <input
                      type="date"
                      min={date}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Reajuste anual (100 = 1%)
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={adjustment}
                      onChange={(event) => setAdjustment(Number(event.target.value))}
                    />
                  </label>
                </>
              )}
            </details>
            <p className="muted">
              {frequency === 'once'
                ? 'Será anotada como pendente uma única vez. Nenhum pagamento é feito pelo app.'
                : 'As contas ficam previstas, nunca pagas automaticamente.'}
            </p>
          </>
        )}
        {step === 4 && (
          <dl className="planning-review-list">
            <div>
              <dt>Conta</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{cents === null ? '—' : displayMoney(cents)}</dd>
            </div>
            <div>
              <dt>Vencimento</dt>
              <dd>{dateLabel(date, today)}</dd>
            </div>
            <div>
              <dt>Repetição</dt>
              <dd>{frequencyLabel(frequency)}</dd>
            </div>
          </dl>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>
      <footer className="planning-flow-footer">
        <Button variant="secondary" onClick={goBack} disabled={pending}>
          Voltar
        </Button>
        <Button onClick={continueFlow} disabled={pending}>
          {pending
            ? 'Salvando…'
            : step === totalSteps - 1
              ? existing
                ? 'Salvar conta'
                : frequency === 'once'
                  ? 'Anotar conta'
                  : 'Confirmar conta'
              : 'Continuar'}
        </Button>
      </footer>
    </div>
  );
}

function LimitWizard({ editingId }: { editingId: string | null }) {
  const app = useApp();
  const navigate = useNavigate();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const existing = editingId ? app.data.budgets.find((budget) => budget.id === editingId) : undefined;
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(existing?.category ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.limit_amount / 100).replace('.', ',') : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const cents = parseOptionalMoney(amount);

  function goBack() {
    if (step > 0) setStep((current) => current - 1);
    else navigate(existing ? `/planejar/limites/${existing.id}` : '/planejar/adicionar');
  }

  async function save() {
    if (!category || cents === null || cents <= 0) {
      setError('Escolha uma categoria e informe um limite maior que zero.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const month = existing?.month ?? today.slice(0, 7);
      const previous = app.data.budgets.find(
        (budget) => budget.category === category && budget.month === month,
      );
      await app.repository.save(
        'budgets',
        budgetSchema.parse({
          id: existing?.id ?? previous?.id ?? crypto.randomUUID(),
          category,
          month,
          limit_amount: cents,
        }),
        null,
      );
      await app.refresh();
      app.toast('Limite salvo.');
      navigate('/planejar/limites');
    } catch {
      setError('Confira o valor e sua conexão. Nada foi confirmado nesta tela.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="planning-flow-page">
      <ProgressHeader
        title={existing ? 'Editar limite' : 'Novo limite'}
        step={step}
        total={2}
        onBack={goBack}
      />
      <div className="planning-flow-progress" aria-label={`Etapa ${step + 1} de 2`}>
        <span style={{ width: `${((step + 1) / 2) * 100}%` }} />
      </div>
      <section className="planning-flow-step" aria-live="polite">
        {step === 0 ? (
          <>
            <h2>Onde quer colocar um limite?</h2>
            <div className="planning-category-grid" role="group" aria-label="Categoria do limite">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>Quanto quer gastar no máximo com {category.toLocaleLowerCase('pt-BR')} este mês?</h2>
            <label className="planning-flow-field">
              Valor máximo (R$)
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <p className="muted">{currentMonthLabel(today)} já está selecionado.</p>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>
      <footer className="planning-flow-footer">
        <Button variant="secondary" onClick={goBack} disabled={pending}>
          Voltar
        </Button>
        <Button
          onClick={() => {
            setError('');
            if (step === 0 && !category) setError('Escolha uma categoria.');
            else if (step === 0) setStep(1);
            else void save();
          }}
          disabled={pending}
        >
          {pending ? 'Salvando…' : step === 1 ? 'Criar limite' : 'Continuar'}
        </Button>
      </footer>
    </div>
  );
}

function AddPlanningPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const kind = params.get('tipo');
  if (kind === 'conta') return <AccountWizard editingId={params.get('editar')} />;
  if (kind === 'limite') return <LimitWizard editingId={params.get('editar')} />;
  return <PlanningChoice />;
}

function AccountsPage() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const bills = pendingBills(app.data.transactions, today);

  return (
    <div className="planning-detail-page">
      <div className="planning-overview-topline">
        <PlanningHeader title="Contas" backTo="/planejar" />
        <Link className="planning-icon-link" to="/planejar/adicionar?tipo=conta" aria-label="Adicionar conta">
          <Plus size={22} />
        </Link>
      </div>
      <section className="planning-overview-section" aria-labelledby="planning-all-bills-title">
        <div className="planning-overview-section-title">
          <h2 id="planning-all-bills-title">Próximas</h2>
          <strong>{displayMoney(sum(bills.map((bill) => bill.amount)))}</strong>
        </div>
        {bills.length ? (
          <BillGroups bills={bills} today={today} />
        ) : (
          <p className="planning-empty">Nada previsto por enquanto.</p>
        )}
      </section>
      <section className="planning-overview-section" aria-labelledby="planning-programmed-title">
        <div className="planning-overview-section-title">
          <h2 id="planning-programmed-title">Programadas</h2>
        </div>
        {app.data.recurring_rules.length ? (
          <ul className="planning-entity-list">
            {app.data.recurring_rules.map((rule) => (
              <li key={rule.id}>
                <Link to={`/planejar/contas/${rule.id}`}>
                  <span>
                    <strong>{rule.description}</strong>
                    <small>
                      {frequencyLabel(rule.frequency)} · {rule.active ? 'Ativa' : 'Pausada'}
                    </small>
                  </span>
                  <strong>{displayMoney(rule.amount)}</strong>
                  <ChevronRight size={19} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="planning-empty">Nenhuma conta programada.</p>
        )}
      </section>
      <Link className="button planning-add-button" to="/planejar/adicionar?tipo=conta">
        <Plus size={20} /> Adicionar conta
      </Link>
    </div>
  );
}

function RecurringDetail({ ruleId }: { ruleId: string }) {
  const app = useApp();
  const navigate = useNavigate();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const rule = app.data.recurring_rules.find((item) => item.id === ruleId);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  if (!rule) {
    return (
      <div className="planning-detail-page">
        <PlanningHeader title="Conta não encontrada" backTo="/planejar/contas" />
      </div>
    );
  }
  const currentRule = rule;
  const nextOccurrence = app.data.transactions
    .filter(
      (transaction) =>
        transaction.description === currentRule.description &&
        transaction.type === currentRule.type &&
        transaction.status === 'planned' &&
        transaction.date >= today,
    )
    .sort((first, second) => first.date.localeCompare(second.date))[0];

  async function toggleActive() {
    setPending(true);
    try {
      await app.repository.saveRecurring({ ...currentRule, active: !currentRule.active });
      await app.refresh();
      app.toast(currentRule.active ? 'Conta pausada.' : 'Conta retomada.');
    } catch {
      setError('Não foi possível atualizar esta conta.');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError('');
    try {
      await app.repository.removeRecurring(currentRule.id);
      await app.refresh();
      app.toast('Conta removida. Vencimentos já anotados continuam em Anotações.');
      navigate('/planejar/contas');
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="planning-detail-page">
      <PlanningHeader title="Conta" backTo="/planejar/contas" />
      <section className="planning-account-detail">
        <div className="planning-detail-total">
          <strong>{displayMoney(currentRule.amount)}</strong>
          <span>
            {currentRule.type === 'income' ? 'renda prevista' : 'conta prevista'} ·{' '}
            {frequencyLabel(currentRule.frequency)}
          </span>
        </div>
        <h2>{currentRule.description}</h2>
        <dl className="planning-review-list">
          <div>
            <dt>Categoria</dt>
            <dd>{currentRule.category}</dd>
          </div>
          <div>
            <dt>Próximo vencimento</dt>
            <dd>{dateLabel(nextOccurrence?.date ?? currentRule.start_date, today)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{currentRule.active ? 'Ativa' : 'Pausada'}</dd>
          </div>
        </dl>
        <p className="muted">As previsões ficam pendentes. O Nexo não paga nem recebe automaticamente.</p>
      </section>
      <div className="planning-detail-actions">
        <details className="planning-overflow planning-detail-overflow">
          <summary aria-label="Mais opções da conta" title="Mais opções">
            <MoreHorizontal size={22} />
          </summary>
          <div className="planning-overflow-menu">
            <Link to={`/planejar/adicionar?tipo=conta&editar=${currentRule.id}`}>Editar</Link>
            <button type="button" disabled={pending} onClick={() => void toggleActive()}>
              {currentRule.active ? 'Pausar conta' : 'Retomar conta'}
            </button>
            <button type="button" className="planning-destructive-action" onClick={() => setRemoving(true)}>
              Excluir conta
            </button>
          </div>
        </details>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {removing && (
        <Dialog title="Excluir esta conta?" onClose={() => !pending && setRemoving(false)}>
          <div className="simple-form">
            <p>{rule.description}</p>
            <p>Vencimentos já anotados continuam em Anotações; nenhum pagamento será apagado.</p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              Excluir conta
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRemoving(false)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function LimitsPage() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const usage = budgetUsage(app.data.budgets, app.data.transactions, today);

  return (
    <div className="planning-detail-page">
      <div className="planning-overview-topline">
        <PlanningHeader title="Limites do mês" backTo="/planejar" />
        <Link
          className="planning-icon-link"
          to="/planejar/adicionar?tipo=limite"
          aria-label="Adicionar limite"
        >
          <Plus size={22} />
        </Link>
      </div>
      <p className="planning-month">{currentMonthLabel(today)}</p>
      {usage.length ? (
        <div className="planning-limit-list planning-limit-list-full">
          {usage.map((budget) => (
            <Link className="planning-limit-row" to={`/planejar/limites/${budget.id}`} key={budget.id}>
              <span className="planning-row-title">{budget.category}</span>
              <span className="planning-limit-values">
                <strong>
                  {displayMoney(budget.spent)} de {displayMoney(budget.limit_amount)}
                </strong>
                <span className={budget.remaining < 0 ? 'is-over-budget' : ''}>
                  {budget.remaining < 0
                    ? `${displayMoney(Math.abs(budget.remaining))} acima`
                    : `${displayMoney(budget.remaining)} disponíveis`}
                </span>
              </span>
              <Progress
                value={budget.limit_amount ? (budget.spent / budget.limit_amount) * 100 : 100}
                label={`Limite de ${budget.category}`}
              />
              <ChevronRight size={19} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="planning-empty">Quer controlar algum tipo de gasto?</p>
      )}
      <Link className="button planning-add-button" to="/planejar/adicionar?tipo=limite">
        <Plus size={20} /> Criar limite
      </Link>
    </div>
  );
}

function LimitDetail({ budgetId }: { budgetId: string }) {
  const app = useApp();
  const navigate = useNavigate();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const budget = app.data.budgets.find((item) => item.id === budgetId);
  const usage = budgetUsage(app.data.budgets, app.data.transactions, today).find(
    (item) => item.id === budgetId,
  );
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  if (!budget)
    return (
      <div className="planning-detail-page">
        <PlanningHeader title="Limite não encontrado" backTo="/planejar/limites" />
      </div>
    );
  const currentBudget = budget;
  const spent = usage?.spent ?? 0;
  const remaining = currentBudget.limit_amount - spent;

  async function remove() {
    setPending(true);
    setError('');
    try {
      await app.repository.remove('budgets', currentBudget.id, null);
      await app.refresh();
      navigate('/planejar/limites');
    } catch {
      setError('Não foi possível excluir este limite.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="planning-detail-page">
      <PlanningHeader title="Limite" backTo="/planejar/limites" />
      <p className="planning-month">
        {currentMonthLabel(currentBudget.month === today.slice(0, 7) ? today : `${currentBudget.month}-15`)}
      </p>
      <section className="planning-account-detail">
        <h2>{currentBudget.category}</h2>
        <div className="planning-detail-total">
          <strong>{displayMoney(spent)}</strong>
          <span>de {displayMoney(currentBudget.limit_amount)}</span>
        </div>
        <Progress
          value={currentBudget.limit_amount ? (spent / currentBudget.limit_amount) * 100 : 100}
          label={`Limite de ${currentBudget.category}`}
        />
        <p className={remaining < 0 ? 'is-over-budget' : 'muted'}>
          {remaining < 0
            ? `${displayMoney(Math.abs(remaining))} acima do limite`
            : `${displayMoney(remaining)} disponíveis`}
        </p>
      </section>
      <div className="planning-detail-actions">
        <details className="planning-overflow planning-detail-overflow">
          <summary aria-label="Mais opções do limite" title="Mais opções">
            <MoreHorizontal size={22} />
          </summary>
          <div className="planning-overflow-menu">
            <Link to={`/planejar/adicionar?tipo=limite&editar=${currentBudget.id}`}>Editar limite</Link>
            <button type="button" className="planning-destructive-action" onClick={() => setRemoving(true)}>
              Excluir limite
            </button>
          </div>
        </details>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {removing && (
        <Dialog title="Excluir limite?" onClose={() => !pending && setRemoving(false)}>
          <div className="simple-form">
            <p>
              {currentBudget.category} · {displayMoney(currentBudget.limit_amount)}
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              Confirmar exclusão
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRemoving(false)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function PlanningExperience() {
  const { pathname, search } = useLocation();
  if (pathname === '/planejar/adicionar') return <AddPlanningPage />;
  if (pathname === '/planejar/contas') return <AccountsPage />;
  if (pathname === '/planejar/limites') return <LimitsPage />;
  const accountMatch = pathname.match(/^\/planejar\/contas\/([^/]+)$/);
  if (accountMatch) return <RecurringDetail ruleId={decodeURIComponent(accountMatch[1])} />;
  const limitMatch = pathname.match(/^\/planejar\/limites\/([^/]+)$/);
  if (limitMatch) return <LimitDetail budgetId={decodeURIComponent(limitMatch[1])} />;
  if (search) return <PlanningOverview />;
  return <PlanningOverview />;
}
