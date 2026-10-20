import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Sprout,
  MessageCircle,
  ShoppingBag,
  Coffee,
  Home as HomeIcon,
  Bus,
  ArrowDownLeft,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../data/context';
import { personalSummary, monthlyFlow, weeklyPlan } from '../../shared/insights';
import { recurringTransactions } from '../../shared/planning';
import { civilDate, formatMoney, shiftDays, shiftMonths, sum } from '../../shared/financial-engine';
import { Card, Stat, SectionTitle, Badge, Progress, Why, Button } from '../design-system/components';
import { Editor } from './Editor';
import type { Dataset, Transaction } from '../../shared/domain';

export function TrendChart({
  data,
  second = false,
  valueName,
}: {
  data: { label: string; value: number; expenses?: number }[];
  second?: boolean;
  valueName?: string;
}) {
  const gradientId = useId();
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Evolução: ${data.map((d) => `${d.label}: ${formatMoney(d.value)}${second ? `, saídas ${formatMoney(d.expenses ?? 0)}` : ''}`).join('; ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 8, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64715A" stopOpacity={0.13} />
              <stop offset="100%" stopColor="#64715A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5e1d5" strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#706e64' }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: '#706e64' }}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(v / 100)
            }
          />
          <Tooltip
            formatter={(v) => formatMoney(Number(v))}
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e1d5', fontSize: 12 }}
          />
          {second && (
            <Area
              type="monotone"
              dataKey="expenses"
              name="Saídas"
              stroke="#b8ae95"
              fill="#e8e0cd"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            name={valueName ?? (second ? 'Entradas' : 'Saldo projetado')}
            stroke="#64715a"
            fill={`url(#${gradientId})`}
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function projectFreeCash(data: Dataset, today: string, startingFree: number) {
  let free = startingFree;
  const remainingGoals = data.goals.map((goal) => Math.max(0, goal.target - goal.saved));
  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = shiftMonths(`${today.slice(0, 7)}-01`, index + 1);
    const monthEnd = shiftDays(shiftMonths(monthStart, 1), -1);
    const planned = data.transactions.filter(
      (transaction) =>
        transaction.status === 'planned' &&
        transaction.date >= monthStart &&
        transaction.date <= monthEnd,
    );
    const recurring = recurringTransactions(
      data.recurring_rules,
      data.transactions,
      monthStart,
      data.recurring_occurrences,
    ).filter((transaction) => transaction.date >= monthStart && transaction.date <= monthEnd);
    const forecastRows = [...planned, ...recurring];
    const incomeRows = forecastRows.filter((transaction) => transaction.type === 'income');
    const salaryIncome = sum(
      incomeRows
        .filter((transaction) => transaction.category.toLowerCase() === 'salário')
        .map((transaction) => transaction.amount),
    );
    const otherIncome = sum(
      incomeRows
        .filter((transaction) => transaction.category.toLowerCase() !== 'salário')
        .map((transaction) => transaction.amount),
    );
    const income = sum([Math.max(data.profile.monthly_income, salaryIncome), otherIncome]);
    const expenses = sum(
      forecastRows
        .filter((transaction) => transaction.type === 'expense')
        .map((transaction) => transaction.amount),
    );
    const goalContributions = remainingGoals.reduce((total, remaining, goalIndex) => {
      const contribution = Math.min(data.goals[goalIndex].monthly_contribution, remaining);
      remainingGoals[goalIndex] -= contribution;
      return sum([total, contribution]);
    }, 0);
    free = sum([free, income, -expenses, -goalContributions]);
    return {
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
        .format(new Date(`${monthStart}T12:00:00Z`))
        .replace('.', ''),
      value: free,
    };
  });
}

function spendingByCategory(transactions: Transaction[], today: string) {
  const month = today.slice(0, 7);
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      transaction.status !== 'paid' ||
      !transaction.date.startsWith(month) ||
      transaction.date > today
    )
      continue;
    totals.set(transaction.category, sum([totals.get(transaction.category) ?? 0, transaction.amount]));
  }
  const sorted = [...totals].sort((first, second) => second[1] - first[1]);
  const top = sorted.slice(0, 5).map(([label, value]) => ({ label, value }));
  const other = sum(sorted.slice(5).map(([, value]) => value));
  if (other) top.push({ label: 'Outras', value: other });
  return top;
}

function projectionHasInputs(data: Dataset, today: string) {
  const nextMonth = shiftMonths(`${today.slice(0, 7)}-01`, 1);
  return (
    data.profile.monthly_income > 0 ||
    data.transactions.some((transaction) => transaction.status === 'planned' && transaction.date >= nextMonth) ||
    data.recurring_rules.some((rule) => rule.active) ||
    data.goals.some((goal) => goal.monthly_contribution > 0 && goal.saved < goal.target)
  );
}

