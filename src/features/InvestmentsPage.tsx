import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Plus,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Badge, Button, Card, Dialog, PageHeader, SectionTitle, Stat } from '../design-system/components';
import { goalSchema } from '../../shared/domain';
import type { Goal } from '../../shared/domain';
import { civilDate, formatMoney, goalPlan, parseMoney, shiftMonths } from '../../shared/financial-engine';
import { personalSummary } from '../../shared/insights';

type Horizon = 'three_months' | 'one_year' | 'three_years' | 'five_plus' | 'unsure';
type EarlyAccess = 'yes' | 'maybe' | 'no';
type LossResponse = 'withdraw' | 'wait' | 'stay';
type Knowledge = 'beginner' | 'basic' | 'experienced';
type MobileView = 'plan' | 'guidance';
type AdviceReply = {
  answer: string;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
};
type Direction = { title: string; summary: string; nextStep: string; source: { title: string; url: string } };
type InvestmentAnswers = {
  horizon: Horizon | null;
  earlyAccess: EarlyAccess | null;
  lossResponse: LossResponse | null;
  knowledge: Knowledge | null;
  months: number;
};

const horizonChoices: { id: Horizon; label: string }[] = [
  { id: 'three_months', label: 'Em até 3 meses' },
  { id: 'one_year', label: 'Em 1 ano' },
  { id: 'three_years', label: 'Em 3 anos' },
  { id: 'five_plus', label: 'Em 5 anos ou mais' },
  { id: 'unsure', label: 'Ainda não sei' },
];
const earlyAccessChoices: { id: EarlyAccess; label: string }[] = [
  { id: 'yes', label: 'Sim' },
  { id: 'maybe', label: 'Talvez' },
  { id: 'no', label: 'Não' },
];
const lossResponseChoices: { id: LossResponse; label: string }[] = [
  { id: 'withdraw', label: 'Precisaria retirar esse dinheiro' },
  { id: 'wait', label: 'Ficaria preocupado, mas poderia esperar' },
  { id: 'stay', label: 'Manteria o plano mesmo com a queda' },
];
const knowledgeChoices: { id: Knowledge; label: string }[] = [
  { id: 'beginner', label: 'Estou começando' },
  { id: 'basic', label: 'Conheço o básico' },
  { id: 'experienced', label: 'Tenho experiência' },
];

