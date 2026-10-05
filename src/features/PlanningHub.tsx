import { useState } from 'react';
import { CalendarClock, Check, Plus, Target, Trash2, Pencil, Wallet } from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Dialog, Progress } from '../design-system/components';
import { categories, budgetSchema, goalSchema, recurringRuleSchema } from '../../shared/domain';
import type { Budget, Goal, RecurringRule } from '../../shared/domain';
import { civilDate, formatMoney, parseMoney } from '../../shared/financial-engine';
import { budgetUsage } from '../../shared/planning';

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
    value && 'start_date' in value ? value.start_date : value && 'deadline' in value ? value.deadline : today,
  );
  const [category, setCategory] = useState(value && 'category' in value ? value.category : 'Outros');
  const [month, setMonth] = useState(value && 'month' in value ? value.month : today.slice(0, 7));
  const [active, setActive] = useState(value && 'active' in value ? value.active : true);
  const [frequency, setFrequency] = useState(value && 'frequency' in value ? value.frequency : 'monthly');
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
      if (kind === 'recurring')
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
      app.toast('Planejamento salvo.');
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
        kind === 'recurring' ? 'Conta recorrente' : kind === 'budget' ? 'Limite por categoria' : 'Sua meta'
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
              <p className="muted">
                Os vencimentos ficam pendentes, nunca pagos ou recebidos automaticamente. Alterações valem
                para próximos vencimentos ainda não gerados.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                />{' '}
                Recorrência ativa
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Check size={18} />
            {pending ? 'Salvando…' : 'Salvar planejamento'}
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
  const [tab, setTab] = useState<Kind>('recurring');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const today = civilDate(new Date(), app.data.profile.timezone);
  const usage = budgetUsage(app.data.budgets, app.data.transactions, today);
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
        <h1>Seu planejamento</h1>
        <p>Contas, limites e metas sem misturar previsão com dinheiro já pago.</p>
      </header>
      <div className="feature-tabs" role="group" aria-label="Área do planejamento">
        {(
          [
            { kind: 'recurring', label: 'Contas', icon: CalendarClock },
            { kind: 'budget', label: 'Limites', icon: Wallet },
            { kind: 'goal', label: 'Metas', icon: Target },
          ] as const
        ).map(({ kind, label, icon: Icon }) => (
          <Button
            key={kind}
            variant={tab === kind ? 'primary' : 'secondary'}
            aria-pressed={tab === kind}
            onClick={() => setTab(kind)}
          >
            <Icon size={18} />
            {label}
          </Button>
        ))}
      </div>
      <div>
        <Button onClick={() => setEditing({ kind: tab })}>
          <Plus size={18} />
          {tab === 'recurring' ? 'Nova conta recorrente' : tab === 'budget' ? 'Novo limite' : 'Nova meta'}
        </Button>
      </div>
      <section className="plan-list">
        {tab === 'recurring' &&
          (app.data.recurring_rules.length ? (
            app.data.recurring_rules.map((rule) => (
              <article key={rule.id} className="plan-row">
                <div>
                  <h2>{rule.description}</h2>
                  <p>
                    {formatMoney(rule.amount)} · mensal · {rule.active ? 'Ativa' : 'Pausada'}
                  </p>
                  <small className="muted">Desde {rule.start_date.split('-').reverse().join('/')}</small>
                </div>
                {actions('recurring', rule, rule.description)}
              </article>
            ))
          ) : (
            <p>Nenhuma conta recorrente cadastrada.</p>
          ))}
        {tab === 'budget' &&
          (usage.length ? (
            usage.map((budget) => (
              <article key={budget.id} className="plan-row">
                <div>
                  <h2>{budget.category}</h2>
                  <p>
                    {formatMoney(budget.spent)} de {formatMoney(budget.limit_amount)} neste mês
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
                    {formatMoney(Math.abs(budget.remaining))}
                  </p>
                </div>
                {actions('budget', budget, budget.category)}
              </article>
            ))
          ) : (
            <p>Nenhum limite definido para este mês.</p>
          ))}
        {tab === 'goal' &&
          (app.data.goals.length ? (
            app.data.goals.map((goal) => (
              <article key={goal.id} className="plan-row">
                <div>
                  <h2>{goal.name}</h2>
                  <p>
                    {formatMoney(goal.saved)} de {formatMoney(goal.target)}
                  </p>
                  <Progress value={(goal.saved / goal.target) * 100} label={`Progresso de ${goal.name}`} />
                  <p className="muted">
                    Faltam {formatMoney(Math.max(0, goal.target - goal.saved))} · prazo{' '}
                    {goal.deadline.split('-').reverse().join('/')}
                  </p>
                </div>
                {actions('goal', goal, goal.name)}
              </article>
            ))
          ) : (
            <p>Nenhuma meta cadastrada.</p>
          ))}
      </section>
      {editing && <PlanningForm editing={editing} onClose={() => setEditing(null)} />}
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
