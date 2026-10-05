import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Entity, EntityMap } from '../../shared/domain';
import { categories, entitySchemas } from '../../shared/domain';
import { civilDate, parseMoney, shiftMonths } from '../../shared/financial-engine';
import { useApp } from '../data/context';
import { Button, Dialog } from '../design-system/components';

type Field = {
  key: string;
  label: string;
  kind?: 'money' | 'number' | 'date' | 'select' | 'checkbox' | 'month';
  options?: { value: string; label: string }[];
  hint?: string;
};
const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));
const movementFields: Field[] = [
  { key: 'description', label: 'Descrição' },
  { key: 'amount', label: 'Valor (R$)', kind: 'money' },
  {
    key: 'type',
    label: 'Tipo',
    kind: 'select',
    options: [
      { value: 'expense', label: 'Saída' },
      { value: 'income', label: 'Entrada' },
    ],
  },
  { key: 'category', label: 'Categoria', kind: 'select', options: options(categories) },
  { key: 'date', label: 'Data', kind: 'date' },
  {
    key: 'status',
    label: 'Situação',
    kind: 'select',
    options: [
      { value: 'paid', label: 'Pago / recebido' },
      { value: 'planned', label: 'Previsto' },
    ],
  },
];
export const fields: Record<Entity, Field[]> = {
  transactions: [...movementFields, { key: 'account_id', label: 'Conta', kind: 'select' }],
  business_transactions: [
    ...movementFields.filter((f) => f.key !== 'category'),
    { key: 'category', label: 'Área / categoria' },
  ],
  financial_accounts: [
    { key: 'name', label: 'Nome da conta' },
    {
      key: 'kind',
      label: 'Tipo',
      kind: 'select',
      options: [
        { value: 'checking', label: 'Conta corrente' },
        { value: 'savings', label: 'Reserva' },
        { value: 'investment', label: 'Investimento' },
        { value: 'credit', label: 'Cartão de crédito' },
      ],
    },
    {
      key: 'opening_balance',
      label: 'Saldo inicial (R$)',
      kind: 'money',
      hint: 'Antes dos movimentos registrados. No cartão, dívida tem sinal negativo.',
    },
    { key: 'closing_day', label: 'Dia de fechamento (opcional)', kind: 'number' },
    { key: 'due_day', label: 'Dia de vencimento (opcional)', kind: 'number' },
  ],
  goals: [
    { key: 'name', label: 'Nome da meta' },
    { key: 'target', label: 'Quanto quer alcançar (R$)', kind: 'money' },
    {
      key: 'saved',
      label: 'Quanto já separou (R$)',
      kind: 'money',
      hint: 'Informação de planejamento. Não movimenta suas contas.',
    },
    { key: 'monthly_contribution', label: 'Aporte mensal planejado (R$)', kind: 'money' },
    { key: 'deadline', label: 'Prazo', kind: 'date' },
    {
      key: 'priority',
      label: 'Prioridade',
      kind: 'select',
      options: [
        { value: 'high', label: 'Alta' },
        { value: 'medium', label: 'Média' },
        { value: 'low', label: 'Baixa' },
      ],
    },
  ],
  debts: [
    { key: 'name', label: 'Credor / dívida' },
    { key: 'balance', label: 'Saldo devedor (R$)', kind: 'money' },
    {
      key: 'rate_bps',
      label: 'Taxa mensal (pontos-base)',
      kind: 'number',
      hint: '100 = 1% ao mês; 300 = 3%. Consulte seu contrato.',
    },
    { key: 'minimum', label: 'Parcela mínima (R$)', kind: 'money' },
    { key: 'due_date', label: 'Vencimento', kind: 'date' },
    { key: 'overdue', label: 'Está em atraso', kind: 'checkbox' },
  ],
  assets: [
    { key: 'name', label: 'Nome do bem' },
    { key: 'value', label: 'Valor estimado (R$)', kind: 'money' },
    {
      key: 'kind',
      label: 'Tipo',
      kind: 'select',
      options: [
        { value: 'property', label: 'Imóvel' },
        { value: 'vehicle', label: 'Veículo' },
        { value: 'investment', label: 'Investimento fora das contas' },
        { value: 'other', label: 'Outro' },
      ],
    },
  ],
  budgets: [
    { key: 'category', label: 'Categoria', kind: 'select', options: options(categories) },
    { key: 'limit_amount', label: 'Limite planejado (R$)', kind: 'money' },
    { key: 'month', label: 'Mês', kind: 'month' },
  ],
  business_budgets: [
    { key: 'category', label: 'Departamento' },
    { key: 'limit_amount', label: 'Orçamento (R$)', kind: 'money' },
    { key: 'month', label: 'Mês', kind: 'month' },
  ],
  employees: [
    { key: 'name', label: 'Nome ou identificação anônima' },
    { key: 'role', label: 'Cargo' },
    { key: 'department', label: 'Departamento' },
    { key: 'contract', label: 'Vínculo', kind: 'select', options: options(['CLT', 'PJ', 'Outro']) },
    { key: 'salary', label: 'Salário / honorários (R$)', kind: 'money' },
    { key: 'benefits', label: 'Benefícios mensais (R$)', kind: 'money' },
    {
      key: 'charges_bps',
      label: 'Encargos e provisões (pontos-base)',
      kind: 'number',
      hint: 'Premissa editável: 3500 = 35%. Inclua provisões; valide com sua contabilidade.',
    },
    { key: 'other_costs', label: 'Outros custos mensais (R$)', kind: 'money' },
    { key: 'start_date', label: 'Admissão', kind: 'date' },
  ],
};
export const entityLabels: Record<Entity, string> = {
  transactions: 'movimento',
  business_transactions: 'movimento empresarial',
  financial_accounts: 'conta',
  goals: 'meta',
  debts: 'dívida',
  assets: 'bem',
  budgets: 'orçamento',
  business_budgets: 'orçamento da área',
  employees: 'pessoa',
};
function defaults(entity: Entity): Record<string, unknown> {
  const today = civilDate();
  const common = { id: crypto.randomUUID() };
  const values: Record<Entity, Record<string, unknown>> = {
    transactions: {
      description: '',
      amount: 0,
      type: 'expense',
      category: 'Alimentação',
      date: today,
      status: 'paid',
      source: 'manual',
      account_id: null,
    },
    business_transactions: {
      description: '',
      amount: 0,
      type: 'expense',
      category: 'Operações',
      date: today,
      status: 'paid',
      source: 'manual',
      account_id: null,
    },
    financial_accounts: { name: '', kind: 'checking', opening_balance: 0, closing_day: null, due_day: null },
    goals: {
      name: '',
      target: 0,
      saved: 0,
      monthly_contribution: 0,
      deadline: shiftMonths(today, 6),
      priority: 'medium',
    },
    debts: { name: '', balance: 0, rate_bps: 0, minimum: 0, due_date: today, overdue: false },
    assets: { name: '', value: 0, kind: 'other' },
    budgets: { category: 'Alimentação', limit_amount: 0, month: today.slice(0, 7) },
    business_budgets: { category: 'Operações', limit_amount: 0, month: today.slice(0, 7) },
    employees: {
      name: '',
      role: '',
      department: 'Tecnologia',
      contract: 'PJ',
      salary: 0,
      benefits: 0,
      charges_bps: 0,
      other_costs: 0,
      start_date: today,
    },
  };
  return { ...common, ...values[entity] };
}
export function Editor<K extends Entity>({
  entity,
  initial,
  onClose,
}: {
  entity: K;
  initial?: EntityMap[K];
  onClose: () => void;
}) {
  const app = useApp();
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const value = initial ? { ...initial } : defaults(entity);
    const result: Record<string, unknown> = { ...value };
    fields[entity].forEach((f) => {
      if (f.kind === 'money') result[f.key] = (Number(result[f.key]) / 100).toFixed(2).replace('.', ',');
    });
    return result;
  });
  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const value = { ...values };
      fields[entity].forEach((f) => {
        if (f.kind === 'money') value[f.key] = parseMoney(String(value[f.key]));
        if (f.kind === 'number')
          value[f.key] = value[f.key] === '' || value[f.key] === null ? null : Number(value[f.key]);
      });
      if (value.account_id === '') value.account_id = null;
      const parsed = entitySchemas[entity].parse(value) as EntityMap[K];
      await app.repository.save(entity, parsed, app.organizationId);
      await app.refresh();
      app.toast('Registro salvo. Seus números foram atualizados.');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(
              /\[\s*\{[\s\S]*/,
              'Confira os valores preenchidos. Valores devem ser positivos e datas válidas.',
            )
          : 'Não foi possível salvar.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog title={`${initial ? 'Editar' : 'Adicionar'} ${entityLabels[entity]}`} onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <div className="form-grid">
          {fields[entity].map((field) => {
            const choices =
              field.key === 'account_id'
                ? [
                    { value: '', label: 'Sem conta vinculada' },
                    ...app.data.financial_accounts.map((a) => ({ value: a.id, label: a.name })),
                  ]
                : field.options;
            return (
              <label key={field.key} className={field.kind === 'checkbox' ? 'check-label' : ''}>
                {field.label}
                {field.kind === 'select' ? (
                  <select
                    value={String(values[field.key] ?? '')}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  >
                    {choices?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.key])}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.checked })}
                  />
                ) : (
                  <input
                    autoFocus={field.key === fields[entity][0].key}
                    type={['number', 'date', 'month'].includes(field.kind ?? '') ? field.kind : 'text'}
                    inputMode={field.kind === 'money' ? 'decimal' : undefined}
                    required={!['closing_day', 'due_day'].includes(field.key)}
                    maxLength={180}
                    value={String(values[field.key] ?? '')}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                )}
                {field.hint && <small>{field.hint}</small>}
              </label>
            );
          })}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending} type="submit">
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
