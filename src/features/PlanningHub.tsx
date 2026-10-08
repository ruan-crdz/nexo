import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, Trash2, Pencil } from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { categories, budgetSchema, goalSchema, recurringRuleSchema, transactionSchema } from '../../shared/domain';
import type { Budget, Goal, RecurringRule } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays } from '../../shared/financial-engine';
import { budgetUsage } from '../../shared/planning';
import { JourneyGoalForm } from './GoalJourney';

type Kind = 'recurring' | 'budget' | 'goal';
type Editing = { kind: Kind; value?: RecurringRule | Budget | Goal };
function PlanningForm({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const app = useApp();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const { kind, value } = editing;
  const [name, setName] = useState(
    value && 'description' in value ? value.description : value && 'name' in value ? value.name : '',
  );
  const [amount, setAmount] = useState(
    value
      ? String(
          ('amount' in value ? value.amount : 'target' in value ? value.target : value.limit_amount) / 100,
        ).replace('.', ',')
      : '',
  );
  const [saved, setSaved] = useState(
    value && 'saved' in value ? String(value.saved / 100).replace('.', ',') : '0',
  );
  const [date, setDate] = useState(
    value && 'start_date' in value
      ? value.start_date
      : value && 'deadline' in value
        ? value.deadline ?? today
        : today,
  );
  const [category, setCategory] = useState(value && 'category' in value ? value.category : 'Outros');
  const [month, setMonth] = useState(value && 'month' in value ? value.month : today.slice(0, 7));
  const [active, setActive] = useState(value && 'active' in value ? value.active : true);
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>(
    value && 'frequency' in value ? value.frequency : 'monthly',
  );
  const [ruleType, setRuleType] = useState(value && 'type' in value ? value.type : 'expense');
  const [endDate, setEndDate] = useState(value && 'end_date' in value ? (value.end_date ?? '') : '');
  const [adjustment, setAdjustment] = useState(
    value && 'annual_adjustment_bps' in value ? value.annual_adjustment_bps : 0,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const id = value?.id ?? crypto.randomUUID();
      if (kind === 'recurring') {
        if (frequency === 'once') {
          await app.repository.save(
            'transactions',
            transactionSchema.parse({
              id,
              description: name,
              amount: parseMoney(amount),
              type: ruleType,
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
              description: name,
              amount: parseMoney(amount),
              category,
              start_date: date,
              active,
              frequency,
              type: ruleType,
              end_date: endDate || null,
              annual_adjustment_bps: adjustment,
            }),
          );
        }
      }
      if (kind === 'budget') {
        const previous = app.data.budgets.find(
          (budget) => budget.category === category && budget.month === month,
        );
        await app.repository.save(
          'budgets',
          budgetSchema.parse({
            id: value?.id ?? previous?.id ?? id,
            category,
            month,
            limit_amount: parseMoney(amount),
          }),
          null,
        );
      }
      if (kind === 'goal')
        await app.repository.save(
          'goals',
          goalSchema.parse({
            id,
            name,
            target: parseMoney(amount),
            saved: parseMoney(saved),
            deadline: date,
            monthly_contribution: value && 'monthly_contribution' in value ? value.monthly_contribution : 0,
            priority: value && 'priority' in value ? value.priority : 'medium',
          }),
          null,
        );
      await app.refresh();
      app.toast(frequency === 'once' && kind === 'recurring' ? 'Conta única anotada como pendente.' : 'Planejamento salvo.');
      onClose();
    } catch {
      setError('Confira os valores, as datas e sua conexão. Nada foi confirmado nesta tela.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={
        kind === 'recurring'
          ? frequency === 'once'
            ? 'Conta a pagar'
            : 'Conta recorrente'
          : kind === 'budget'
            ? 'Limite por categoria'
            : 'Sua meta'
      }
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={pending} className="simple-form">
          {kind !== 'budget' && (
            <label>
              Nome
              <input
                data-dialog-autofocus
                required
                minLength={2}
                maxLength={kind === 'goal' ? 100 : 180}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            {kind === 'goal' ? 'Quanto quer alcançar? (R$)' : 'Valor (R$)'}
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {kind !== 'goal' && (
            <label>
              Categoria
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {kind === 'budget' ? (
            <label>
              Mês
              <input type="month" required value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
          ) : (
            <label>
              {kind === 'goal' ? 'Prazo' : 'Primeiro vencimento'}
              <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          )}
          {kind === 'goal' && (
            <label>
              Quanto já guardou? (R$)
              <input
                required
                inputMode="decimal"
                value={saved}
                onChange={(event) => setSaved(event.target.value)}
              />
            </label>
          )}
          {kind === 'recurring' && (
            <>
              <label>
                Frequência
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as 'weekly' | 'monthly' | 'yearly')}
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                  {!value && <option value="once">Única vez</option>}
                </select>
              </label>
              <label>
                Gasto ou renda
                <select
                  value={ruleType}
                  onChange={(event) => setRuleType(event.target.value as 'income' | 'expense')}
                >
                  <option value="expense">Gasto previsto</option>
                  <option value="income">Renda prevista</option>
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
                    Reajuste anual (pontos-base: 100 = 1%)
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
              <p className="muted">
                {frequency === 'once'
                  ? 'Será anotada como pendente uma única vez. Nenhum pagamento é feito pelo app.'
                  : 'Os vencimentos ficam pendentes, nunca pagos ou recebidos automaticamente. Alterações valem para próximos vencimentos ainda não gerados.'}
              </p>
              {frequency !== 'once' && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                  />{' '}
                  Recorrência ativa
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Check size={18} />
            {pending ? 'Salvando…' : frequency === 'once' && kind === 'recurring' ? 'Anotar conta' : 'Salvar planejamento'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}
export function PlanningHub() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const today = civilDate(new Date(), app.data.profile.timezone);
  const usage = budgetUsage(app.data.budgets, app.data.transactions, today);
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
  async function remove() {
    if (!removing) return;
    setPending(true);
    setError('');
    try {
      if (removing.kind === 'recurring') await app.repository.removeRecurring(removing.id);
      else await app.repository.remove(removing.kind === 'goal' ? 'goals' : 'budgets', removing.id, null);
      await app.refresh();
      setRemoving(null);
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  const actions = (kind: Kind, value: RecurringRule | Budget | Goal, name: string) => (
    <div className="plan-row-actions">
      <Button
        variant="ghost"
        aria-label={`Editar ${name}`}
        title={`Editar ${name}`}
        onClick={() => setEditing({ kind, value })}
      >
        <Pencil size={18} />
      </Button>
      <Button
        variant="ghost"
        aria-label={`Excluir ${name}`}
        title={`Excluir ${name}`}
        onClick={() => setRemoving({ kind, id: value.id, name })}
      >
        <Trash2 size={18} />
      </Button>
    </div>
  );
  return (
    <>
      <header className="simple-heading">
        <h1>Planejar</h1>
        <p>O que está por vir, sem misturar previsão com dinheiro já pago.</p>
      </header>
      <section className="planning-section" aria-labelledby="planning-upcoming-title">
        <div className="simple-section-title">
          <h2 id="planning-upcoming-title">Próximas contas</h2>
          <Button variant="secondary" onClick={() => setEditing({ kind: 'recurring' })}>
            <Plus size={18} /> Adicionar
          </Button>
        </div>
        {upcomingBills.length ? (
          <ul className="home-upcoming-list">
            {upcomingBills.map((bill) => (
              <li key={bill.id}>
                <time dateTime={bill.date}>
                  {bill.date.slice(8, 10)}/{bill.date.slice(5, 7)}
                </time>
                <span>{bill.description}</span>
                <strong>{displayMoney(bill.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhuma conta prevista para os próximos 30 dias.</p>
        )}
        <Link className="text-link" to="/movimentos">
          Ver movimentos previstos
        </Link>
      </section>
      <section className="planning-section" aria-labelledby="planning-budgets-title">
        <div className="simple-section-title">
          <h2 id="planning-budgets-title">Limites do mês</h2>
          <Button variant="secondary" onClick={() => setEditing({ kind: 'budget' })}>
            <Plus size={18} /> Novo limite
          </Button>
        </div>
        {usage.length ? (
          <div className="plan-list">
            {usage.map((budget) => (
              <article key={budget.id} className="plan-row">
                <div>
                  <h3>{budget.category}</h3>
                  <p>
                    {displayMoney(budget.spent)} de {displayMoney(budget.limit_amount)} neste mês
                  </p>
                  <Progress
                    value={
                      budget.limit_amount
                        ? (budget.spent / budget.limit_amount) * 100
                        : budget.spent
                          ? 100
                          : 0
                    }
                    label={`Limite de ${budget.category}`}
                  />
                  <p className={budget.remaining < 0 ? 'error-message' : 'muted'}>
                    {budget.remaining < 0 ? 'Acima do limite: ' : 'Disponível: '}
                    {displayMoney(Math.abs(budget.remaining))}
                  </p>
                </div>
                {actions('budget', budget, budget.category)}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            Sem limites definidos. Você pode planejar uma categoria quando fizer sentido.
          </p>
        )}
      </section>
      <section className="planning-section" aria-labelledby="planning-goals-title">
        <div className="simple-section-title">
          <h2 id="planning-goals-title">Metas</h2>
        </div>
        {app.data.goals.length ? (
          <div className="plan-list">
            {app.data.goals.map((goal) => (
              <article key={goal.id} className="plan-row">
                <div>
                  <h3>{goal.name}</h3>
                  <p>
                    {displayMoney(goal.saved)} de {displayMoney(goal.target)}
                  </p>
                  <Progress value={(goal.saved / goal.target) * 100} label={`Progresso de ${goal.name}`} />
                  <p className="muted">
                    Faltam {displayMoney(Math.max(0, goal.target - goal.saved))} ·{' '}
                    {goal.deadline
                      ? `alcançar até ${goal.deadline.split('-').reverse().join('/')}`
                      : 'sem data final'}
                  </p>
                </div>
                {actions('goal', goal, goal.name)}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma meta cadastrada.</p>
        )}
        <Link className="text-link" to="/metas">
          Acompanhar meta e conquistas
        </Link>
      </section>
      <section className="planning-section" aria-labelledby="planning-recurring-title">
        <div className="simple-section-title">
          <h2 id="planning-recurring-title">Contas recorrentes</h2>
          <Button variant="secondary" onClick={() => setEditing({ kind: 'recurring' })}>
            <Plus size={18} /> Nova recorrência
          </Button>
        </div>
        {app.data.recurring_rules.length ? (
          <div className="plan-list">
            {app.data.recurring_rules.map((rule) => (
              <article key={rule.id} className="plan-row">
                <div>
                  <h3>{rule.description}</h3>
                  <p>
                    {displayMoney(rule.amount)} ·{' '}
                    {rule.frequency === 'monthly'
                      ? 'mensal'
                      : rule.frequency === 'weekly'
                        ? 'semanal'
                        : 'anual'}{' '}
                    · {rule.active ? 'Ativa' : 'Pausada'}
                  </p>
                  <small className="muted">Desde {rule.start_date.split('-').reverse().join('/')}</small>
                </div>
                {actions('recurring', rule, rule.description)}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma recorrência cadastrada.</p>
        )}
      </section>
      {editing &&
        (editing.kind === 'goal' ? (
          <JourneyGoalForm existing={editing.value as Goal | undefined} onClose={() => setEditing(null)} />
        ) : (
          <PlanningForm editing={editing} onClose={() => setEditing(null)} />
        ))}
      {removing && (
        <Dialog
          title="Excluir planejamento?"
          onClose={() => {
            if (!pending) setRemoving(null);
          }}
        >
          <div className="simple-form">
            <p>{removing.name}</p>
            {removing.kind === 'recurring' && (
              <p>Vencimentos já anotados continuam em Anotações; nenhum pagamento será apagado.</p>
            )}
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              Confirmar exclusão
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
