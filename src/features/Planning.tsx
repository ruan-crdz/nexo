import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, ArrowRight, Sprout, Download } from 'lucide-react';
import { useApp } from '../data/context';
import {
  adaptiveReserve,
  canSpend,
  civilDate,
  compound,
  debtPayoff,
  formatMoney,
  inflationAdjusted,
  parseMoney,
  shiftMonths,
  sum,
} from '../../shared/financial-engine';
import { monthlyFlow, personalSummary } from '../../shared/insights';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  SectionTitle,
  Stat,
  Why,
} from '../design-system/components';
import { Editor } from './Editor';
import { ResourcePage, download } from './Resources';
import { TrendChart } from './Home';
import type { Budget } from '../../shared/domain';

export function JourneyPage() {
  const { data } = useApp(),
    s = personalSummary(data);
  const reserve = adaptiveReserve(
    s.expensesBaseline,
    data.profile.variable_income,
    data.profile.dependents,
    data.profile.insured,
  );
  return (
    <>
      <PageHeader
        eyebrow="Jornada Nexo"
        title="Você tem uma direção."
        description="Progresso financeiro é construir possibilidades, no seu ritmo."
      />
      <div className="grid grid-2">
        <div className="stack">
          <Card className="journey-card">
            <div className="journey-header">
              <Sprout size={16} />
              Seu próximo marco
            </div>
            <h2>{s.milestone.title}</h2>
            <p>{s.milestone.action}</p>
            <Link className="button button-primary" to="/metas">
              Organizar minhas metas
              <ArrowRight size={15} />
            </Link>
          </Card>
          <Card>
            <SectionTitle>Reserva adaptada à sua vida</SectionTitle>
            <div className="stack">
              <Stat label="Primeiro colchão · 1 mês" value={reserve.minimum} />
              <Stat label={`Confortável · ${reserve.months} meses`} value={reserve.comfortable} />
              <Stat label={`Robusta · ${reserve.months + 3} meses`} value={reserve.robust} />
            </div>
            <Why>
              <p>{reserve.rationale}</p>
              <p>
                Despesas base: {formatMoney(s.expensesBaseline)}. Renda{' '}
                {data.profile.variable_income ? 'variável' : 'estável'}, {data.profile.dependents}{' '}
                dependente(s), proteção {data.profile.insured ? 'informada' : 'não informada'}.
              </p>
              <p>
                Essas faixas são parâmetros de planejamento, não regra universal. Ajuste o perfil conforme sua
                realidade.
              </p>
            </Why>
          </Card>
        </div>
        <Card>
          <SectionTitle action={<Badge tone="green">Versão {s.score.version}</Badge>}>
            Nexo Score
          </SectionTitle>
          <strong className="large-number">
            {s.score.overall ?? '—'} <small className="muted">/ 100</small>
          </strong>
          <p className="muted" style={{ margin: '10px 0 20px', fontSize: 12 }}>
            Cobertura de dados: {s.score.dataCoverage}%. {s.score.disclaimer}
          </p>
          {s.score.dimensions.map((d) => (
            <div className="score-dimension" key={d.name}>
              <span>{d.name}</span>
              <Progress value={d.value ?? 0} label={d.name} />
              <strong>{d.value === null ? '—' : Math.round(d.value)}</strong>
            </div>
          ))}
          <Why title="Diagnóstico, motivo e ação">
            <p>
              Seu ponto de atenção é {s.score.attention?.name.toLowerCase()}. Essa é a menor dimensão
              conhecida no indicador atual.
            </p>
            <p>{s.score.attention?.action}</p>
            <p>
              Pesos: liquidez 15, dívidas 15, comprometimento 10, reserva 20, consistência 5, evolução 10,
              poupança 15 e metas 10. Dimensões sem base de cálculo ficam fora da média; não recebem nota
              zero.
            </p>
            <p>
              Estabilidade influencia a reserva esperada. Sem histórico patrimonial confiável, a evolução não
              é pontuada.
            </p>
          </Why>
        </Card>
      </div>
    </>
  );
}
export function BudgetPage({ business = false }: { business?: boolean }) {
  const app = useApp(),
    [editing, setEditing] = useState<Budget | null | undefined>(undefined),
    [month, setMonth] = useState(civilDate().slice(0, 7));
  const entity = business ? 'business_budgets' : 'budgets';
  const transactions = business ? app.data.business_transactions : app.data.transactions;
  return (
    <>
      <PageHeader
        eyebrow={business ? 'Orçamento por área' : 'Orçamento'}
        title="Espaço para o que importa."
        description="Planeje limites possíveis e ajuste quando sua vida mudar."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} />
            Planejar categoria
          </Button>
        }
      />
      <div className="toolbar">
        <label>
          Mês
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      <Card>
        {app.data[entity]
          .filter((b) => b.month === month)
          .map((b) => {
            const actual = sum(
              transactions
                .filter(
                  (t) =>
                    t.category === b.category &&
                    t.type === 'expense' &&
                    t.status === 'paid' &&
                    t.date.startsWith(month),
                )
                .map((t) => t.amount),
            );
            const planned = sum(
              transactions
                .filter(
                  (t) =>
                    t.category === b.category &&
                    t.type === 'expense' &&
                    t.status === 'planned' &&
                    t.date.startsWith(month),
                )
                .map((t) => t.amount),
            );
            return (
              <div key={b.id} className="budget-item">
                <SectionTitle
                  action={
                    <Button
                      variant="ghost"
                      aria-label={`Editar orçamento ${b.category}`}
                      onClick={() => setEditing(b)}
                    >
                      <Pencil size={15} />
                    </Button>
                  }
                >
                  {b.category}
                </SectionTitle>
                <div className="goal-meta">
                  <span>
                    Realizado: <strong>{formatMoney(actual)}</strong>
                  </span>
                  <span>Planejado: {formatMoney(b.limit_amount)}</span>
                </div>
                <Progress
                  value={b.limit_amount ? (actual / b.limit_amount) * 100 : actual ? 100 : 0}
                  label={b.category}
                />
                <div className="goal-meta">
                  <span>
                    {actual > b.limit_amount
                      ? `${formatMoney(actual - b.limit_amount)} acima do planejado`
                      : `${formatMoney(b.limit_amount - actual)} de espaço`}
                  </span>
                  <span>Previsto adicional: {formatMoney(planned)}</span>
                </div>
              </div>
            );
          })}
        {!app.data[entity].some((b) => b.month === month) && (
          <p className="muted">
            Ainda não há orçamento para este mês. Comece com uma categoria que faz parte da sua rotina.
          </p>
        )}
      </Card>
      {editing !== undefined &&
        (business ? (
          <Editor
            entity="business_budgets"
            initial={editing ?? undefined}
            onClose={() => setEditing(undefined)}
          />
        ) : (
          <Editor entity="budgets" initial={editing ?? undefined} onClose={() => setEditing(undefined)} />
        ))}
    </>
  );
}
export function FuturePage() {
  const { data } = useApp(),
    s = personalSummary(data),
    [amount, setAmount] = useState('420,00'),
    [error, setError] = useState(''),
    [result, setResult] = useState<ReturnType<typeof canSpend> | null>(null),
    [contribution, setContribution] = useState(
      Math.max(0, data.profile.monthly_income - data.profile.fixed_expenses),
    ),
    [months, setMonths] = useState(24),
    [rate, setRate] = useState(0),
    [inflation, setInflation] = useState(450);
  const points = compound(Math.max(0, s.balance), contribution, rate, months),
    last = points[points.length - 1];
  const chart = points
    .filter((_, i) => i === 0 || i === months || i % Math.max(1, Math.floor(months / 8)) === 0)
    .map((p) => ({ label: `${p.month}m`, value: p.balance }));
  function simulate() {
    try {
      setResult(
        canSpend({
          amount: parseMoney(amount),
          cash: Math.max(0, s.balance),
          expectedIncome: s.expectedIncome,
          upcomingBills: s.upcomingBills,
          protectedReserve: s.reserve,
          goalAllocation: s.goalAllocation,
          monthlySavings: Math.max(0, data.profile.monthly_income - data.profile.fixed_expenses),
        }),
      );
      setError('');
    } catch {
      setError('Informe um valor positivo, como 420,00.');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Futuro se…"
        title="Experimente antes de decidir."
        description="Mude as premissas. Veja as possibilidades. Escolha com clareza."
      />
      <div className="grid grid-2">
        <Card>
          <SectionTitle>Posso gastar?</SectionTitle>
          <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
            Uma compra hoje pode mudar o espaço das suas próximas semanas.
          </p>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              simulate();
            }}
          >
            <label>
              Valor da compra (R$)
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <Button type="submit">Simular</Button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {result && (
            <div className="result-panel" style={{ marginTop: 24 }}>
              <Badge tone={result.affordable ? 'green' : 'orange'}>
                {result.affordable ? 'Cabe nas premissas informadas' : 'Melhor rever o momento'}
              </Badge>
              <h3 style={{ marginTop: 15 }}>Depois desta compra: {formatMoney(result.after)}</h3>
              <p>
                {result.affordable
                  ? 'Há espaço após proteger reserva, contas e aportes.'
                  : 'O saldo livre ficaria negativo após proteger seus compromissos.'}
              </p>
              <p>
                {result.goalDelayDays === null
                  ? 'Sem poupança mensal positiva, não é possível estimar o prazo.'
                  : `Se esse valor fosse direcionado à meta, representaria aproximadamente ${result.goalDelayDays} dias de aportes.`}
              </p>
              <Why>
                <p>Valor livre antes da compra: {formatMoney(result.free)}.</p>
                <ul>
                  {result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p>O prazo acima é custo de oportunidade, não previsão de atraso obrigatório.</p>
              </Why>
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle>Se eu continuar nessa direção…</SectionTitle>
          <div className="stack">
            <label className="range-row">
              <span>
                Aporte por mês<strong>{formatMoney(contribution)}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1_000_000, data.profile.monthly_income * 2)}
                step={5000}
                value={contribution}
                onChange={(e) => setContribution(Number(e.target.value))}
              />
            </label>
            <label className="range-row">
              <span>
                Horizonte<strong>{months} meses</strong>
              </span>
              <input
                type="range"
                min={6}
                max={120}
                step={6}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              />
            </label>
            <label className="range-row">
              <span>
                Retorno mensal hipotético<strong>{(rate / 100).toFixed(2)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </label>
            <label className="range-row">
              <span>
                Inflação anual hipotética<strong>{(inflation / 100).toFixed(2)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={1500}
                step={25}
                value={inflation}
                onChange={(e) => setInflation(Number(e.target.value))}
              />
            </label>
          </div>
          <TrendChart data={chart} />
          <Stat label="Saldo nominal projetado" value={last.balance} accent />
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            Poder de compra estimado após {Math.floor(months / 12)} anos completos:{' '}
            {formatMoney(inflationAdjusted(last.balance, inflation, Math.floor(months / 12)))}.
          </p>
          <Why>
            <p>
              Juros compostos com arredondamento a centavos a cada mês e aportes no fim do mês. Saldo inicial:{' '}
              {formatMoney(Math.max(0, s.balance))}.
            </p>
            <p>
              Simulação educacional, sem impostos, tarifas ou oscilação de mercado. As taxas são hipóteses
              suas, não promessa de retorno.
            </p>
          </Why>
        </Card>
      </div>
    </>
  );
}
export function DebtsPage() {
  const { data } = useApp(),
    [budget, setBudget] = useState(String(sum(data.debts.map((d) => d.minimum)) / 100).replace('.', ','));
  let avalanche: ReturnType<typeof debtPayoff> | null = null,
    snowball: ReturnType<typeof debtPayoff> | null = null,
    error = '';
  try {
    const debts = data.debts.map((d) => ({
      id: d.id,
      balance: d.balance,
      rateBps: d.rate_bps,
      minimum: d.minimum,
    }));
    avalanche = debtPayoff(debts, parseMoney(budget), 'avalanche');
    snowball = debtPayoff(debts, parseMoney(budget), 'snowball');
  } catch {
    error = 'Informe um orçamento mensal válido.';
  }
  return (
    <>
      <ResourcePage
        entity="debts"
        title="Mais espaço para recomeçar."
        description="Entenda suas dívidas e escolha uma estratégia possível."
      />
      <Card className="bottom-space">
        <SectionTitle>Compare caminhos de quitação</SectionTitle>
        <label>
          Quanto pode pagar por mês (R$)
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        {error ? (
          <p className="error-message">{error}</p>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 24 }}>
            {[
              { title: 'Avalanche', result: avalanche, explanation: 'Prioriza a maior taxa de juros.' },
              { title: 'Bola de neve', result: snowball, explanation: 'Prioriza o menor saldo devedor.' },
            ].map(({ title, result, explanation }) => (
              <div key={title} className="result-panel">
                <h3>{title}</h3>
                <p>{explanation}</p>
                <strong style={{ fontSize: 24 }}>
                  {result?.possible ? `${result.months} meses` : 'Revise o pagamento'}
                </strong>
                <p>
                  {result?.possible
                    ? `Juros estimados: ${formatMoney(result.interestTotal)}`
                    : result?.reason}
                </p>
              </div>
            ))}
          </div>
        )}
        <Why>
          <p>
            Juros mensais sobre saldo aberto; parcelas mínimas primeiro, excedente conforme estratégia.
            Orçamento constante até quitar. Não inclui multa, IOF, tarifas ou mudanças contratuais. Negocie
            condições com o credor antes de substituir contratos.
          </p>
        </Why>
      </Card>
    </>
  );
}
export function WealthPage() {
  const { data } = useApp(),
    s = personalSummary(data);
  return (
    <>
      <PageHeader
        eyebrow="Patrimônio"
        title="Sua vida financeira, por inteiro."
        description="Patrimônio líquido é tudo o que você tem menos tudo o que deve."
      />
      <div className="metric-grid bottom-space">
        <Card>
          <Stat label="Contas e saldos" value={s.balance} />
        </Card>
        <Card>
          <Stat label="Dívidas cadastradas" value={s.debts} />
        </Card>
        <Card>
          <Stat label="Patrimônio líquido estimado" value={s.netWorth} accent />
        </Card>
      </div>
      <ResourcePage
        entity="assets"
        title="Seus bens e investimentos"
        description="Cadastre apenas valores que ainda não estão incluídos nas suas contas."
      />
    </>
  );
}
export function ReportsPage() {
  const { data } = useApp(),
    today = civilDate(),
    s = personalSummary(data);
  const history = Array.from({ length: 6 }, (_, i) => {
    const month = shiftMonths(today, i - 5).slice(0, 7);
    return { month, ...monthlyFlow(data.transactions, month) };
  });
  const current = history.at(-1)!,
    previous = history.at(-2)!;
  return (
    <>
      <PageHeader
        eyebrow="Relatórios"
        title="Olhe para o caminho percorrido."
        description="Compare seus registros sem perder de vista o contexto."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              download(
                'nexo-relatorio.json',
                JSON.stringify(
                  {
                    generated_at: new Date().toISOString(),
                    history,
                    summary: { balance: s.balance, netWorth: s.netWorth },
                  },
                  null,
                  2,
                ),
              )
            }
          >
            <Download size={16} />
            Exportar relatório
          </Button>
        }
      />
      <Card className="bottom-space">
        <SectionTitle>O que mudou?</SectionTitle>
        <p>
          {current.count >= 5 && previous.count >= 5
            ? `O resultado registrado neste mês está ${formatMoney(Math.abs(current.net - previous.net))} ${current.net >= previous.net ? 'acima' : 'abaixo'} do mês anterior.`
            : 'Ainda precisamos de pelo menos cinco registros em cada período para uma comparação útil.'}
        </p>
        <Why>
          Compara resultado de entradas menos saídas registradas. Um mês em andamento não é diretamente
          comparável a um mês completo; isto não indica tendência estatística.
        </Why>
      </Card>
      <Card>
        <SectionTitle>Fluxo mensal registrado</SectionTitle>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Resultado</th>
                <th>Taxa de poupança</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{formatMoney(m.income)}</td>
                  <td>{formatMoney(m.expenses)}</td>
                  <td>{formatMoney(m.net)}</td>
                  <td>{m.savingsRate === null ? 'Sem renda registrada' : `${m.savingsRate.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
