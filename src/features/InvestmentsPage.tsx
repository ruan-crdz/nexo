import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, Check, Plus, ShieldCheck, Target, TrendingUp } from 'lucide-react';
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
    label: 'Prefiro pouca oscilação',
    detail: 'Prioriza previsibilidade e acesso ao dinheiro, mas pode avançar mais devagar. Ainda existe risco e o retorno não é garantido.',
  },
  {
    id: 'balanced',
    label: 'Aceito alguma oscilação',
    detail: 'Entendo que o valor pode subir ou cair no caminho e quero equilibrar objetivos e prazo.',
  },
  {
    id: 'growth',
    label: 'Aceito grandes oscilações',
    detail: 'Aceito quedas importantes e a possibilidade de perder dinheiro. Um prazo curto pode não dar tempo para recuperar.',
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
      app.toast('Meta criada. Agora você pode planejar o aporte.');
    } catch {
      setError('Confira o nome, os valores e a data da sua meta.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="Criar meta de investimento" onClose={() => !pending && onClose()}>
      <form className="simple-form" onSubmit={(event) => void save(event)}>
        <fieldset className="simple-form" disabled={pending}>
          <label>
            Nome da meta
            <input
              autoFocus
              data-dialog-autofocus
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: completar minha reserva"
              required
            />
          </label>
          <label>
            Valor que quer alcançar (R$)
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
            Data desejada
            <input type="date" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
          </label>
          <p className="muted">A data é um plano ajustável. Não representa prazo ou rendimento garantido.</p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <Check size={18} />
            {pending ? 'Salvando…' : 'Salvar meta'}
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
      setNotice('Aporte mensal salvo como planejamento. Nenhum dinheiro foi movimentado.');
    } catch {
      setError('Não foi possível salvar. Confira o valor do aporte e tente novamente.');
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
            'Na demonstração não consultamos a IA. Em uma conta real, o Nexo só explica o que encontrar em fontes verificadas; não indica um ativo nem garante rendimento.',
          sources: [],
          evidence_status: 'demo',
        });
        return;
      }
      const response = await invoke<AdviceReply>('ai-chat', {
        question: `Explique em português muito simples quais perguntas uma pessoa deve fazer antes de investir para o objetivo "${selectedGoal.name}". O prazo informado é de ${months} meses e a preferência declarada é "${riskLabel}". Não indique produtos, ativos ou instituições, não estime rendimentos e explique que a resposta depende apenas de fontes verificadas na base.`,
        save_history: false,
      });
      setAdvice(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar as evidências agora.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Seu dinheiro no futuro"
        title="Investir sem complicar"
        description="Escolha um objetivo. Veja um plano claro, sem promessa de rendimento."
        action={<Badge>Simulação educativa</Badge>}
      />
      <div className="investment-grid">
        <div className="stack">
          <Card>
            <SectionTitle action={<Target size={20} aria-hidden="true" />}>1. Escolha seu objetivo</SectionTitle>
            {app.data.goals.length ? (
              <div className="simple-form">
                <label>
                  Meta para este plano
                  <select aria-label="Meta para este plano" value={goalId} onChange={(event) => selectGoal(event.target.value)}>
                    {app.data.goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} · {formatMoney(goal.target)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="secondary" onClick={() => setCreating(true)}>
                  <Plus size={18} /> Criar meta de investimento
                </Button>
              </div>
            ) : (
              <div className="stack-sm">
                <p>Uma meta dá um destino ao dinheiro. Você pode começar com algo importante para você.</p>
                <Button onClick={() => setCreating(true)}>
                  <Plus size={18} /> Criar meta de investimento
                </Button>
              </div>
            )}
            {selectedGoal && (
              <div className="investment-plan-result">
                <span>Faltam para essa meta</span>
                <strong>{formatMoney(Math.max(0, selectedGoal.target - selectedGoal.saved))}</strong>
                <span className="muted">Data que você escolheu: {dateLabel(selectedGoal.deadline)}.</span>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>2. Quanto cabe no seu plano?</SectionTitle>
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
                    Aporte mensal (R$)
                    <input
                      inputMode="decimal"
                      value={monthlyInput}
                      onChange={(event) => setMonthlyInput(event.target.value)}
                      aria-describedby="investment-aporte-note"
                      aria-invalid={monthlyAmount === null}
                    />
                    <small id="investment-aporte-note">Um valor que você pode ajustar a qualquer momento.</small>
                  </label>
                  {monthlyAmount === null && (
                    <p className="muted" role="status">
                      Digite um valor válido para atualizar a simulação.
                    </p>
                  )}
                  <Button type="submit" disabled={saving || monthlyAmount === null}>
                    <Check size={18} /> {saving ? 'Salvando…' : 'Salvar aporte nesta meta'}
                  </Button>
                </form>
                {projection && balanceWithoutReturns !== null ? (
                  <div className="investment-plan-result" aria-live="polite">
                    <span>Para chegar na data escolhida, sem contar rendimento</span>
                    <strong>{formatMoney(projection.required)} por mês</strong>
                    <span>
                      Com o aporte informado, o plano acumularia cerca de {formatMoney(balanceWithoutReturns)} até lá.
                    </span>
                    <Badge tone={projection.feasible ? 'green' : 'orange'}>
                      {projection.feasible ? 'Aporte suficiente pelas contribuições' : 'Prazo ou aporte precisa de ajuste'}
                    </Badge>
                    <small className="muted">A conta considera apenas o valor guardado e os aportes, sem juros, taxas ou impostos.</small>
                  </div>
                ) : (
                  <p className="muted">A projeção aparece quando o aporte informado for válido.</p>
                )}
              </>
            ) : (
              <p className="muted">Crie ou escolha uma meta para ver o plano mensal.</p>
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
            <SectionTitle action={<ShieldCheck size={20} aria-hidden="true" />}>3. Como você se sente com oscilações?</SectionTitle>
            <p className="muted">Isso registra sua preferência; não é um teste de perfil nem uma recomendação de investimento.</p>
            <div className="investment-risk-options" role="group" aria-label="Preferência por oscilação">
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
                Um valor que pode cair no curto prazo pode não combinar com uma conta próxima ou com uma meta com data apertada.
                A instituição financeira deve avaliar se cada produto combina com você antes da aplicação.
              </p>
            </Why>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <SectionTitle>Seu momento, com os dados registrados</SectionTitle>
            <div className="stack-sm">
              <Stat
                label="Saldo livre estimado hoje"
                value={summary.free}
                hint="Após contas próximas, reserva e aportes de outras metas registrados."
              />
              <Stat label="Reserva registrada" value={summary.reserve} hint="Contas marcadas como poupança no Nexo." />
              <Stat
                label="Diferença informada no mês"
                value={declaredMonthlyRoom}
                hint="Renda menos despesas fixas cadastradas; ainda faltam gastos variáveis e imprevistos."
              />
            </div>
            {summary.free <= 0 && (
              <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
                <AlertTriangle size={20} aria-hidden="true" />
                <p>Os registros de hoje não mostram saldo livre. Não conte com a reserva ou com dinheiro comprometido para fazer aportes.</p>
              </div>
            )}
            {monthlyAmount !== null && monthlyAmount > declaredMonthlyRoom && declaredMonthlyRoom > 0 && (
              <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
                <AlertTriangle size={20} aria-hidden="true" />
                <p>O aporte informado supera a diferença entre renda e despesas fixas registradas. Confira os gastos variáveis antes de decidir.</p>
              </div>
            )}
            <small className="muted">Os registros podem estar incompletos. Esta comparação não autoriza transferências.</small>
          </Card>

          <Card>
            <SectionTitle action={<TrendingUp size={20} aria-hidden="true" />}>Uma explicação com evidências</SectionTitle>
            <p className="muted">
              O Nexo pode explicar perguntas sobre prazo e oscilação usando a base verificada. Se ela não sustentar uma resposta, ele vai dizer isso.
            </p>
            <Button onClick={() => void askNexo()} disabled={!selectedGoal || asking}>
              <ArrowUpRight size={18} /> {asking ? 'Conferindo fontes…' : 'Pedir explicação ao Nexo'}
            </Button>
            {advice && (
              <div className="verified-answer" aria-live="polite" style={{ marginTop: 18 }}>
                <p>{advice.answer}</p>
                {advice.sources.length > 0 ? (
                  <div className="investment-source-list">
                    <strong>Fontes usadas</strong>
                    {advice.sources.map((source) => (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                        {source.title} · evidência {source.level}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Sem fontes verificadas para esta pergunta, não há recomendação específica.</p>
                )}
              </div>
            )}
            <small className="muted">A IA não escolhe ativos, movimenta dinheiro nem prevê rendimento. O histórico desta pergunta não é salvo.</small>
          </Card>

          <Card>
            <SectionTitle action={<BookOpen size={20} aria-hidden="true" />}>Fontes oficiais para conferir</SectionTitle>
            <div className="investment-source-list">
              <a href="https://www.gov.br/investidor/pt-br/investir" target="_blank" rel="noreferrer">
                Portal do Investidor da CVM: antes de investir
              </a>
              <a href="https://www.tesourodireto.com.br/conheca/conheca-o-tesouro-direto.htm" target="_blank" rel="noreferrer">
                Tesouro Direto: conheça o programa e seus títulos
              </a>
              <a href="https://www.tesourodireto.com.br/titulos/tipos-de-tesouro.htm" target="_blank" rel="noreferrer">
                Tesouro Direto: tipos de título
              </a>
            </div>
            <div className="investment-callout" role="note" style={{ marginTop: 18 }}>
              <ShieldCheck size={20} aria-hidden="true" />
              <p>Antes de aplicar, confira prazo de resgate, custos, impostos, risco de venda antecipada e garantias aplicáveis ao produto.</p>
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