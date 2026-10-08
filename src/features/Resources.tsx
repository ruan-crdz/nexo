import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Download, Target, Palmtree } from 'lucide-react';
import type { Entity, EntityMap } from '../../shared/domain';
import { formatMoney, civilDate, goalPlan, employeeCost } from '../../shared/financial-engine';
import { personalSummary } from '../../shared/insights';
import { useApp } from '../data/context';
import { Badge, Button, Card, Dialog, Empty, PageHeader, Progress, Why } from '../design-system/components';
import { Editor, entityLabels } from './Editor';

export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ResourcePage<K extends Entity>({
  entity,
  title,
  description,
}: {
  entity: K;
  title: string;
  description: string;
}) {
  const app = useApp(),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [editing, setEditing] = useState<EntityMap[K] | null | undefined>(undefined),
    [deleting, setDeleting] = useState<string | null>(null),
    [error, setError] = useState('');
  const rows = app.data[entity] as EntityMap[K][];
  const filtered = rows
    .filter((r) => JSON.stringify(r).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .filter(
      (r) => filter === 'all' || ('type' in r && r.type === filter) || ('status' in r && r.status === filter),
    );
  const movement = entity === 'transactions' || entity === 'business_transactions';
  async function remove() {
    if (!deleting) return;
    try {
      await app.repository.remove(entity, deleting, app.organizationId);
      await app.refresh();
      setDeleting(null);
      app.toast('Registro excluído.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }
  function exportCSV() {
    const cells = (v: unknown) =>
      `"${String(v ?? '')
        .replace(/^[=+@-]/, "' $&")
        .replace(/"/g, '""')}"`;
    const keys = filtered.length ? Object.keys(filtered[0]) : [];
    download(
      `nexo-${entity}.csv`,
      '\uFEFF' +
        [
          keys.map(cells).join(';'),
          ...filtered.map((r) =>
            keys.map((k) => cells((r as unknown as Record<string, unknown>)[k])).join(';'),
          ),
        ].join('\r\n'),
      'text/csv;charset=utf-8',
    );
    app.toast('Exportação gerada. Valores monetários estão em centavos.');
  }
  return (
    <>
      <PageHeader
        eyebrow={entity.startsWith('business') || entity === 'employees' ? 'Nexo Empresas' : 'Nexo Pessoal'}
        title={title}
        description={description}
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} />
            Adicionar {entityLabels[entity]}
          </Button>
        }
      />
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
            Buscar registros
          </span>
          <Search size={17} />
          <input
            placeholder="Buscar nos seus registros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {movement && (
          <select aria-label="Filtrar movimentos" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos os movimentos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="planned">Previstos</option>
          </select>
        )}
        <Button variant="secondary" onClick={exportCSV}>
          <Download size={16} />
          Exportar CSV
        </Button>
      </div>
      <Card>
        {filtered.length === 0 ? (
          <Empty
            title={rows.length ? 'Nenhum registro com esse filtro' : 'Seu próximo passo começa aqui'}
            description={
              movement
                ? 'Adicione um movimento ou, após conectar a integração, envie “gastei 20 no almoço” pelo WhatsApp.'
                : 'Cadastre seu primeiro item. Você pode ajustar os valores quando souber mais.'
            }
            action={() => setEditing(null)}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{movement ? 'Movimento' : 'Nome'}</th>
                  <th>{movement ? 'Categoria' : 'Detalhes'}</th>
                  <th>{movement ? 'Data' : 'Referência'}</th>
                  <th>Valor</th>
                  <th>
                    <span aria-label="Ações">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const r = row as unknown as Record<string, unknown>;
                  const amount = Number(
                    r.amount ??
                      r.salary ??
                      r.balance ??
                      r.value ??
                      r.limit_amount ??
                      r.opening_balance ??
                      r.target ??
                      0,
                  );
                  const detail = String(
                    r.category ??
                      r.role ??
                      r.kind ??
                      (r.rate_bps !== undefined ? `${Number(r.rate_bps) / 100}% a.m.` : ''),
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{String(r.description ?? r.name ?? r.category)}</strong>
                        {r.status === 'planned' && (
                          <div>
                            <Badge tone="orange">Previsto</Badge>
                          </div>
                        )}
                      </td>
                      <td>{detail}</td>
                      <td>{String(r.date ?? r.deadline ?? r.due_date ?? r.month ?? r.department ?? '—')}</td>
                      <td className={`money ${r.type === 'income' ? 'positive' : ''}`}>
                        {r.type === 'income' ? '+ ' : r.type === 'expense' ? '− ' : ''}
                        {formatMoney(amount)}
                        {entity === 'employees' && (
                          <div>
                            <small className="muted">
                              Total:{' '}
                              {formatMoney(
                                employeeCost(
                                  Number(r.salary),
                                  Number(r.benefits),
                                  Number(r.charges_bps),
                                  Number(r.other_costs),
                                ).monthly,
                              )}
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <Button
                            variant="ghost"
                            onClick={() => setEditing(row)}
                            aria-label={`Editar ${String(r.description ?? r.name ?? r.category)}`}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setError('');
                              setDeleting(row.id);
                            }}
                            aria-label={`Excluir ${String(r.description ?? r.name ?? r.category)}`}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {entity === 'financial_accounts' && (
          <Why>
            O saldo inicial é somado aos movimentos registrados. No cartão, compras aumentam a dívida: use
            saldo inicial negativo se já houver fatura. Não registre a mesma dívida novamente em Dívidas.
            Fechamento e vencimento são referências; não há importação bancária automática.
          </Why>
        )}
      </Card>
      {editing !== undefined && (
        <Editor entity={entity} initial={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
      {deleting && (
        <Dialog title="Excluir este registro?" onClose={() => setDeleting(null)}>
          <p>O registro será removido e os cálculos serão atualizados.</p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              Excluir registro
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function GoalsPage() {
  const app = useApp(),
    [editing, setEditing] = useState<EntityMap['goals'] | null | undefined>(undefined);
  const today = civilDate();
  const s = personalSummary(app.data);
  return (
    <>
      <PageHeader
        eyebrow="Metas e sonhos"
        title="Seu dinheiro, com destino."
        description="O que importa para você merece um plano possível."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} />
            Criar meta
          </Button>
        }
      />
      {app.data.goals.length === 0 ? (
        <Card>
          <Empty
            title="Qual é seu próximo sonho?"
            description="Pode ser um pequeno colchão financeiro ou uma viagem. Comece pelo que faz sentido agora."
            action={() => setEditing(null)}
          />
        </Card>
      ) : (
        <div className="grid grid-3">
          {app.data.goals.map((g, i) => {
            const months = g.deadline
              ? Math.max(
                  0,
                  (Number(g.deadline.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
                    Number(g.deadline.slice(5, 7)) -
                    Number(today.slice(5, 7)),
                )
              : 0;
            const plan = goalPlan(g.target, g.saved, months, g.monthly_contribution);
            const Icon = i % 2 ? Palmtree : Target;
            return (
              <Card key={g.id} className="goal-card">
                <div className={`goal-visual ${i % 2 ? 'terra' : ''}`}>
                  <Icon size={36} strokeWidth={1} />
                </div>
                <Badge tone={g.priority === 'high' ? 'green' : 'neutral'}>
                  {g.priority === 'high' ? 'Sua prioridade' : 'No seu horizonte'}
                </Badge>
                <h3 style={{ marginTop: 12 }}>{g.name}</h3>
                <p className="muted" style={{ fontSize: 11 }}>
                  {g.deadline
                    ? `Até ${new Date(`${g.deadline}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                    : 'Sem data final'}
                </p>
                <Progress value={plan.progress} label={g.name} />
                <div className="goal-meta">
                  <strong>{formatMoney(g.saved)}</strong>
                  <span>de {formatMoney(g.target)}</span>
                </div>
                <Why title="Este plano cabe no meu momento?">
                  <p>
                    Faltam {formatMoney(plan.remaining)}.{' '}
                    {g.deadline
                      ? `Para o prazo informado: ${formatMoney(plan.required)}/mês.`
                      : 'Sem prazo final, não há cota mensal obrigatória.'}{' '}
                    Aporte planejado: {formatMoney(g.monthly_contribution)}.
                  </p>
                  <p>
                    {!g.deadline
                      ? 'Você pode avançar no seu ritmo, sem data limite.'
                      : plan.feasible
                      ? 'O aporte informado alcança a meta no prazo.'
                      : 'Revise prazo ou aporte para tornar o plano viável.'}{' '}
                    O total de aportes das suas metas é {formatMoney(s.goalAllocation)} por mês.
                  </p>
                  <p>
                    Estimativa sem juros. O valor guardado é uma referência de planejamento; não é adicionado
                    ao patrimônio.
                  </p>
                </Why>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(g)}
                  style={{ marginTop: 15, width: '100%' }}
                >
                  <Pencil size={14} />
                  Atualizar meta
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      {editing !== undefined && (
        <Editor entity="goals" initial={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}
