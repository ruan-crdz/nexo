import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  ExternalLink,
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
type AdviceReply = {
  answer: string;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
};

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
        question: `Explique de forma simples o que a pessoa deve conferir antes de escolher onde guardar dinheiro para "${selectedGoal.name}". Ela planeja usar esse dinheiro daqui a ${months} meses e disse: "${riskLabel}". Não recomende produtos, bancos, ações ou fundos. Não prometa ganhos. Use apenas informações de fontes confiáveis da base e diga se não encontrar informação suficiente.`,
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
      <div className="investment-grid">
        <div className="stack">
          <Card>
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
          </Card>

          <Card>
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
                      onChange={(event) => setMonthlyInput(event.target.value)}
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
          </Card>

          <Card>
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

        <div className="stack">
          <Card>
            <SectionTitle>Seu dinheiro hoje</SectionTitle>
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
          </Card>

          <Card>
            <SectionTitle action={<Check size={20} aria-hidden="true" />}>Seu próximo passo</SectionTitle>
            {projection ? (
              <p>
                Para essa meta, o plano calcula que você precisa guardar <strong>{formatMoney(projection.required)} por mês</strong>,
                sem contar possíveis ganhos. Confira se esse valor cabe depois das suas contas.
              </p>
            ) : (
              <p>Preencha o valor mensal acima para ver quanto guardar. Confira se esse valor cabe depois das suas contas.</p>
            )}
            <ol className="investment-next-steps">
              <li>
                <strong>Quando guardar:</strong> escolha um dia depois que receber e separar o dinheiro das contas. Não use
                a reserva nem o dinheiro de que vai precisar em breve.
              </li>
              <li>
                <strong>Onde procurar:</strong> no app do seu banco ou corretora, abra “Investimentos”. Para conhecer
                títulos públicos, consulte o simulador oficial do Tesouro Direto.
              </li>
              <li>
                <strong>Como escolher:</strong> informe seu objetivo e a data em que vai precisar do dinheiro. Antes de
                confirmar, confira quando pode retirar, quanto paga em taxas e impostos e se pode perder dinheiro.
              </li>
            </ol>
            <a
              className="button button-secondary"
              href="https://www.tesourodireto.com.br/simuladores/meu-titulo-ideal"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={18} /> Ver opções no simulador oficial
            </a>
            <small className="muted">
              Esse simulador mostra títulos do Tesouro Direto, não compara todos os bancos. O Nexo não vê as ofertas nem
              os preços atuais da sua instituição.
            </small>
          </Card>

          <Card>
            <SectionTitle action={<TrendingUp size={20} aria-hidden="true" />}>Entenda antes de decidir</SectionTitle>
            <p className="muted">
              Peça uma explicação sobre o tempo e as mudanças no valor. O Nexo usa informações de fontes confiáveis; se não encontrar uma boa resposta, vai dizer.
            </p>
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
          </Card>

          <Card>
            <SectionTitle action={<BookOpen size={20} aria-hidden="true" />}>Onde saber mais</SectionTitle>
            <div className="investment-source-list">
              <a href="https://www.gov.br/investidor/pt-br/investir" target="_blank" rel="noreferrer">
                Portal do Investidor: dicas antes de investir
              </a>
              <a href="https://www.tesourodireto.com.br/conheca/conheca-o-tesouro-direto.htm" target="_blank" rel="noreferrer">
                Tesouro Direto: como funciona
              </a>
              <a href="https://www.tesourodireto.com.br/titulos/tipos-de-tesouro.htm" target="_blank" rel="noreferrer">
                Tesouro Direto: opções disponíveis
              </a>
            </div>
            <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
              <ShieldCheck size={20} aria-hidden="true" />
              <p>Antes de investir, confira quando pode retirar o dinheiro, quanto pode pagar em taxas e impostos e se existe alguma proteção contra perdas.</p>
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