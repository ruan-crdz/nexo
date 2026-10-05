import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { civilDate, formatMoney, shiftMonths } from '../../shared/financial-engine';
import { Card, Stat, SectionTitle, Badge, Progress, Why, Button } from '../design-system/components';
import { Editor } from './Editor';
import type { Transaction } from '../../shared/domain';

export function TrendChart({
  data,
  second = false,
}: {
  data: { label: string; value: number; expenses?: number }[];
  second?: boolean;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Evolução: ${data.map((d) => `${d.label}: ${formatMoney(d.value)}${second ? `, saídas ${formatMoney(d.expenses ?? 0)}` : ''}`).join('; ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 8, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={(v: number) => `${v / 100000}k`}
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
            name={second ? 'Entradas' : 'Saldo projetado'}
            stroke="#64715a"
            fill="url(#chart-fill)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