function directionFor(answers: InvestmentAnswers): Direction {
  if (!answers.horizon || !answers.earlyAccess || !answers.lossResponse || !answers.knowledge)
    return {
      title: 'Responda às perguntas para receber uma orientação',
      summary: 'O mesmo investimento pode servir para um objetivo e não servir para outro.',
      nextStep: 'Vamos considerar quando você usará o dinheiro, se pode precisar dele antes e como reagiria a uma queda.',
      source: {
        title: 'CVM: o que avaliar antes de investir',
        url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir',
      },
    };
  const shortHorizon =
    answers.horizon === 'three_months' || answers.horizon === 'one_year' || answers.months <= 12;
  const mayNeedMoney = answers.earlyAccess !== 'no';
  const dateMismatch =
    (answers.horizon === 'three_months' && answers.months > 6) ||
    (answers.horizon === 'one_year' && answers.months > 24) ||
    (answers.horizon === 'three_years' && (answers.months < 18 || answers.months > 48)) ||
    (answers.horizon === 'five_plus' && answers.months < 36);
  if (dateMismatch)
    return {
      title: 'Sua resposta e a data da meta são diferentes',
      summary: 'A data salva para esta meta não combina com quando você disse que pretende usar o dinheiro.',
      nextStep: 'Confira a data da meta ou sua resposta sobre o prazo. A orientação muda quando essas informações combinam.',
      source: {
        title: 'CVM: escolha considerando seu objetivo e prazo',
        url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir',
      },
    };
  if (answers.lossResponse === 'stay' && (shortHorizon || mayNeedMoney))
    return {
      title: 'Seu prazo e sua escolha entram em conflito',
      summary: 'Você aceitaria uma queda grande, mas pode precisar do dinheiro antes de ele se recuperar.',
      nextStep:
        'Para este objetivo, compare opções com pouca mudança no valor. Deixe opções que podem cair bastante para um objetivo distante e para dinheiro que pode ficar guardado.',
      source: {
        title: 'CVM: entenda os riscos antes de investir',
        url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir',
      },
    };
  if (mayNeedMoney || answers.lossResponse === 'withdraw')
    return {
      title: 'Você pode precisar desse dinheiro antes',
      summary: 'Você disse que talvez precise retirar o dinheiro ou que uma queda faria você tirá-lo.',
      nextStep:
        'Procure entender quando pode retirar e se existe espera. Um ganho anunciado não ajuda se o dinheiro não estiver disponível quando você precisar.',
      source: {
        title: 'CVM: quando você pode retirar o dinheiro',
        url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir/entenda-as-caracteristicas-dos-investimentos/liquidez',
      },
    };
  if (answers.lossResponse === 'stay' && answers.horizon === 'five_plus' && answers.knowledge === 'experienced')
    return {
      title: 'Você tem tempo e aceita esperar',
      summary: 'Você aceita ver o valor cair e tem um prazo longo para este objetivo. Ainda assim, uma perda pode não ser recuperada.',
      nextStep:
        'Você pode estudar opções com mais variação, comparar custos e evitar concentrar todo o dinheiro em uma só opção. Não use dinheiro de contas ou da reserva.',
      source: {
        title: 'CVM: conheça diferentes tipos de investimento',
        url: 'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos',
      },
    };
  if (answers.lossResponse === 'stay' && answers.horizon === 'five_plus')
    return {
      title: 'Seu prazo é longo; você ainda está aprendendo',
      summary: 'Ter mais tempo ajuda, mas não elimina perdas. Como você está começando, entenda cada opção antes de aumentar a variação.',
      nextStep: 'Compare opções diferentes e comece pelo que pode acontecer com seu dinheiro. Não coloque tudo em uma única opção.',
      source: {
        title: 'CVM: conheça diferentes tipos de investimento',
        url: 'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos',
      },
    };
  return {
    title: 'Para este objetivo, cuide primeiro do acesso ao dinheiro',
    summary:
      'Seu prazo, a chance de precisar do dinheiro antes ou sua reação a uma queda indicam comparar opções mais estáveis e fáceis de retirar.',
    nextStep:
      'Compare quando pode retirar, os custos e os impostos. A opção com o maior ganho anunciado pode não combinar com a data em que você precisa do dinheiro.',
    source: {
      title: 'CVM: o que avaliar antes de investir',
      url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir',
    },
  };
}

