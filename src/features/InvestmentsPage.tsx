import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Badge, Button, Card, Dialog, PageHeader, SectionTitle, Stat, Why } from '../design-system/components';
import { goalSchema } from '../../shared/domain';
import type { Goal } from '../../shared/domain';
import { civilDate, formatMoney, goalPlan, parseMoney, shiftMonths } from '../../shared/financial-engine';
import { personalSummary } from '../../shared/insights';

type RiskPreference = 'steady' | 'balanced' | 'growth';
type MobileView = 'plan' | 'guidance';
type AdviceReply = {
  answer: string;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
};
type Direction = { title: string; summary: string; nextStep: string; source: { title: string; url: string } };

const riskChoices: { id: RiskPreference; label: string; detail: string }[] = [
  {
    id: 'steady',
    label: 'Quero que o valor mude pouco',
    detail: 'Quero poder retirar o dinheiro quando precisar. Mesmo assim, posso perder uma parte.',
  },
  {
    id: 'balanced',
    label: 'Tudo bem se o valor mudar um pouco',
    detail: 'Se o valor cair, posso esperar para tentar recuperar. Isso pode não acontecer.',
  },
  {
    id: 'growth',
    label: 'Aceito que o valor mude bastante',
    detail: 'O valor pode cair muito. Mesmo esperando, posso perder parte do dinheiro.',
  },
];

function directionFor(risk: RiskPreference, months: number): Direction {
  if (risk === 'growth' && months <= 24)
    return {
      title: 'Sua escolha e o prazo não combinam bem',
      summary:
        'Você aceita grandes mudanças no valor, mas planeja usar esse dinheiro em pouco tempo. Se ele cair, talvez não se recupere até a data.',
      nextStep:
        'Para este objetivo, compare opções com pouca mudança no valor. Deixe as opções que podem cair bastante para um objetivo distante, com dinheiro que você pode deixar investido.',
      source: {
        title: 'CVM: entenda os riscos antes de investir',
        url: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir',
      },
    };
  if (risk === 'growth')
    return {
      title: 'Você aceita grandes mudanças no valor',
      summary:
        'Com um prazo maior, você pode estudar opções que sobem e descem bastante. Ainda assim, pode perder dinheiro e não há garantia de recuperação.',
      nextStep:
        'Antes de escolher, aprenda como funcionam investimentos variados e não coloque todo o dinheiro em uma única opção. Não use dinheiro de contas ou da reserva.',
      source: {
        title: 'CVM: conheça diferentes tipos de investimento',
        url: 'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos',
      },
    };
  if (risk === 'balanced')
    return {
      title: 'Você aceita algumas mudanças no valor',
      summary:
        'Seu plano pode comparar opções mais estáveis com outras que podem crescer mais, mas também cair. O prazo e o dinheiro que você pode deixar parado importam.',
      nextStep:
        'Compare as regras, os custos e quando pode retirar. Evite escolher só pelo ganho anunciado; entenda primeiro o que pode acontecer se o valor cair.',
      source: {
        title: 'CVM: compare tipos e riscos de investimento',
        url: 'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos',
      },
    };
  return {
    title: 'Você prefere que o valor mude pouco',
    summary:
      'Seu plano prioriza previsibilidade e acesso ao dinheiro. Isso pode significar ganhos menores; ainda assim, confira as regras e riscos de cada opção.',
    nextStep:
      'Comece comparando opções com pouca mudança no valor e veja se consegue retirar quando precisar. O simulador abaixo apresenta títulos públicos, mas não compara todos os bancos.',
    source: {
      title: 'Tesouro Direto: simulador de objetivos',
      url: 'https://www.tesourodireto.com.br/simuladores/meu-titulo-ideal',
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
  const [risk, setRisk] = useState<RiskPreference>('steady');
  const [mobileView, setMobileView] = useState<MobileView>('plan');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advice, setAdvice] = useState<AdviceReply | null>(null);
  const selectedGoal = app.data.goals.find((goal) => goal.id === goalId);
  const riskLabel = riskChoices.find((choice) => choice.id === risk)?.label ?? riskChoices[0].label;
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
  const direction = directionFor(risk, months);

  function selectGoal(id: string) {
    setGoalId(id);
    const next = app.data.goals.find((goal) => goal.id === id);
    setMonthlyInput(((next?.monthly_contribution ?? 0) / 100).toFixed(2).replace('.', ','));
    setNotice('');
    setAdvice(null);
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
    if (!selectedGoal || asking) return;
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
        question: `Explique de forma curta e realmente ligada a esta pessoa, não dê uma resposta padrão. Objetivo: "${selectedGoal.name}"; valor desejado: ${formatMoney(selectedGoal.target)}; já guardado: ${formatMoney(selectedGoal.saved)}; quanto pretende guardar por mês: ${monthlyAmount === null ? 'ainda não informado' : formatMoney(monthlyAmount)}; prazo: ${months} meses; preferência escolhida exatamente: "${riskLabel}". Registros financeiros: dinheiro depois das contas ${formatMoney(summary.free)}, reserva ${formatMoney(summary.reserve)}, dívidas ${formatMoney(summary.debts)}. Primeiro explique se a preferência combina com o prazo e objetivo; adapte explicitamente a resposta se a pessoa aceita grandes variações. Não escolha Tesouro Direto como resposta padrão, nem indique que compre um produto, banco, ação ou fundo. Se não houver fonte confiável suficiente para dizer onde, diga isso claramente e explique o que comparar. Não prometa ganhos.`,
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
            <SectionTitle action={<ShieldCheck size={20} aria-hidden="true" />}>3. Quanto você aceita que o valor mude?</SectionTitle>
            <p className="muted">Escolha o que deixa você mais confortável. Nenhuma opção elimina o risco ou garante ganhos.</p>
            <div className="investment-risk-options" role="group" aria-label="Quanto você aceita que o valor mude?">
              {riskChoices.map((choice) => (
                <Button
                  key={choice.id}
                  type="button"
                  variant="secondary"
                  className="investment-risk-option"
                  aria-pressed={risk === choice.id}
                  onClick={() => {
                    setRisk(choice.id);
                    setAdvice(null);
                    setMobileView('guidance');
                  }}
                >
                  <span>{choice.label}</span>
                  <small>{choice.detail}</small>
                </Button>
              ))}
            </div>
            <Why title="Por que isso importa?">
              <p>
                Se você precisar do dinheiro em breve, talvez tenha de retirar por menos do que colocou. O lugar onde você investir deve explicar os riscos antes da escolha.
              </p>
            </Why>
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
              <p className="muted">A explicação considera seu objetivo, prazo, valor mensal e preferência.</p>
            <Button onClick={() => void askNexo()} disabled={!selectedGoal || asking}>
              <ArrowUpRight size={18} /> {asking ? 'Consultando informações…' : 'Explicar meu plano'}
            </Button>
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