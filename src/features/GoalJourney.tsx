import { useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Download,
  Flag,
  Heart,
  Lock,
  Pause,
  Plus,
  Settings2,
  Sprout,
  Target,
  Trophy,
} from 'lucide-react';
import { useApp } from '../data/context';
import { Button, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { goalSchema } from '../../shared/domain';
import type { Goal } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays } from '../../shared/financial-engine';
import {
  canAward,
  goalJourney,
  goalMonthlyBudget,
  goalMonthlyPlan,
  goalPresets,
  habitSummary,
} from '../../shared/journey';

export function JourneyGoalForm({
  existing,
  preset,
  onClose,
}: {
  existing?: Goal;
  preset?: number;
  onClose: () => void;
}) {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [id] = useState(() => existing?.id ?? crypto.randomUUID());
  const [name, setName] = useState(existing?.name ?? 'Minha primeira reserva');
  const [purpose, setPurpose] = useState(
    existing?.purpose ?? 'Ter tranquilidade quando surgir uma urgência.',
  );
  const [target, setTarget] = useState(
    existing ? String(existing.target / 100).replace('.', ',') : preset ? String(preset / 100) : '500',
  );
  const [saved, setSaved] = useState(existing ? String(existing.saved / 100).replace('.', ',') : '0');
  const [weekly, setWeekly] = useState(String((existing?.weekly_amount ?? 0) / 100).replace('.', ','));
  const [deadline, setDeadline] = useState(existing?.deadline ?? shiftDays(today, 90));
  const [hasDeadline, setHasDeadline] = useState(existing?.deadline !== null && existing?.deadline !== undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const preview = (() => {
    try {
      const initialSaved = parseMoney(saved);
      const available = Math.max(0, budget.available - (existing ? 0 : initialSaved));
      return goalMonthlyPlan(
        { target: parseMoney(target), saved: initialSaved, deadline: hasDeadline ? deadline : null },
        today,
        available,
        budget.contributed[id] ?? 0,
      );
    } catch {
      return null;
    }
  })();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await app.repository.saveJourneyGoal(
        goalSchema.parse({
          id,
          name,
          purpose,
          target: parseMoney(target),
          saved: parseMoney(saved),
          weekly_amount: parseMoney(weekly),
          high_water: existing?.high_water ?? 0,
          monthly_contribution: existing?.monthly_contribution ?? 0,
          deadline: hasDeadline ? deadline : null,
          priority: existing?.priority ?? 'medium',
        }),
      );
      await app.refresh();
      app.toast('Sua Caixinha está em foco. Um passo de cada vez.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confira os valores e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={existing ? 'Editar Caixinha' : 'Criar Caixinha'}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={pending} className="simple-form">
          <label>
            Nome da Caixinha
            <input
              required
              minLength={2}
              maxLength={100}
              data-dialog-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Por que isso importa para você?
            <textarea maxLength={180} value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
          <label>
            Valor que quer alcançar (R$)
            <input
              required
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <div className="goal-presets" role="group" aria-label="Valores sugeridos para Caixinha">
            {goalPresets.map((value) => (
              <button
                type="button"
                key={value}
                className="button button-secondary goal-preset"
                aria-pressed={value === Number(target.replace(',', '.')) * 100}
                onClick={() => setTarget(String(value / 100))}
              >
                {displayMoney(value)}
              </button>
            ))}
          </div>
          <label>
            Quanto está guardado agora? (R$)
            <input
              required
              inputMode="decimal"
              value={saved}
              onChange={(event) => setSaved(event.target.value)}
            />
            {existing && <small>Ajustes no valor guardado ficam registrados no histórico da Caixinha.</small>}
          </label>
          <details>
            <summary>Passo semanal opcional</summary>
            <label>
              Passo semanal confortável (R$)
              <input
                required
                inputMode="decimal"
                value={weekly}
                onChange={(event) => setWeekly(event.target.value)}
              />
              <small>Passo opcional, sem comprometer contas ou necessidades essenciais.</small>
            </label>
          </details>
          <label className="check-label">
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(event) => setHasDeadline(event.target.checked)}
            />
            Tenho uma data para alcançar esta Caixinha
          </label>
          {hasDeadline && (
            <label>
              Data que quer alcançar a Caixinha
              <input
                required
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
          )}
          {preview && preview.monthlyTarget !== null && (
            <div className="goal-plan-preview" aria-live="polite">
              <p>
                Para esse prazo: <strong>{displayMoney(preview.monthlyTarget)} por mês.</strong>
              </p>
              <p>
                Na sobra atual, cabe <strong>{displayMoney(preview.suggested)}</strong> neste mês.
              </p>
              {preview.gap > 0 && (
                <p>
                  Faltam {displayMoney(preview.gap)} para a cota deste mês. Ajuste o prazo ou o valor se
                  precisar.
                </p>
              )}
            </div>
          )}
          {!hasDeadline && (
            <p className="goal-plan-preview">Sem data final. Você pode avançar no seu ritmo, sem cota mensal obrigatória.</p>
          )}
          <p className="muted">
            A estimativa usa suas anotações, sem antecipar renda nem prometer rendimento. O prazo é ajustável.
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Check size={18} />
            {pending ? 'Salvando…' : existing ? 'Salvar alterações' : 'Criar Caixinha'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}

function GoalMovement({
  goal,
  reason,
  onClose,
}: {
  goal: Goal;
  reason: 'saving' | 'withdrawal' | 'emergency';
  onClose: () => void;
}) {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const plan = goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0);
  const [requestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(
    reason === 'saving' && plan.suggested ? String(plan.suggested / 100).replace('.', ',') : '',
  );
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const simulated = (() => {
    try {
      return parseMoney(amount);
    } catch {
      return null;
    }
  })();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      if (!confirmed) throw new Error('Confirme o que já aconteceu.');
      const delta = parseMoney(amount);
      if (delta <= 0) throw new Error('Informe um valor positivo.');
      const result = await app.repository.goalProgress(
        goal.id,
        reason === 'saving' ? delta : -delta,
        reason,
        requestId,
      );
      await app.refresh();
      app.toast(
        reason === 'saving'
          ? `Progresso anotado${result.points ? `. +${result.points} pontos de hábito` : ''}.`
          : reason === 'emergency'
            ? 'Seu dinheiro ajudou quando foi preciso. Suas conquistas continuam.'
            : 'Valor atualizado. Seu histórico e seus pontos permanecem.',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={
        reason === 'saving'
          ? 'Já guardei dinheiro'
          : reason === 'emergency'
            ? 'Usei minha reserva numa urgência'
            : 'Atualizar valor usado'
      }
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <p>
          {goal.name} · guardado {displayMoney(goal.saved)}
        </p>
        <label>
          Valor (R$)
          <input
            required
            inputMode="decimal"
            value={amount}
            data-dialog-autofocus
            onChange={(event) => {
              setAmount(event.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        {reason === 'saving' && simulated !== null && (
          <p className="goal-plan-preview" aria-live="polite">
            Se separar {displayMoney(simulated)}, ficam{' '}
            {displayMoney(Math.max(0, budget.available - simulated))} livres para planejar.
            {simulated > budget.available &&
              ' Esse valor supera a sobra registrada; confira suas contas antes de confirmar.'}{' '}
            A prévia não salva nada.
          </p>
        )}
        {reason === 'emergency' && (
          <p>
            Uma reserva também existe para proteger você. Isso não apaga o que você aprendeu nem seus pontos.
          </p>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {reason === 'withdrawal'
            ? 'Esse valor não está mais separado'
            : `Esse valor já foi ${reason === 'saving' ? 'separado de verdade' : 'usado'}`}
          . Isto atualiza minha Caixinha, não transfere dinheiro nem cria gasto duplicado.
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <Button disabled={pending || !confirmed}>
          <Check size={18} />
          {pending ? 'Atualizando…' : 'Confirmar progresso'}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
          Cancelar
        </Button>
      </form>
    </Dialog>
  );
}

function downloadAchievement(name: string, goal: Goal | null, points: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1100;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível criar o cartão neste aparelho.');
  context.fillStyle = '#f4f7f6';
  context.fillRect(0, 0, 900, 1100);
  context.fillStyle = '#24664f';
  context.fillRect(0, 0, 900, 20);
  context.font = '700 54px Manrope, sans-serif';
  context.fillStyle = '#192b25';
  context.fillText('Nexo · Meu caminho', 70, 140);
  context.font = '600 40px Manrope, sans-serif';
  context.fillText(name.split(' ')[0].slice(0, 24), 70, 250);
  context.font = '500 32px Manrope, sans-serif';
  const lines = [
    'Meu esforço continua.',
    `${points} pontos de hábitos construídos.`,
    goal ? `Minha Caixinha: ${goal.name}` : 'Um passo de cada vez.',
    'Uma pausa não apaga minhas conquistas.',
    'Nenhum dado bancário foi compartilhado.',
  ];
  let height = 360;
  for (const line of lines) {
    let wrapped = '';
    for (const word of line.split(' ')) {
      if (context.measureText(`${wrapped} ${word}`).width > 740) {
        context.fillText(wrapped, 70, height);
        height += 48;
        wrapped = word;
      } else wrapped = wrapped ? `${wrapped} ${word}` : word;
    }
    context.fillText(wrapped, 70, height);
    height += 85;
  }
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nexo-minha-conquista.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, 'image/png');
}

export function GoalJourney() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const goal =
    app.data.goals.find((item) => item.id === app.data.profile.active_goal_id) ??
    app.data.goals.find((item) => item.saved < item.target) ??
    app.data.goals[0] ??
    null;
  const summary = habitSummary(app.data.habit_events);
  const journey = goal
    ? goalJourney(goal, goal.weekly_amount ?? 0, Math.max(goal.high_water ?? 0, goal.saved))
    : null;
  const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const plan = goal ? goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0) : null;
  const [setup, setSetup] = useState<{ existing?: Goal; preset?: number } | null>(null);
  const [movement, setMovement] = useState<'saving' | 'withdrawal' | 'emergency' | null>(null);
  const [review, setReview] = useState(false);
  const [rewards, setRewards] = useState(false);
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const paused = !!app.data.profile.journey_pause_until && app.data.profile.journey_pause_until >= today;
  const checked = !canAward(
    app.data.habit_events,
    'checkin',
    today,
    'checkin-preview',
    app.data.profile.checkin_frequency,
  );
  const reflectionDue = canAward(app.data.habit_events, 'reflection', today, 'reflection-preview');
  async function check(kind: 'checkin' | 'reflection', mode?: 'steady' | 'recovery' | 'pause') {
    setPending(true);
    setError('');
    try {
      const points = await app.repository.checkin(kind, mode);
      await app.refresh();
      app.toast(
        points
          ? `Check-in registrado. +${points} pontos de hábito. Obrigado por olhar para seu momento.`
          : 'Seu check-in foi acolhido. Pontos do período já estavam registrados.',
      );
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.');
    } finally {
      setPending(false);
    }
  }
  async function preference(patch: Partial<typeof app.data.profile>) {
    setPending(true);
    setError('');
    try {
      await app.repository.profile({ ...app.data.profile, ...patch });
      await app.refresh();
    } catch {
      setError('Não foi possível salvar sua preferência.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="goal-journey"
      data-style={app.data.profile.journey_style}
      aria-labelledby="goal-journey-title"
    >
      <div className="journey-title-row">
        <div>
          <p className="eyebrow">Seu plano por mês</p>
          <h2 id="goal-journey-title">{goal ? goal.name : 'Qual é o primeiro passo que você quer dar?'}</h2>
        </div>
        <div className="journey-title-actions">
          {goal && (
            <Button
              variant="secondary"
              className="journey-new-goal"
              aria-label="Nova Caixinha"
              onClick={() => setSetup({})}
            >
              <Plus size={18} /> <span>Nova Caixinha</span>
            </Button>
          )}
          <Button
            variant="ghost"
            title="Personalizar acompanhamento"
            aria-label="Personalizar acompanhamento"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={20} />
          </Button>
        </div>
      </div>
      {goal && journey && plan ? (
        <>
          <p className="journey-purpose">{goal.purpose || 'Ter mais tranquilidade nas suas escolhas.'}</p>
          <div className="journey-main">
            <div>
              <div className="journey-amount">
                <strong>{displayMoney(goal.saved)}</strong>
                <span>de {displayMoney(goal.target)}</span>
              </div>
              <Progress value={journey.percent} label={`Progresso total de ${goal.name}`} />
              <p className="journey-estimate muted">
                {Math.round(journey.percent)}% da Caixinha · faltam {displayMoney(plan.remaining)}.
              </p>
              <dl className="goal-monthly-plan">
                <div className="goal-next-contribution">
                  <dt>{goal.deadline ? 'Próximo aporte neste mês' : 'Aporte opcional neste mês'}</dt>
                  <dd>{goal.deadline ? displayMoney(plan.suggested) : 'No seu ritmo'}</dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd>
                    {goal.deadline
                      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
                          new Date(`${goal.deadline}T12:00:00Z`),
                        )
                      : 'Sem data final'}
                  </dd>
                </div>
                {plan.monthlyTarget !== null && (
                  <div>
                    <dt>Cota mensal para o prazo</dt>
                    <dd>{displayMoney(plan.monthlyTarget)}</dd>
                  </div>
                )}
                <div>
                  <dt>Aportes registrados neste mês</dt>
                  <dd>{displayMoney(plan.savedThisMonth)}</dd>
                </div>
                <div>
                  <dt>Livre para planejar agora</dt>
                  <dd>{displayMoney(budget.available)}</dd>
                </div>
              </dl>
              {plan.remaining > 0 && !plan.feasibleNow && (
                <p className="goal-plan-warning">
                  {plan.overdue ? 'O prazo escolhido já passou. ' : ''}
                  Faltam {displayMoney(plan.gap)} para completar a cota deste mês com a sobra atual.
                  {plan.projectedMonth
                    ? ` Se essa capacidade se repetisse, a Caixinha chegaria ao alvo em ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${plan.projectedMonth}-01T12:00:00Z`))}.`
                    : ' Não há sobra registrada para sugerir um aporte agora.'}{' '}
                  Ajuste o prazo ou o valor sem comprometer contas essenciais.
                </p>
              )}
              <small className="muted">
                Estimativa pelas anotações. Contas não registradas podem mudar o plano; renda prevista não é
                dinheiro recebido.
              </small>
              <p className="journey-coaching">
                {paused
                  ? 'Seus lembretes da jornada estão pausados. Seu progresso continua aqui, sem cobrança.'
                  : !goal.deadline
                    ? 'Sem prazo final. Você pode guardar no seu ritmo, sem obrigação mensal.'
                    : app.data.profile.journey_mode === 'recovery' || journey.recovering
                    ? `Seu esforço não foi apagado. Você já chegou a ${displayMoney(journey.peak)}. Vamos retomar sem tirar dinheiro do essencial.`
                    : plan.remaining === 0
                      ? 'Alvo alcançado.'
                      : plan.required === 0
                        ? 'Você já completou a cota deste mês.'
                        : `Neste mês, cabe um próximo aporte de ${displayMoney(plan.suggested)} com a sobra atual.`}
              </p>
              <details>
                <summary>Marcos do caminho</summary>
                <p>
                  <Flag size={18} /> Próximo marco: {displayMoney(journey.milestone)}.
                </p>
              </details>
            </div>
            <div className="journey-actions">
              <Button onClick={() => setMovement('saving')}>
                <Plus size={18} />
                Guardei dinheiro
              </Button>
              <Button variant="secondary" onClick={() => setMovement('emergency')}>
                <Heart size={18} />
                Precisei usar numa urgência
              </Button>
              <Button variant="ghost" onClick={() => setSetup({ existing: goal })}>
                Editar Caixinha
              </Button>
              <Button variant="ghost" onClick={() => setMovement('withdrawal')}>
                Anotar retirada
              </Button>
            </div>
          </div>
          <div className="journey-foot">
            <span>Já guardou {displayMoney(journey.peak)} nesta Caixinha.</span>
            <span>
              {app.data.goal_events.filter((event) => event.goal_id === goal.id && event.delta > 0).length}{' '}
              passos registrados. O dinheiro atual é separado do histórico.
            </span>
          </div>
        </>
      ) : (
        <>
          <p>
            Comece com uma reserva de R$ 500 ou escolha o valor que faz sentido para você. Pode ajustar
            depois.
          </p>
          <div className="goal-presets">
            {goalPresets.map((value) => (
              <Button key={value} variant="secondary" onClick={() => setSetup({ preset: value })}>
                {displayMoney(value)}
              </Button>
            ))}
          </div>
          <div>
            <Button onClick={() => setSetup({})}>
              <Target size={18} />
              Criar minha Caixinha
            </Button>
          </div>
        </>
      )}
      {app.data.goals.length > 1 && (
        <label className="journey-goal-picker">
          Caixinha em foco
          <select
            value={goal?.id ?? ''}
            disabled={pending}
            onChange={(event) => void preference({ active_goal_id: event.target.value })}
          >
            {app.data.goals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="journey-habits">
        <div>
          <h3>
            <Sprout size={20} />
            Cuidar do seu momento
          </h3>
          <p>
            {checked
              ? app.data.profile.checkin_frequency === 'weekly'
                ? 'Seu check-in desta semana está feito. Sem obrigação de voltar amanhã.'
                : 'Você já fez seu check-in de hoje. Sem obrigação de voltar amanhã.'
              : 'Um check-in pode ser só olhar seu momento. Não precisa guardar dinheiro para participar.'}
          </p>
          <div className="simple-inline-actions">
            <Button variant="secondary" disabled={pending || checked} onClick={() => setReview(true)}>
              <Check size={18} />
              {checked
                ? app.data.profile.checkin_frequency === 'weekly'
                  ? 'Check-in desta semana feito'
                  : 'Check-in de hoje feito'
                : 'Fazer meu check-in'}
            </Button>
            {reflectionDue && (
              <Button variant="ghost" disabled={pending} onClick={() => void check('reflection')}>
                Revisei minha semana
              </Button>
            )}
          </div>
        </div>
        {app.data.profile.show_journey_points && (
          <div className="journey-level">
            <span className="journey-level-icon">
              <Award size={26} />
            </span>
            <div>
              <strong>
                Nível {summary.level} · {summary.label}
              </strong>
              <p>
                {summary.points} pontos de hábitos
                {summary.next ? ` · faltam ${summary.remaining} para o próximo nível` : ''}
              </p>
              <small>Não é score de crédito, saldo ou medida do seu valor.</small>
            </div>
            <Button variant="ghost" onClick={() => setRewards(true)}>
              Minhas conquistas <ChevronRight size={18} />
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {setup && (
        <JourneyGoalForm existing={setup.existing} preset={setup.preset} onClose={() => setSetup(null)} />
      )}
      {movement && goal && <GoalMovement goal={goal} reason={movement} onClose={() => setMovement(null)} />}
      {review && (
        <Dialog
          title="Como está seu momento?"
          onClose={() => {
            if (!pending) setReview(false);
          }}
        >
          <div className="simple-form">
            <p>Você escolhe o ritmo. Não perde pontos se pausar ou precisar usar sua reserva.</p>
            <Button disabled={pending} onClick={() => void check('checkin', 'steady')}>
              <Sprout size={18} />
              Posso seguir no meu ritmo
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => void check('checkin', 'recovery')}>
              <Heart size={18} />
              Estou retomando aos poucos
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => void check('checkin', 'pause')}>
              <Pause size={18} />
              Preciso pausar lembretes por 7 dias
            </Button>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {settings && (
        <Dialog
          title="Seu jeito de acompanhar"
          onClose={() => {
            if (!pending) setSettings(false);
          }}
        >
          <div className="simple-form">
            <label className="check-label">
              <input
                type="checkbox"
                checked={app.data.profile.show_journey_points}
                disabled={pending}
                onChange={(event) => void preference({ show_journey_points: event.target.checked })}
              />
              Mostrar pontos e níveis de hábitos
            </label>
            <label>
              Check-in que combina com você
              <select
                value={app.data.profile.checkin_frequency}
                disabled={pending}
                onChange={(event) =>
                  void preference({ checkin_frequency: event.target.value as 'daily' | 'weekly' })
                }
              >
                <option value="weekly">Semanal, sem cobrança diária</option>
                <option value="daily">Diário, sem perder sequência</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={app.data.profile.journey_reminders}
                disabled={pending}
                onChange={(event) => void preference({ journey_reminders: event.target.checked })}
              />
              Quero lembretes opcionais da Caixinha
            </label>
            <label>
              Horário preferido para o lembrete
              <select
                value={app.data.profile.reminder_hour}
                disabled={pending}
                onChange={(event) => void preference({ reminder_hour: Number(event.target.value) })}
              >
                {Array.from({ length: 11 }, (_, index) => index + 9).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}:00
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Envio pelo WhatsApp requer seu consentimento em Ajustes e liberação/configuração da Meta. Ativar
              aqui não garante entrega. Você pode pausar sem perder conquistas.
            </p>
            {paused && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => void preference({ journey_pause_until: null, journey_mode: 'steady' })}
              >
                Retomar lembretes
              </Button>
            )}
            <Button onClick={() => setSettings(false)}>Concluir</Button>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {rewards && (
        <Dialog title="Conquistas que ficam" onClose={() => setRewards(false)}>
          <div className="simple-form">
            <p>
              {summary.points} pontos de hábitos · {summary.checkins} check-ins registrados. Seus pontos não
              diminuem com urgências ou pausas.
            </p>
            <ul className="journey-rewards">
              {summary.rewards.map((reward) => (
                <li key={reward.id}>
                  <span>{reward.unlocked ? <Trophy size={20} /> : <Lock size={20} />}</span>
                  <div>
                    <h3>{reward.title}</h3>
                    <p>{reward.unlocked ? 'Conquistado' : `${reward.required} pontos para conquistar`}</p>
                  </div>
                </li>
              ))}
            </ul>
            {summary.points >= 25 && (
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    downloadAchievement(app.data.profile.name, goal, summary.points);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Não foi possível criar cartão.');
                  }
                }}
              >
                <Download size={18} />
                Baixar meu cartão de conquista
              </Button>
            )}
            {summary.points >= 75 && (
              <label>
                Cor da minha jornada
                <select
                  value={app.data.profile.journey_style}
                  disabled={pending}
                  onChange={(event) =>
                    void preference({
                      journey_style: event.target.value as 'forest' | 'ocean' | 'sun' | 'berry',
                    })
                  }
                >
                  <option value="forest">Verde · tranquilidade</option>
                  <option value="ocean">Azul · clareza</option>
                  <option value="sun">Dourado · energia</option>
                  <option value="berry">Rosa · meu caminho</option>
                </select>
              </label>
            )}
            {summary.points >= 150 && (
              <article className="journey-letter">
                <h3>Uma carta para {app.data.profile.name.split(' ')[0]}</h3>
                <p>
                  Você voltou para olhar seu dinheiro {summary.checkins} vezes. Isso é um hábito construído,
                  não uma obrigação.
                </p>
                <p>
                  {journey
                    ? `Você já guardou ${displayMoney(journey.peak)} nesta Caixinha. O que precisou ser usado não apaga sua capacidade de retomar.`
                    : 'Seu caminho pode começar com uma Caixinha pequena.'}
                </p>
                <p>Seu próximo passo não precisa impressionar ninguém. Precisa caber na sua vida.</p>
              </article>
            )}
            {summary.points >= 300 && (
              <section className="journey-achievements">
                <h3>Seu quadro de conquistas</h3>
                <p>
                  {summary.checkins} check-ins · nível {summary.level} ·{' '}
                  {app.data.goal_events.filter((event) => event.delta > 0).length} passos de reserva.
                </p>
                {journey && <p>Maior valor guardado nesta Caixinha: {displayMoney(journey.peak)}.</p>}
              </section>
            )}
            <p className="muted">
              Pontos reconhecem hábitos com limites diários. Registrar várias mensagens iguais não aumenta os
              pontos. Recursos financeiros e privacidade estão disponíveis desde o começo.
            </p>
            <Button onClick={() => setRewards(false)}>Concluir</Button>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
