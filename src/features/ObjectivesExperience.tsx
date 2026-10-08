import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CarFront,
  ChevronRight,
  GraduationCap,
  House,
  Plane,
  Plus,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { goalSchema } from '../../shared/domain';
import type { Goal } from '../../shared/domain';
import { civilDate, parseMoney } from '../../shared/financial-engine';
import { goalMonthlyBudget, goalMonthlyPlan } from '../../shared/journey';

const objectiveKinds = [
  { id: 'reserve', label: 'Reserva', icon: Shield, name: 'Minha reserva' },
  { id: 'travel', label: 'Viagem', icon: Plane, name: 'Minha viagem' },
  { id: 'home', label: 'Casa', icon: House, name: 'Minha casa' },
  { id: 'study', label: 'Estudos', icon: GraduationCap, name: 'Meus estudos' },
  { id: 'car', label: 'Carro', icon: CarFront, name: 'Meu carro' },
  { id: 'other', label: 'Outro objetivo', icon: Sparkles, name: 'Meu objetivo' },
] as const;

function parseOptionalMoney(value: string) {
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

function progressPercent(goal: Goal) {
  return goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function objectiveIcon(purpose?: string) {
  const label = (purpose ?? '').toLocaleLowerCase('pt-BR');
  if (label.includes('viagem')) return Plane;
  if (label.includes('casa')) return House;
  if (label.includes('estudo')) return GraduationCap;
  if (label.includes('carro')) return CarFront;
  if (label.includes('reserva')) return Shield;
  if (label.includes('objetivo')) return Sparkles;
  return Target;
}

export function ObjectivesExperience() {
  const { goalId } = useParams();
  const location = useLocation();
  if (location.pathname.endsWith('/nova')) return <GoalCreateFlow />;
  if (goalId) return <GoalDetailRoute goalId={goalId} />;
  return <GoalListPage />;
}

function GoalListPage() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const goals = [...app.data.goals].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
  const totalSaved = goals.reduce((total, goal) => total + goal.saved, 0);
  return (
    <div className="objectives-page">
      <header className="objectives-page-header">
        <h1>Caixinhas</h1>
        <Link className="button button-ghost objective-create-icon" to="/metas/nova" aria-label="Criar Caixinha" title="Criar Caixinha">
          <Plus size={22} />
        </Link>
      </header>
      {goals.length > 0 && (
        <section className="objectives-total" aria-label="Total guardado nos objetivos">
          <strong>{displayMoney(totalSaved)}</strong>
          <span>guardados nos seus objetivos</span>
        </section>
      )}
      {goals.length ? (
        <div className="objective-list">
          {goals.map((goal) => {
            const Icon = objectiveIcon(goal.purpose);
            const percentage = progressPercent(goal);
            return (
              <Link className="objective-card" to={`/metas/${goal.id}`} key={goal.id}>
                <span className="objective-card-icon"><Icon size={20} /></span>
                <div className="objective-card-heading">
                  <h2>{goal.name}</h2>
                  {percentage >= 100 && <span className="objective-complete">Meta alcançada</span>}
                </div>
                <p className="objective-card-amount">
                  <strong>{displayMoney(goal.saved)}</strong>
                  <span>de {displayMoney(goal.target)}</span>
                </p>
                <Progress value={percentage} label={`Progresso de ${goal.name}`} />
                <span className="objective-card-percent">{Math.round(percentage)}%</span>
                <ChevronRight className="objective-card-chevron" size={20} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="objectives-empty">
          <Target size={30} aria-hidden="true" />
          <h2>Nada por aqui ainda.</h2>
          <p>Crie uma Caixinha para acompanhar o que já guardou e quanto falta para o seu objetivo.</p>
        </div>
      )}
      <Link className="button button-secondary objective-create-button" to="/metas/nova">
        <Plus size={18} /> Criar Caixinha
      </Link>
    </div>
  );
}

function GoalCreateFlow() {
  const app = useApp();
  const navigate = useNavigate();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<(typeof objectiveKinds)[number]['id'] | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const selectedKind = objectiveKinds.find((item) => item.id === kind);
  const targetCents = parseOptionalMoney(target);
  const savedCents = parseOptionalMoney(saved);
  const validStep =
    step === 0
      ? Boolean(kind)
      : step === 1
        ? name.trim().length >= 2
        : step === 2
          ? targetCents !== null && targetCents > 0
          : step === 3
            ? savedCents !== null && savedCents >= 0
            : step === 4
              ? !hasDeadline || (Boolean(deadline) && deadline >= today)
              : true;

  async function createGoal() {
    if (!selectedKind || targetCents === null || savedCents === null) return;
    setPending(true);
    setError('');
    try {
      const id = crypto.randomUUID();
      const goal = goalSchema.parse({
        id,
        name: name.trim(),
        purpose: selectedKind.label,
        target: targetCents,
        saved: savedCents,
        monthly_contribution: 0,
        weekly_amount: 0,
        high_water: savedCents,
        deadline: hasDeadline ? deadline : null,
        priority: 'medium',
      });
      await app.repository.saveJourneyGoal(goal);
      await app.refresh();
      navigate(`/metas/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar sua Caixinha.');
    } finally {
      setPending(false);
    }
  }

  function back() {
    if (step === 0) navigate('/metas');
    else setStep((current) => current - 1);
  }

  function continueStep() {
    setError('');
    if (!validStep) {
      setError('Confira esta etapa antes de continuar.');
      return;
    }
    if (step === 5) void createGoal();
    else setStep((current) => current + 1);
  }

  return (
    <main className="goal-flow-page">
      <header className="goal-flow-header">
        <Button variant="ghost" aria-label="Voltar" onClick={back}><ArrowLeft size={20} /></Button>
        <h1>Criar Caixinha</h1>
        <span>{step + 1} de 6</span>
      </header>
      <div className="goal-flow-progress" aria-label={`Etapa ${step + 1} de 6`}>
        <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
      </div>
      <section className="goal-flow-step" aria-live="polite">
        {step === 0 && (
          <>
            <p className="eyebrow">Começar</p>
            <h2>O que você quer conquistar?</h2>
            <div className="goal-kind-grid" role="group" aria-label="Escolha um objetivo">
              {objectiveKinds.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    className="goal-kind-option"
                    aria-pressed={kind === item.id}
                    key={item.id}
                    onClick={() => { setKind(item.id); setName(item.name); }}
                  >
                    <Icon size={24} /><span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="eyebrow">Nome</p>
            <h2>Como quer chamar?</h2>
            <label className="goal-flow-field">Nome da Caixinha<input autoFocus value={name} minLength={2} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
          </>
        )}
        {step === 2 && (
          <>
            <p className="eyebrow">Alvo</p>
            <h2>Quanto você quer guardar?</h2>
            <label className="goal-flow-field">Meta (R$)<input autoFocus inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
          </>
        )}
        {step === 3 && (
          <>
            <p className="eyebrow">Valor atual</p>
            <h2>Já tem algum valor guardado?</h2>
            <label className="goal-flow-field">Valor guardado (R$)<input autoFocus inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} /></label>
            <p className="muted">Pode deixar R$ 0,00.</p>
          </>
        )}
        {step === 4 && (
          <>
            <p className="eyebrow">Prazo opcional</p>
            <h2>Tem uma data em mente?</h2>
            <div className="goal-deadline-options" role="group" aria-label="Prazo do objetivo">
              <button type="button" aria-pressed={!hasDeadline} onClick={() => setHasDeadline(false)}>Não, vou no meu ritmo</button>
              <button type="button" aria-pressed={hasDeadline} onClick={() => setHasDeadline(true)}>Sim, escolher uma data</button>
            </div>
            {hasDeadline && <label className="goal-flow-field">Data desejada<input type="date" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>}
          </>
        )}
        {step === 5 && selectedKind && targetCents !== null && savedCents !== null && (
          <>
            <p className="eyebrow">Revisão</p>
            <h2>Tudo certo?</h2>
            <dl className="goal-review-list">
              <div><dt>Objetivo</dt><dd>{selectedKind.label}</dd></div>
              <div><dt>Nome</dt><dd>{name}</dd></div>
              <div><dt>Meta</dt><dd>{displayMoney(targetCents)}</dd></div>
              <div><dt>Já guardado</dt><dd>{displayMoney(savedCents)}</dd></div>
              <div><dt>Prazo</dt><dd>{hasDeadline ? formatDate(deadline) : 'Sem data'}</dd></div>
            </dl>
          </>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
      <footer className="goal-flow-footer">
        <Button variant="secondary" onClick={back}>Voltar</Button>
        <Button disabled={pending} onClick={continueStep}>{pending ? 'Criando…' : step === 5 ? 'Criar Caixinha' : 'Continuar'}</Button>
      </footer>
    </main>
  );
}

function GoalDetailRoute({ goalId }: { goalId: string }) {
  const app = useApp();
  const goal = app.data.goals.find((item) => item.id === goalId);
  if (!goal) return <div className="objectives-empty"><h1>Caixinha não encontrada.</h1><Link className="button button-secondary" to="/metas">Voltar às Caixinhas</Link></div>;
  return <GoalDetailPage key={goal.id} goal={goal} />;
}

function GoalDetailPage({ goal }: { goal: Goal }) {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [editing, setEditing] = useState<'name' | 'target' | 'deadline' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [movement, setMovement] = useState<'saving' | 'withdrawal' | null>(null);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const percentage = progressPercent(goal);
  const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const plan = goal.deadline ? goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0) : null;
  const events = app.data.goal_events.filter((event) => event.goal_id === goal.id).sort((first, second) => second.created_at.localeCompare(first.created_at));
  function openEdit(mode: 'name' | 'target' | 'deadline') {
    setError(''); setName(goal.name); setPurpose(goal.purpose ?? ''); setTarget(String(goal.target / 100).replace('.', ','));
    setDeadline(goal.deadline ?? today); setHasDeadline(Boolean(goal.deadline)); setEditing(mode);
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('');
    try {
      const updated = goalSchema.parse({ ...goal, name: editing === 'name' ? name : goal.name, purpose: editing === 'name' ? purpose : goal.purpose, target: editing === 'target' ? parseMoney(target) : goal.target, deadline: editing === 'deadline' ? (hasDeadline ? deadline : null) : goal.deadline });
      await app.repository.saveJourneyGoal(updated); await app.refresh(); app.toast('Caixinha atualizada.'); setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a Caixinha.'); }
    finally { setPending(false); }
  }
  return (
    <div className="objective-detail-page">
      <Link className="objective-back-link" to="/metas"><ArrowLeft size={20} /> Caixinhas</Link>
      <section className="objective-detail-hero" aria-labelledby="objective-detail-title">
        <span className="objective-detail-icon">{(() => { const Icon = objectiveIcon(goal.purpose); return <Icon size={24} />; })()}</span>
        <h1 id="objective-detail-title">{goal.name}</h1>
        <strong className="objective-detail-saved">{displayMoney(goal.saved)}</strong>
        <span className="objective-detail-label">guardados</span>
        <div className="objective-detail-progress"><Progress value={percentage} label={`Progresso de ${goal.name}`} /></div>
        <div className="objective-detail-ratio"><span>Meta</span><strong>{displayMoney(goal.target)}</strong><span>{Math.round(percentage)}%</span></div>
        <p className="objective-detail-remaining">{percentage >= 100 ? 'Meta alcançada.' : `Faltam ${displayMoney(Math.max(0, goal.target - goal.saved))}.`}</p>
      </section>
      <div className="objective-detail-actions">
        <Button onClick={() => { setMovement('saving'); setError(''); }}><Plus size={18} /> Registrar valor guardado</Button>
        {goal.saved > 0 && <Button variant="secondary" onClick={() => { setMovement('withdrawal'); setError(''); }}><ArrowUpRight size={18} /> Retirar</Button>}
      </div>
      <div className="objective-detail-settings">
        <button className="objective-detail-row" onClick={() => openEdit('target')}><span><small>Seu objetivo</small><strong>{displayMoney(goal.target)}</strong></span><ChevronRight size={20} /></button>
        <button className="objective-detail-row" onClick={() => openEdit('deadline')}><span><small>Prazo</small><strong>{goal.deadline ? formatDate(goal.deadline) : 'Sem data'}</strong>{plan?.monthlyTarget != null && plan.remaining > 0 && <small>Para chegar nessa data: ~{displayMoney(plan.monthlyTarget)}/mês</small>}</span><ChevronRight size={20} /></button>
        <button className="objective-detail-row" onClick={() => setHistoryOpen(true)}><span><small>Histórico</small><strong>{events.length ? `${events.length} registros` : 'Ver movimentações'}</strong></span><ChevronRight size={20} /></button>
        <button className="objective-detail-row" onClick={() => openEdit('name')}><span><small>Nome e ícone</small><strong>Editar Caixinha</strong></span><ChevronRight size={20} /></button>
      </div>
      <p className="objective-detail-disclaimer">O Nexo registra seu progresso. Nenhum dinheiro é movimentado.</p>
      {editing && <Dialog title={editing === 'target' ? 'Seu objetivo' : editing === 'deadline' ? 'Prazo' : 'Editar Caixinha'} onClose={() => !pending && setEditing(null)}>
        <form className="simple-form" onSubmit={(event) => void saveSettings(event)}>
          {editing === 'target' && <label>Quanto você quer guardar? (R$)<input autoFocus inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} required /></label>}
          {editing === 'deadline' && <><label className="check-label"><input type="radio" name="goal-deadline" checked={!hasDeadline} onChange={() => setHasDeadline(false)} />Sem data, vou no meu ritmo</label><label className="check-label"><input type="radio" name="goal-deadline" checked={hasDeadline} onChange={() => setHasDeadline(true)} />Escolher uma data</label>{hasDeadline && <label>Data desejada<input type="date" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>}</>}
          {editing === 'name' && <><label>Como quer chamar?<input autoFocus minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Objetivo<select value={purpose} onChange={(event) => setPurpose(event.target.value)}>{objectiveKinds.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}</select></label></>}
          {error && <p role="alert" className="error-message">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button><Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(null)}>Cancelar</Button>
        </form>
      </Dialog>}
      {historyOpen && <Dialog title="Histórico" className="capture-sheet objective-history-sheet" onClose={() => setHistoryOpen(false)}>
        {events.length ? <ul className="objective-history-list">{events.map((event) => <li key={event.id}><span><strong>{event.reason === 'saving' ? 'Valor guardado' : event.reason === 'emergency' ? 'Emergência' : 'Retirada'}</strong><small>{formatDate(event.created_at.slice(0, 10))}</small></span><strong className={event.delta > 0 ? 'positive' : ''}>{event.delta > 0 ? '+' : '−'} {displayMoney(Math.abs(event.delta))}</strong></li>)}</ul> : <p className="muted">Nenhuma movimentação registrada ainda.</p>}
      </Dialog>}
      {movement && <GoalMovementForm goal={goal} kind={movement} onClose={() => setMovement(null)} />}
    </div>
  );
}

function GoalMovementForm({ goal, kind, onClose }: { goal: Goal; kind: 'saving' | 'withdrawal'; onClose: () => void }) {
  const app = useApp(); const displayMoney = useMoneyDisplay(); const today = civilDate(new Date(), app.data.profile.timezone); const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const [amount, setAmount] = useState(''); const [reason, setReason] = useState<'withdrawal' | 'emergency' | ''>(''); const [requestId, setRequestId] = useState(() => crypto.randomUUID()); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const cents = parseOptionalMoney(amount); const after = cents === null ? null : Math.max(0, budget.available - cents);
  async function save(event: FormEvent) {
    event.preventDefault(); if (cents === null || cents <= 0 || (kind === 'withdrawal' && cents > goal.saved)) return;
    setPending(true); setError('');
    try { const delta = kind === 'saving' ? cents : -cents; const result = await app.repository.goalProgress(goal.id, delta, kind === 'saving' ? 'saving' : reason || 'withdrawal', requestId); await app.refresh(); app.toast(kind === 'saving' ? `Valor guardado registrado: ${displayMoney(result.saved)}.` : 'Retirada registrada.'); onClose(); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : 'Não foi possível atualizar a Caixinha.'); }
    finally { setPending(false); }
  }
  return <Dialog title={kind === 'saving' ? 'Registrar valor guardado' : 'Retirar'} className="capture-sheet objective-movement-sheet" onClose={() => !pending && onClose()}>
    <form className="simple-form" onSubmit={(event) => void save(event)}>
      <p>{goal.name} · guardado {displayMoney(goal.saved)}</p>
      <label>{kind === 'saving' ? 'Quanto você guardou? (R$)' : 'Quanto deixou de estar guardado? (R$)'}<input autoFocus inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setRequestId(crypto.randomUUID()); }} required /></label>
      {kind === 'saving' && cents !== null && cents > 0 && <p className="goal-plan-preview">Depois deste registro, ficam {displayMoney(after ?? 0)} livres para planejar.{cents > budget.available && ' Esse valor passa a sobra registrada; confira as contas antes de confirmar.'}</p>}
      {kind === 'withdrawal' && <label>Motivo (opcional)<select value={reason} onChange={(event) => { setReason(event.target.value as 'withdrawal' | 'emergency' | ''); setRequestId(crypto.randomUUID()); }}><option value="">Não informar</option><option value="emergency">Emergência</option><option value="withdrawal">Usei no objetivo</option></select></label>}
      <p className="muted">Confirme somente valores que você já separou. O Nexo registra o progresso; nenhum dinheiro é movimentado.</p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <Button type="submit" disabled={pending || cents === null || cents <= 0 || (kind === 'withdrawal' && cents > goal.saved)}>{pending ? 'Salvando…' : kind === 'saving' ? 'Confirmar' : 'Confirmar retirada'}</Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button>
    </form>
  </Dialog>;
}