function monthsUntil(deadline: string, today: string) {
  if (deadline <= today) return 0;
  const [targetYear, targetMonth, targetDay] = deadline.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  const difference = (targetYear - currentYear) * 12 + targetMonth - currentMonth;
  return Math.max(1, Math.min(600, difference + (targetDay > currentDay ? 1 : 0)));
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function InvestmentGoalDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (goal: Goal) => void;
}) {
  const app = useApp();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0,00');
  const [deadline, setDeadline] = useState(shiftMonths(today, 12));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const goal = goalSchema.parse({
        id: crypto.randomUUID(),
        name,
        purpose: 'Objetivo de investimento',
        target: parseMoney(target),
        saved: parseMoney(saved),
        monthly_contribution: 0,
        weekly_amount: 0,
        high_water: parseMoney(saved),
        deadline,
        priority: 'medium',
      });
      await app.repository.save('goals', goal, null);
      await app.refresh();
      onCreated(goal);
      app.toast('Objetivo criado. Agora escolha quanto quer guardar por mês.');
    } catch {
      setError('Confira o nome, os valores e a data do seu objetivo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="Criar um objetivo" onClose={() => !pending && onClose()}>
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <fieldset className="simple-form" disabled={pending}>
          <label>
            O que você quer fazer?
            <input
              autoFocus
              data-dialog-autofocus
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: guardar para uma viagem"
              required
            />
          </label>
          <label>
            Quanto quer juntar? (R$)
            <input
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="10.000,00"
              required
            />
          </label>
          <label>
            Quanto já está guardado? (R$)
            <input inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} required />
          </label>
          <label>
            Até quando gostaria?
            <input type="date" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
          </label>
          <p className="muted">Você pode mudar essa data. O dinheiro pode crescer mais ou menos do que o esperado.</p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Check size={18} />
            {pending ? 'Salvando…' : 'Salvar objetivo'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function InvestmentsPage() {
  const app = useApp();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const summary = personalSummary(app.data, today);
  const [goalId, setGoalId] = useState(() => app.data.goals[0]?.id ?? '');
  const [monthlyInput, setMonthlyInput] = useState(() => {
    const amount = app.data.goals[0]?.monthly_contribution ?? 0;
    return (amount / 100).toFixed(2).replace('.', ',');
  });
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [earlyAccess, setEarlyAccess] = useState<EarlyAccess | null>(null);
  const [lossResponse, setLossResponse] = useState<LossResponse | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('plan');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advice, setAdvice] = useState<AdviceReply | null>(null);
  const selectedGoal = app.data.goals.find((goal) => goal.id === goalId);
  const answersComplete = Boolean(horizon && earlyAccess && lossResponse && knowledge);
  const horizonLabel = horizonChoices.find((choice) => choice.id === horizon)?.label ?? 'ainda não respondido';
  const earlyAccessLabel = earlyAccessChoices.find((choice) => choice.id === earlyAccess)?.label ?? 'ainda não respondido';
  const lossResponseLabel = lossResponseChoices.find((choice) => choice.id === lossResponse)?.label ?? 'ainda não respondido';
  const knowledgeLabel = knowledgeChoices.find((choice) => choice.id === knowledge)?.label ?? 'ainda não respondido';
  let monthlyAmount: number | null = null;
  try {
    monthlyAmount = parseMoney(monthlyInput);
    if (monthlyAmount < 0) monthlyAmount = null;
  } catch {
    monthlyAmount = null;
  }
  const months = selectedGoal ? monthsUntil(selectedGoal.deadline, today) : 0;
  const projection =
    selectedGoal && monthlyAmount !== null
      ? goalPlan(selectedGoal.target, selectedGoal.saved, months, monthlyAmount)
      : null;
  const balanceWithoutReturns =
    selectedGoal && monthlyAmount !== null
      ? Math.min(
          selectedGoal.target,
          selectedGoal.saved + Math.min(selectedGoal.target - selectedGoal.saved, monthlyAmount * months),
        )
      : null;
  const declaredMonthlyRoom = Math.max(0, app.data.profile.monthly_income - app.data.profile.fixed_expenses);
  const direction = directionFor({ horizon, earlyAccess, lossResponse, knowledge, months });

  function selectGoal(id: string) {
    setGoalId(id);
    const next = app.data.goals.find((goal) => goal.id === id);
    setMonthlyInput(((next?.monthly_contribution ?? 0) / 100).toFixed(2).replace('.', ','));
    setNotice('');
    setAdvice(null);
    setHorizon(null);
    setEarlyAccess(null);
    setLossResponse(null);
    setKnowledge(null);
    setMobileView('plan');
  }

  async function saveContribution() {
    if (!selectedGoal || monthlyAmount === null) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await app.repository.save(
        'goals',
        goalSchema.parse({ ...selectedGoal, monthly_contribution: monthlyAmount }),
        null,
      );
      await app.refresh();
      setNotice('Seu plano foi salvo. Nenhum dinheiro foi transferido.');
      setMobileView('guidance');
    } catch {
      setError('Não foi possível salvar. Confira o valor e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function askNexo() {
    if (!selectedGoal || !answersComplete || asking) return;
    setAsking(true);
    setError('');
    setAdvice(null);
    try {
      if (app.demo) {
        setAdvice({
          answer:
            'Na demonstração, a IA não é consultada. Em uma conta real, o Nexo explica apenas o que encontra em fontes confiáveis. Ele não escolhe onde você vai investir nem promete ganhos.',
          sources: [],
          evidence_status: 'demo',
        });
        return;
      }
      const response = await invoke<AdviceReply>('ai-chat', {
        question: `Explique de forma curta e específica para esta pessoa, nunca dê uma resposta padrão. Objetivo: "${selectedGoal.name}"; valor desejado: ${formatMoney(selectedGoal.target)}; já guardado: ${formatMoney(selectedGoal.saved)}; quanto pretende guardar por mês: ${monthlyAmount === null ? 'ainda não informado' : formatMoney(monthlyAmount)}; quando pretende usar: "${horizonLabel}" (${months} meses pela data escolhida); pode precisar antes: "${earlyAccessLabel}"; diante de uma queda de 15%, faria: "${lossResponseLabel}"; conhecimento: "${knowledgeLabel}". Registros financeiros: dinheiro depois das contas ${formatMoney(summary.free)}, reserva ${formatMoney(summary.reserve)}, dívidas ${formatMoney(summary.debts)}. Explique quais respostas mudam sua conclusão e se prazo, acesso ao dinheiro e reação à perda combinam. Não escolha Tesouro Direto por padrão nem indique comprar banco, produto, título, ação ou fundo. Se as fontes não sustentarem uma opção específica, diga o que comparar e quais dados faltam. Não prometa ganhos.`,
        save_history: false,
      });
      setAdvice(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar uma explicação agora.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Seu dinheiro no futuro"
        title="Investir sem complicar"
        description="Escolha algo que quer fazer e veja quanto guardar por mês. Não prometemos ganhos."
        action={<Badge>Plano para avaliar</Badge>}
      />
      <div className="investment-mobile-tabs" role="group" aria-label="Área de investimentos">
        <Button
          type="button"
          variant="secondary"
          aria-pressed={mobileView === 'plan'}
          onClick={() => setMobileView('plan')}
        >
          Meu plano
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-pressed={mobileView === 'guidance'}
          onClick={() => setMobileView('guidance')}
        >
          Minha orientação
        </Button>
      </div>
      <div className="investment-grid" data-mobile-view={mobileView}>
        <div className="investment-controls">
          <Card className="investment-controls-card">
            <SectionTitle action={<Target size={20} aria-hidden="true" />}>1. O que você quer fazer?</SectionTitle>
            {app.data.goals.length ? (
              <div className="simple-form">
                <label>
                  Para que você quer guardar?
                  <select aria-label="Para que você quer guardar?" value={goalId} onChange={(event) => selectGoal(event.target.value)}>
                    {app.data.goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} · {formatMoney(goal.target)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="secondary" onClick={() => setCreating(true)}>
                  <Plus size={18} /> Criar objetivo
                </Button>
              </div>
            ) : (
              <div className="stack-sm">
                <p>Escolha algo importante para você. Vamos calcular quanto guardar por mês.</p>
                <Button onClick={() => setCreating(true)}>
                  <Plus size={18} /> Criar objetivo
                </Button>
              </div>
            )}
            {selectedGoal && (
              <div className="investment-plan-result">
                <span>Falta juntar para esse objetivo</span>
                <strong>{formatMoney(Math.max(0, selectedGoal.target - selectedGoal.saved))}</strong>
                <span className="muted">Data que você escolheu: {dateLabel(selectedGoal.deadline)}.</span>
              </div>
            )}
            <div className="investment-control-divider" />
            <SectionTitle>2. Quanto você consegue guardar por mês?</SectionTitle>
            {selectedGoal ? (
              <>
                <form
                  className="simple-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveContribution();
                  }}
                >
                  <label>
                    Quanto quer guardar por mês? (R$)
                    <input
                      inputMode="decimal"
                      value={monthlyInput}
                      onChange={(event) => {
                        setMonthlyInput(event.target.value);
                        setAdvice(null);
                      }}
                      aria-describedby="investment-monthly-saving-note"
                      aria-invalid={monthlyAmount === null}
                    />
                    <small id="investment-monthly-saving-note">Você pode mudar esse valor quando quiser.</small>
                  </label>
                  {monthlyAmount === null && (
                    <p className="muted" role="status">
                      Digite um valor para atualizar a conta.
                    </p>
                  )}
                  <Button type="submit" disabled={saving || monthlyAmount === null}>
                    <Check size={18} /> {saving ? 'Salvando…' : 'Salvar meu plano'}
                  </Button>
                </form>
                {projection && balanceWithoutReturns !== null ? (
                  <div className="investment-plan-result" aria-live="polite">
                    <span>Sem contar possíveis ganhos, você teria de guardar</span>
                    <strong>{formatMoney(projection.required)} por mês</strong>
                    <span>
                      Guardando esse valor, você juntaria cerca de {formatMoney(balanceWithoutReturns)} até lá.
                    </span>
                    <Badge tone={projection.feasible ? 'green' : 'orange'}>
                      {projection.feasible ? 'Esse valor cobre o que falta' : 'Talvez precise guardar mais ou mudar a data'}
                    </Badge>
                    <small className="muted">Somamos o que já está guardado ao valor mensal. Não incluímos possíveis ganhos, cobranças ou impostos.</small>
                  </div>
                ) : (
                  <p className="muted">A conta aparece quando você digitar um valor válido.</p>
                )}
              </>
            ) : (
              <p className="muted">Escolha ou crie um objetivo para ver seu plano mensal.</p>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="investment-control-divider" />
            <SectionTitle>3. Entenda o que combina com seu objetivo</SectionTitle>
            <p className="muted">Não existe resposta certa. Suas respostas mudam a orientação para este objetivo.</p>
            <div className="investment-question">
              <h3>Quando pretende usar esse dinheiro?</h3>
              <div className="investment-answer-options" role="group" aria-label="Quando pretende usar esse dinheiro?">
                {horizonChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="secondary"
                    aria-pressed={horizon === choice.id}
                    onClick={() => {
                      setHorizon(choice.id);
                      setAdvice(null);
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="investment-question">
              <h3>Pode precisar desse dinheiro antes?</h3>
              <div className="investment-answer-options" role="group" aria-label="Pode precisar desse dinheiro antes?">
                {earlyAccessChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="secondary"
                    aria-pressed={earlyAccess === choice.id}
                    onClick={() => {
                      setEarlyAccess(choice.id);
                      setAdvice(null);
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="investment-question">
              <h3>Se R$ 10.000 virassem R$ 8.500 por um tempo, o que faria?</h3>
              <div className="investment-answer-options" role="group" aria-label="O que faria se o valor caísse?">
                {lossResponseChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="secondary"
                    aria-pressed={lossResponse === choice.id}
                    onClick={() => {
                      setLossResponse(choice.id);
                      setAdvice(null);
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="investment-question">
              <h3>Como você se sente sobre investimentos?</h3>
              <div className="investment-answer-options" role="group" aria-label="Experiência com investimentos">
                {knowledgeChoices.map((choice) => (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="secondary"
                    aria-pressed={knowledge === choice.id}
                    onClick={() => {
                      setKnowledge(choice.id);
                      setAdvice(null);
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="button" disabled={!answersComplete} onClick={() => setMobileView('guidance')}>
              Ver minha orientação
            </Button>
            <small className="muted">Essas respostas valem para este objetivo e não substituem a análise de adequação da instituição.</small>
          </Card>
        </div>

        <div className="investment-guidance">
          <details className="investment-finances">
            <summary>Ver os números usados neste plano</summary>
            <div className="stack-sm">
              <Stat
                label="Dinheiro estimado depois das contas"
                value={summary.free}
                hint="Conta feita com o que você registrou. Pode faltar algum gasto ou entrada."
              />
              <Stat label="Dinheiro guardado para emergências" value={summary.reserve} hint="Contas que você marcou como reserva." />
              <Stat
                label="Renda menos contas fixas"
                value={declaredMonthlyRoom}
                hint="Ainda não desconta mercado, remédios e outros gastos do dia a dia."
              />
            </div>
            {summary.free <= 0 && (
              <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
                <AlertTriangle size={20} aria-hidden="true" />
                <p>Pelos dados que você anotou, hoje não aparece dinheiro livre. Não use a reserva nem o dinheiro separado para pagar contas.</p>
              </div>
            )}
            {monthlyAmount !== null && monthlyAmount > declaredMonthlyRoom && declaredMonthlyRoom > 0 && (
              <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
                <AlertTriangle size={20} aria-hidden="true" />
                <p>Esse valor é maior que a diferença entre sua renda e suas contas fixas. Confira também os outros gastos antes de decidir.</p>
              </div>
            )}
            <small className="muted">Esses números podem estar incompletos e não transferem dinheiro.</small>
          </details>

          <Card className="investment-guidance-card">
            <SectionTitle action={<Check size={20} aria-hidden="true" />}>Orientação para você</SectionTitle>
            {projection ? (
              <p>
                Para essa meta, o plano calcula que você precisa guardar <strong>{formatMoney(projection.required)} por mês</strong>,
                sem contar possíveis ganhos. Confira se esse valor cabe depois das suas contas.
              </p>
            ) : (
              <p>Preencha o valor mensal acima para ver quanto guardar. Confira se esse valor cabe depois das suas contas.</p>
            )}
            <div className="investment-personal-guidance" aria-live="polite">
              <h3>{direction.title}</h3>
              <p>{direction.summary}</p>
              <p>{direction.nextStep}</p>
              <a href={direction.source.url} target="_blank" rel="noreferrer">
                {direction.source.title}
              </a>
            </div>
            <small className="muted">
              O Nexo não vê as ofertas atuais do seu banco. Confira as condições diretamente antes de decidir.
            </small>

            <div className="investment-ai-section">
              <SectionTitle action={<TrendingUp size={20} aria-hidden="true" />}>Explicação da IA</SectionTitle>
              <p className="muted">A IA recebe suas respostas, objetivo, prazo e situação financeira registrada.</p>
              <Button onClick={() => void askNexo()} disabled={!selectedGoal || !answersComplete || asking}>
                <ArrowUpRight size={18} /> {asking ? 'Consultando informações…' : 'Explicar meu plano'}
              </Button>
              {!answersComplete && <small className="muted">Responda às quatro perguntas para liberar a explicação.</small>}
              {advice && (
                <div className="verified-answer" aria-live="polite" style={{ marginTop: 18 }}>
                  <p>{advice.answer}</p>
                  {advice.sources.length > 0 ? (
                    <div className="investment-source-list">
                      <strong>Informações consultadas</strong>
                      {advice.sources.map((source) => (
                        <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Ainda não encontramos informações confiáveis para orientar essa escolha.</p>
                  )}
                </div>
              )}
              <small className="muted">A IA não escolhe onde você vai investir, não movimenta dinheiro e não promete ganhos. Sua pergunta não fica salva.</small>
            </div>
          </Card>
        </div>
      </div>
      {creating && (
        <InvestmentGoalDialog
          onClose={() => setCreating(false)}
          onCreated={(goal) => {
            setGoalId(goal.id);
            setMonthlyInput('0,00');
            setCreating(false);
            setAdvice(null);
          }}
        />
      )}
    </>
  );
}