export function CategorySpendChart({ data, today }: { data: Dataset; today: string }) {
  const categories = spendingByCategory(data.transactions, today);
  const total = sum(categories.map((category) => category.value));
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
  return (
    <Card>
      <SectionTitle action={<Badge>Este mês</Badge>}>Gastos por categoria</SectionTitle>
      <p className="muted category-total">
        {total > 0
          ? `${formatMoney(total)} em gastos pagos até agora`
          : 'Sem gastos pagos registrados neste mês'}
      </p>
      {categories.length ? (
        <>
          <div
            className="category-chart"
            role="img"
            aria-label={`Gastos por categoria em ${monthLabel}: ${categories.map(({ label, value }) => `${label}, ${formatMoney(value)}`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categories}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="#e5e1d5" strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: '#706e64' }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat('pt-BR', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(value / 100)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#706e64' }}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e1d5', fontSize: 12 }}
                />
                <Bar dataKey="value" name="Gastos pagos" fill="#64715a" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted category-caption">Considera apenas gastos pagos registrados em {monthLabel}.</p>
        </>
      ) : (
        <p className="muted category-empty">Seus gastos registrados aparecerão aqui, organizados por categoria.</p>
      )}
    </Card>
  );
}
export function TransactionList({ rows }: { rows: Transaction[] }) {
  return (
    <div className="transaction-list">
      {rows.length === 0 ? (
        <p className="muted">Seu primeiro registro pode ser um café, uma conta ou o salário do mês.</p>
      ) : (
        rows.map((t) => {
          const Icon =
            t.type === 'income'
              ? ArrowDownLeft
              : t.category === 'Moradia'
                ? HomeIcon
                : t.category === 'Transporte'
                  ? Bus
                  : t.description.toLowerCase().includes('café')
                    ? Coffee
                    : ShoppingBag;
          return (
            <div className="transaction-row" key={t.id}>
              <span className="category-icon">
                <Icon size={17} />
              </span>
              <div>
                <h3>{t.description}</h3>
                <small>
                  {t.category}
                  {t.source === 'whatsapp' ? ' · WhatsApp' : ''}
                </small>
              </div>
              <div className={`transaction-amount ${t.type === 'income' ? 'positive' : ''}`}>
                {t.type === 'income' ? '+' : '−'} {formatMoney(t.amount)}
                <small>
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(`${t.date}T12:00:00Z`))}
                  {t.status === 'planned' ? ' · previsto' : ''}
                </small>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
export function HomePage() {
  const { data, demo } = useApp(),
    [adding, setAdding] = useState(false);
  const s = personalSummary(data),
    today = civilDate(new Date(), data.profile.timezone);
  const forecast = projectFreeCash(data, today, s.free);
  const canProject = projectionHasInputs(data, today);
  const history = Array.from({ length: 6 }, (_, i) => {
    const date = shiftMonths(`${today.slice(0, 7)}-01`, i - 5);
    const flow = monthlyFlow(data.transactions, date.slice(0, 7));
    return {
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
        .format(new Date(`${date}T12:00:00Z`))
        .replace('.', ''),
      value: flow.income,
      expenses: flow.expenses,
    };
  });
  const current = data.goals.find((g) => g.priority === 'high') ?? data.goals[0];
  const progress = s.milestone.target ? Math.min(100, (s.milestone.current / s.milestone.target) * 100) : 0;
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: data.profile.timezone,
    }).format(new Date()),
  );
  return (
    <>
      <header className="page-header">
        <div>
          <p className="greeting-date">
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: data.profile.timezone,
            }).format(new Date())}
          </p>
          <h1 className="home-title">
            {hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, {data.profile.name.split(' ')[0]}
            .
          </h1>
          <p className="page-description">Vamos dar mais um passo na direção do seu futuro?</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={17} />
          Adicionar movimento
        </Button>
      </header>
      <Card className="balance-card">
        <SectionTitle action={<Badge tone="green">{demo ? 'Dados de exemplo' : 'Seus registros'}</Badge>}>
          Seu dinheiro hoje
        </SectionTitle>
        <div className="stats">
          <Stat label="Saldo disponível estimado" value={s.balance} hint="Somando suas contas" />
          <Stat label="Entradas do mês" value={s.income} hint="Recebidas até agora" />
          <Stat label="Saídas do mês" value={s.expenses} hint="Movimentos confirmados" />
          <Stat label="Livre para planejar" value={s.free} accent hint="Após reserva, contas e metas" />
        </div>
        <Why title="Como calculamos o valor livre?">
          <p>
            Saldo {formatMoney(s.balance)} + entradas previstas {formatMoney(s.expectedIncome)} − contas
            previstas {formatMoney(s.upcomingBills)} − reserva {formatMoney(s.reserve)} − aportes planejados{' '}
            {formatMoney(s.goalAllocation)}.
          </p>
          <p>
            O valor considera apenas seus registros. Contas ainda não informadas podem mudar esta estimativa.
          </p>
        </Why>
      </Card>
      <div className="grid grid-main">
        <div className="stack">
          <Card className="journey-card">
            <div className="journey-header">
              <Sprout size={15} />
              Seu próximo marco
            </div>
            <h2>{s.milestone.title}</h2>
            <p>{s.milestone.action} O importante é continuar na sua direção.</p>
            <div className="journey-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="journey-numbers">
              <span>
                <strong>{formatMoney(s.milestone.current)}</strong> de {formatMoney(s.milestone.target)}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} label="Progresso da meta principal" />
            <div className="journey-footer">
              <span>{current ? `Meta: ${current.name}` : 'Um passo de cada vez'}</span>
              <Link to="/jornada" className="text-link">
                Ver minha jornada
                <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
          <Card>
            <SectionTitle action={<Badge tone="green">Próximos 6 meses</Badge>}>
              Dinheiro livre projetado
            </SectionTitle>
            <p className="muted forecast-baseline">
              Partindo de {formatMoney(s.free)} livres após os compromissos deste mês.
            </p>
            {canProject ? (
              <>
                <TrendChart data={forecast} valueName="Livre ao fim do mês" />
                <p className="muted forecast-caption">
                  Estimativa com renda mensal, entradas previstas, gastos planejados, recorrências e aportes para metas.
                  Não é saldo bancário; despesas não cadastradas podem alterar os valores.
                </p>
              </>
            ) : (
              <p className="muted forecast-empty">
                Informe sua renda mensal ou cadastre gastos planejados e contas fixas para ver a projeção.
              </p>
            )}
          </Card>
          <Card>
            <SectionTitle
              action={
                <Link className="text-link" to="/relatorios">
                  Ver detalhes
                  <ArrowUpRight size={13} />
                </Link>
              }
            >
              Seu fluxo, com perspectiva
            </SectionTitle>
            <div className="chart-legend">
              <span>
                <i />
                Entradas
              </span>
              <span>
                <i className="expense-dot" />
                Saídas
              </span>
              <span style={{ marginLeft: 'auto' }}>Últimos 6 meses</span>
            </div>
            <TrendChart data={history} second />
          </Card>
        </div>
        <div className="stack">
          <CategorySpendChart data={data} today={today} />
          <Card className="score-card">
            <div>
              <Badge tone="green">Nexo Score</Badge>
              <h3 style={{ marginTop: 10 }}>Mais clareza, mais autonomia.</h3>
              <p>
                {s.score.attention
                  ? `Seu ponto de atenção: ${s.score.attention.name.toLowerCase()}.`
                  : 'Vamos conhecer seus números.'}
              </p>
              <Link to="/jornada" className="text-link" style={{ fontSize: 11, marginTop: 8 }}>
                Entender meu score
                <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="score-number">
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="35" fill="none" stroke="#e8e0cd" strokeWidth="5" />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="#64715a"
                  strokeWidth="5"
                  strokeDasharray={`${(s.score.overall ?? 0) * 2.2} 220`}
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <strong>{s.score.overall ?? '—'}</strong>
                <small>de 100</small>
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle action={<Badge>Esta semana</Badge>}>Seu plano Nexo</SectionTitle>
            {weeklyPlan(data).map((item, i) => (
              <div className="plan-item" key={item.id}>
                <span className="plan-number">{i + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                </div>
                <Link to={item.href} aria-label={`Abrir: ${item.title}`}>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            ))}
          </Card>
        </div>
        <Card>
          <SectionTitle
            action={
              <Link to="/movimentos" className="text-link">
                Ver todos
                <ArrowUpRight size={13} />
              </Link>
            }
          >
            Últimos movimentos
          </SectionTitle>
          <TransactionList
            rows={[...data.transactions]
              .filter((t) => t.status === 'paid')
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 4)}
          />
        </Card>
        <Card>
          <SectionTitle action={<Sparkles size={16} className="muted" />}>
            Antes de decidir, simule.
          </SectionTitle>
          <h3>Essa compra cabe no seu momento?</h3>
          <p className="muted" style={{ fontSize: 12, margin: '12px 0 24px' }}>
            Veja como um gasto afeta suas contas e o prazo das suas metas. Sem julgamento.
          </p>
          <Link to="/futuro" className="button button-secondary">
            Posso gastar?
            <ArrowUpRight size={15} />
          </Link>
          <Why title="O que é considerado?">
            Saldo, entradas e contas previstas, reserva protegida e aportes. Todos os números vêm do motor
            financeiro.
          </Why>
        </Card>
      </div>
      <div className="whatsapp-card" style={{ marginTop: 20 }}>
        <MessageCircle size={25} />
        <div>
          <h3>Sua vida acontece. O Nexo acompanha.</h3>
          <p>“Gastei 25 no almoço.” Registre pelo WhatsApp, no seu ritmo.</p>
        </div>
        <Link className="text-link" to="/integracoes">
          Conhecer a integração
          <ArrowUpRight size={14} />
        </Link>
      </div>
      {adding && <Editor entity="transactions" onClose={() => setAdding(false)} />}
    </>
  );
}
