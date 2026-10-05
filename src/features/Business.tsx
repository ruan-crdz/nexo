import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowUpRight, Building2, Plus, Users } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { businessSummary } from '../../shared/insights';
import {
  applyRate,
  businessScenario,
  employeeCost,
  formatMoney,
  parseMoney,
  sum,
} from '../../shared/financial-engine';
import {
  Badge,
  Button,
  Card,
  Dialog,
  PageHeader,
  SectionTitle,
  Stat,
  Why,
} from '../design-system/components';
import { TrendChart, TransactionList } from './Home';
import { businessProfileSchema } from '../../shared/domain';

export function BusinessLayout() {
  const app = useApp(),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const first = app.data.organizations[0]?.id;
  const { organizationId, selectOrganization } = app;
  useEffect(() => {
    if (!organizationId && first) selectOrganization(first);
  }, [first, organizationId, selectOrganization]);
  async function create() {
    setPending(true);
    try {
      const id = await app.repository.createOrganization(name);
      app.selectOrganization(id);
      await app.refresh();
    } catch {
      setError('Use um nome de 2 a 100 caracteres e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  if (!first)
    return (
      <>
        <PageHeader
          eyebrow="Nexo Empresas"
          title="Dê espaço para seu negócio."
          description="Separe sua vida pessoal da empresa e entenda o que seu negócio gera."
        />
        <Card>
          <Building2 size={35} />
          <h2 style={{ margin: '16px 0' }}>Ativar Nexo Empresas</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Comece pelo nome. Você pode informar faturamento, custos e equipe aos poucos.
          </p>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label>
              Nome da empresa
              <input
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <Button disabled={pending} type="submit">
              <Plus size={16} />
              Criar espaço
            </Button>
          </form>
          {error && <p className="error-message">{error}</p>}
        </Card>
      </>
    );
  if (!app.organizationId) return <p role="status">Preparando sua empresa…</p>;
  return (
    <>
      <div className="workspace-select">
        <label>
          Empresa ativa
          <select value={app.organizationId} onChange={(e) => app.selectOrganization(e.target.value)}>
            {app.data.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.role}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Outlet />
    </>
  );
}
export function BusinessDashboard() {
  const { data } = useApp(),
    s = businessSummary(data);
  const paid = data.business_transactions.filter((t) => t.status === 'paid');
  return (
    <>
      <PageHeader
        eyebrow="Nexo Empresas"
        title={`${data.business.name}, com perspectiva.`}
        description="Premissas mensais para entender a capacidade do seu negócio."
        action={
          <Link to="/empresa/cenarios" className="button button-primary">
            <Users size={16} />
            Posso contratar?
          </Link>
        }
      />
      <div className="metric-grid bottom-space">
        {[
          { label: 'Caixa informado', value: data.business.cash },
          { label: 'Receita mensal prevista', value: s.revenue },
          { label: 'Resultado mensal estimado', value: s.result },
          { label: 'Folha estimada', value: s.payroll },
          { label: 'Margem estimada', value: s.margin === null ? 'Sem receita' : `${s.margin.toFixed(1)}%` },
          {
            label: 'Meses de caixa (runway)',
            value: s.runwayAfter === null ? 'Sem consumo líquido' : `${s.runwayAfter.toFixed(1)} meses`,
          },
        ].map((m) => (
          <Card key={m.label}>
            <Stat {...m} accent={m.label.includes('Resultado')} />
          </Card>
        ))}
      </div>
      <div className="grid grid-2">
        <Card>
          <SectionTitle>Caixa nos próximos meses</SectionTitle>
          <TrendChart
            data={s.projection
              .filter((p) => p.month % 2 === 0)
              .map((p) => ({ label: `${p.month}m`, value: p.balance }))}
          />
          <Why>
            Projeção = caixa inicial + (receita − custos) × meses. Custos incluem fixos informados, folha
            estimada, pró-labore, custos variáveis e impostos parametrizados. Os movimentos reais não são
            somados novamente às premissas.
          </Why>
        </Card>
        <Card>
          <SectionTitle
            action={
              <Link to="/empresa/relatorios" className="text-link">
                Ver DRE
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            Saúde da operação
          </SectionTitle>
          <div className="stack">
            <Stat label="Receita de equilíbrio" value={s.breakEven ?? 'Margem de contribuição nula'} />
            <Stat label="Consumo líquido mensal (burn rate)" value={s.burnRate} />
            <Stat
              label="Contas a receber registradas"
              value={sum(
                data.business_transactions
                  .filter((t) => t.status === 'planned' && t.type === 'income')
                  .map((t) => t.amount),
              )}
            />
            <Stat
              label="Contas a pagar registradas"
              value={sum(
                data.business_transactions
                  .filter((t) => t.status === 'planned' && t.type === 'expense')
                  .map((t) => t.amount),
              )}
            />
          </div>
        </Card>
        <Card>
          <SectionTitle>Movimentos confirmados</SectionTitle>
          <TransactionList rows={paid.slice(0, 5)} />
        </Card>
        <Card className="journey-card">
          <div className="journey-header">Seu próximo passo</div>
          <h2>Decisões de hoje. Fôlego para amanhã.</h2>
          <p>Teste uma contratação ou uma mudança de receita e veja o efeito no caixa.</p>
          <Link className="button button-primary" to="/empresa/cenarios">
            Explorar cenários
            <ArrowUpRight size={15} />
          </Link>
        </Card>
      </div>
    </>
  );
}
export function HiringPage() {
  const { data } = useApp(),
    baseline = businessSummary(data),
    [salary, setSalary] = useState(800_000),
    [benefits, setBenefits] = useState(80_000),
    [charges, setCharges] = useState(3500),
    [people, setPeople] = useState(1),
    [revenueChange, setRevenueChange] = useState(0),
    [horizon, setHorizon] = useState(12);
  const cost = employeeCost(salary, benefits, charges),
    b = data.business;
  const s = businessScenario({
    cash: b.cash,
    revenue: b.revenue,
    fixedCosts: sum([b.fixed_costs, b.pro_labore, baseline.payroll]),
    variableCostBps: Math.min(10_000, b.variable_cost_bps + b.tax_bps),
    newMonthlyCost: cost.monthly * people,
    revenueChangeBps: revenueChange,
    months: horizon,
  });
  return (
    <>
      <PageHeader
        eyebrow="Simulador empresarial"
        title="Essa contratação cabe no plano?"
        description="Altere as premissas e veja o impacto. A decisão continua sendo sua."
      />
      <div className="grid grid-2">
        <Card>
          <SectionTitle>Premissas da decisão</SectionTitle>
          <div className="stack">
            {[
              {
                label: 'Salário / honorários por pessoa',
                value: salary,
                set: setSalary,
                max: 3_000_000,
                step: 10_000,
                formatted: formatMoney(salary),
              },
              {
                label: 'Benefícios por pessoa',
                value: benefits,
                set: setBenefits,
                max: 300_000,
                step: 5000,
                formatted: formatMoney(benefits),
              },
              {
                label: 'Encargos e provisões estimados',
                value: charges,
                set: setCharges,
                max: 10_000,
                step: 100,
                formatted: `${charges / 100}%`,
              },
              {
                label: 'Quantidade de pessoas',
                value: people,
                set: setPeople,
                max: 10,
                step: 1,
                formatted: String(people),
              },
              {
                label: 'Variação da receita',
                value: revenueChange,
                set: setRevenueChange,
                max: 5000,
                min: -10_000,
                step: 500,
                formatted: `${revenueChange / 100}%`,
              },
            ].map((p) => (
              <label className="range-row" key={p.label}>
                <span>
                  {p.label}
                  <strong>{p.formatted}</strong>
                </span>
                <input
                  type="range"
                  min={p.min ?? 0}
                  max={p.max}
                  step={p.step}
                  value={p.value}
                  onChange={(e) => p.set(Number(e.target.value))}
                />
              </label>
            ))}
            <label>
              Horizonte
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {[3, 6, 12, 24].map((n) => (
                  <option value={n} key={n}>
                    {n} meses
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Why>
            Encargos são uma estimativa editável; não representam uma alíquota legal universal. Inclua férias,
            décimo terceiro, tributos, benefícios e provisões conforme o vínculo e o regime da sua empresa.
            Valide com sua contabilidade.
          </Why>
        </Card>
        <div className="stack">
          <Card>
            <SectionTitle>O efeito no seu negócio</SectionTitle>
            <div className="grid grid-2">
              <Stat label="Novo custo mensal total" value={cost.monthly * people} />
              <Stat label="Custo anual da contratação" value={cost.annual * people} />
              <Stat
                label="Meses de caixa antes"
                value={s.runwayBefore === null ? 'Sem consumo líquido' : `${s.runwayBefore.toFixed(1)} meses`}
              />
              <Stat
                label="Meses de caixa depois"
                value={s.runwayAfter === null ? 'Sem consumo líquido' : `${s.runwayAfter.toFixed(1)} meses`}
              />
            </div>
            <TrendChart data={s.projection.map((p) => ({ label: `${p.month}m`, value: p.balance }))} />
            <Stat
              label="Receita adicional para equilibrar"
              value={s.breakEven === null ? 'Sem equilíbrio com margem nula' : s.additionalRevenueNeeded}
              accent
            />
          </Card>
          <div className="notice">
            Simulação sem novas vendas garantidas. Confira reserva operacional, concentração de clientes e
            compromissos antes de decidir.
          </div>
        </div>
      </div>
    </>
  );
}
export function BusinessReports() {
  const { data } = useApp(),
    s = businessSummary(data),
    b = data.business;
  const entries = [
    ['Receita bruta prevista', b.revenue],
    ['Custos variáveis e impostos', applyRate(b.revenue, b.variable_cost_bps + b.tax_bps)],
    ['Custos fixos', b.fixed_costs],
    ['Folha estimada', s.payroll],
    ['Pró-labore', b.pro_labore],
    ['Resultado gerencial estimado', s.result],
  ] as const;
  return (
    <>
      <PageHeader
        eyebrow="DRE gerencial"
        title="Entenda o resultado do negócio."
        description="Visão simplificada baseada nas premissas mensais informadas."
      />
      <Card>
        <SectionTitle action={<Badge>Planejamento</Badge>}>Receita, custos e resultado</SectionTitle>
        <table className="data-table">
          <thead>
            <tr>
              <th>Componente</th>
              <th>Valor mensal</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="money">{formatMoney(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Why>
          Esta é uma DRE gerencial estimada, não demonstração contábil. Custos fixos informados devem excluir
          folha e pró-labore, que são adicionados pelo motor. Os registros de fluxo de caixa podem ter regime
          e datas diferentes.
        </Why>
      </Card>
    </>
  );
}
export function BusinessSettings() {
  const app = useApp(),
    [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        Object.entries(app.data.business).map(([k, v]) => [
          k,
          ['revenue', 'fixed_costs', 'cash', 'pro_labore'].includes(k)
            ? (Number(v) / 100).toFixed(2).replace('.', ',')
            : String(v),
        ]),
      ),
    ),
    [error, setError] = useState(''),
    [newName, setNewName] = useState(''),
    [deleteOpen, setDeleteOpen] = useState(false),
    [deleteName, setDeleteName] = useState('');
  async function save() {
    try {
      const v = { ...values } as Record<string, unknown>;
      for (const k of ['revenue', 'fixed_costs', 'cash', 'pro_labore']) v[k] = parseMoney(String(v[k]));
      for (const k of ['variable_cost_bps', 'tax_bps']) v[k] = Number(v[k]);
      const b = businessProfileSchema.parse(v);
      if (b.variable_cost_bps + b.tax_bps > 10_000)
        throw new Error('Custos variáveis e impostos não podem superar 100% nesta simulação.');
      await app.repository.business(b, app.organizationId!);
      await app.refresh();
      app.toast('Premissas da empresa atualizadas.');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confira os dados.');
    }
  }
  const labels: Record<string, string> = {
    name: 'Nome da empresa',
    segment: 'Segmento',
    revenue: 'Receita mensal prevista (R$)',
    fixed_costs: 'Custos fixos sem folha e pró-labore (R$)',
    variable_cost_bps: 'Custos variáveis (100 = 1%)',
    cash: 'Caixa atual (R$)',
    pro_labore: 'Pró-labore mensal (R$)',
    tax_bps: 'Impostos sobre receita (100 = 1%)',
  };
  return (
    <>
      <PageHeader
        title="Premissas do seu negócio"
        description="Atualize conforme aprende mais sobre sua operação."
      />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="form-grid">
            {Object.entries(labels).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  required
                  value={values[k]}
                  onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="submit">Salvar premissas</Button>
          </div>
        </form>
      </Card>
      {!app.demo && (
        <Card className="bottom-space">
          <h2>Outra empresa, outro espaço</h2>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void app.repository
                .createOrganization(newName)
                .then(async (id) => {
                  app.selectOrganization(id);
                  await app.refresh();
                  app.toast('Empresa criada.');
                })
                .catch(() => setError('Não foi possível criar a empresa.'));
            }}
          >
            <label>
              Nome da nova empresa
              <input
                required
                minLength={2}
                maxLength={100}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <Button type="submit">Criar empresa</Button>
          </form>
        </Card>
      )}
      {!app.demo && app.data.organizations.find((o) => o.id === app.organizationId)?.role === 'owner' && (
        <Card>
          <SectionTitle>Excluir este espaço empresarial</SectionTitle>
          <p className="muted">
            Apaga permanentemente registros, membros e auditoria desta empresa. Exporte os dados no centro de
            privacidade antes.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)} style={{ marginTop: 20 }}>
            Excluir empresa
          </Button>
        </Card>
      )}
      {deleteOpen && (
        <Dialog title="Excluir a empresa permanentemente?" onClose={() => setDeleteOpen(false)}>
          <label>
            Digite o nome exato: {app.data.organizations.find((o) => o.id === app.organizationId)?.name}
            <input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} />
          </label>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={deleteName !== app.data.organizations.find((o) => o.id === app.organizationId)?.name}
              onClick={() => {
                void supabase!
                  .rpc('delete_organization', { org: app.organizationId, confirmation: deleteName })
                  .then(async ({ error }) => {
                    if (error) setError('Não foi possível excluir a empresa.');
                    else {
                      app.selectOrganization(null);
                      await app.refresh();
                      setDeleteOpen(false);
                      app.toast('Empresa excluída.');
                    }
                  });
              }}
            >
              Excluir permanentemente
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function AccessPage() {
  const app = useApp(),
    [members, setMembers] = useState<{ user_id: string; role: string }[]>([]),
    [userId, setUserId] = useState(''),
    [role, setRole] = useState('viewer'),
    [error, setError] = useState('');
  useEffect(() => {
    if (!app.demo && supabase && app.organizationId)
      void supabase
        .from('organization_members')
        .select('user_id,role')
        .eq('organization_id', app.organizationId)
        .then(({ data, error }) => {
          if (error) setError('Não foi possível carregar os membros.');
          else setMembers(data ?? []);
        });
  }, [app.demo, app.organizationId]);
  async function add() {
    if (app.demo) {
      app.toast('A demonstração não altera permissões de contas reais.');
      return;
    }
    const result = await supabase!.rpc('set_member', {
      org: app.organizationId,
      member_id: userId,
      member_role: role,
    });
    if (result.error)
      setError('Somente o proprietário pode conceder acesso a uma conta cadastrada. Confira o ID.');
    else {
      setMembers([...members.filter((m) => m.user_id !== userId), { user_id: userId, role }]);
      app.toast('Acesso atualizado.');
      setError('');
    }
  }
  return (
    <>
      <PageHeader
        title="Pessoas e permissões"
        description="O proprietário controla quem acessa os dados da empresa."
      />
      <Card>
        <div className="notice">
          Owner/admin/finance podem alterar finanças. Manager/viewer têm leitura. Somente owner gerencia
          membros; ninguém pode promover a si mesmo.
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          className="form-grid"
          style={{ marginTop: 24 }}
        >
          <label>
            ID da conta convidada
            <input
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID disponível no perfil da pessoa"
            />
          </label>
          <label>
            Papel
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {['viewer', 'manager', 'finance', 'admin'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Conceder acesso</Button>
        </form>
        {error && <p className="error-message">{error}</p>}
        <table className="data-table" style={{ marginTop: 24 }}>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Papel</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {(app.demo ? [{ user_id: 'Conta de demonstração', role: 'owner' }] : members).map((m) => (
              <tr key={m.user_id}>
                <td>{m.user_id}</td>
                <td>{m.role}</td>
                <td>
                  {m.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void supabase
                          ?.from('organization_members')
                          .delete()
                          .eq('organization_id', app.organizationId)
                          .eq('user_id', m.user_id)
                          .select()
                          .then(({ error, data }) => {
                            if (error || !data?.length) setError('Não foi possível revogar o acesso.');
                            else setMembers(members.filter((x) => x.user_id !== m.user_id));
                          });
                      }}
                    >
                      Revogar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
