import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Calculator, History, Plus, Wallet } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button, Dialog } from '../design-system/components';
import {
  redactFinancialText,
  useFinancialVisibility,
  useMoneyDisplay,
} from '../design-system/financial-visibility';
import { accountSchema } from '../../shared/domain';
import { civilDate, parseMoney, shiftDays, shiftMonths } from '../../shared/financial-engine';
import {
  invoiceFor,
  merchantKey,
  spendingAllowance,
  spendingSignals,
} from '../../shared/financial-decisions';
type Tool = 'cash' | 'patterns' | 'cards' | 'history' | 'categories' | 'metrics';
export function FinancialTools() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const { visible } = useFinancialVisibility();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [tool, setTool] = useState<Tool>('cash');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [cash, setCash] = useState('');
  const [confirmed, setConfirmed] = useState(today);
  const [next, setNext] = useState(shiftDays(today, 15));
  const [reserve, setReserve] = useState('0');
  const [goals, setGoals] = useState('0');
  const [income, setIncome] = useState('0');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof spendingAllowance> | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [cardForm, setCardForm] = useState(false);
  const [cardName, setCardName] = useState('');
  const [closing, setClosing] = useState(10);
  const [due, setDue] = useState(20);
  const [limit, setLimit] = useState('0');
  const [restoring, setRestoring] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ['history', app.user?.id],
    enabled: tool === 'history' && !app.demo && !!app.user,
    retry: false,
    queryFn: async () => {
      const response = await supabase!
        .from('transaction_history')
        .select('*')
        .eq('user_id', app.user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (response.error) throw new Error('Não foi possível carregar histórico.');
      return response.data;
    },
  });
  const metrics = useQuery({
    queryKey: ['metrics', app.user?.id],
    enabled: tool === 'metrics' && !app.demo && !!app.user,
    retry: false,
    queryFn: async () => {
      const response = await supabase!
        .from('operation_metrics')
        .select('operation,latency_ms,success,input_tokens,output_tokens,audio_seconds,created_at')
        .eq('user_id', app.user!.id)
        .gte('created_at', `${today.slice(0, 7)}-01`)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (response.error) throw new Error('Não foi possível carregar métricas.');
      return response.data;
    },
  });
  async function action(operation: () => Promise<void>) {
    setPending(true);
    setError('');
    try {
      await operation();
      await app.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setPending(false);
    }
  }
  const signals = spendingSignals(app.data.transactions, today);
  const tools = [
    { key: 'cash', label: 'Posso gastar?' },
    { key: 'patterns', label: 'Sugestões' },
    { key: 'cards', label: 'Faturas' },
    { key: 'history', label: 'Histórico' },
    { key: 'categories', label: 'Preferências' },
    { key: 'metrics', label: 'Operação' },
  ] as const;
  const secondaryTools = tool === 'history' || tool === 'categories' || tool === 'metrics';
  const heading = tools.find((item) => item.key === tool)?.label ?? 'Posso gastar?';
  const activate = (key: Tool) => {
    setTool(key);
    setError('');
  };
  return (
    <>
      <header className="simple-heading">
        <h1>{heading}</h1>
        <p>Decisões com seus dados e premissas visíveis.</p>
      </header>
      <div className="simple-inline-actions" role="group" aria-label="Decisão financeira">
        {tools.slice(0, 3).map((item) => (
          <Button
            key={item.key}
            variant={tool === item.key ? 'primary' : 'secondary'}
            aria-pressed={tool === item.key}
            onClick={() => activate(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <details className="financial-more" open={secondaryTools}>
        <summary>Mais ferramentas</summary>
        <div className="simple-inline-actions" role="group" aria-label="Outras ferramentas">
          {tools.slice(3).map((item) => (
            <Button
              key={item.key}
              variant={tool === item.key ? 'primary' : 'secondary'}
              aria-pressed={tool === item.key}
              onClick={() => activate(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </details>
      {tool === 'cash' && (
        <form
          className="simple-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            try {
              if (!app.demo && !navigator.onLine)
                throw new Error(
                  'Reconecte para conferir todas as contas pendentes antes de calcular disponibilidade.',
                );
              if (!consent) throw new Error('Confirme o valor disponível.');
              setResult(
                spendingAllowance(
                  {
                    cash: parseMoney(cash),
                    confirmed_on: confirmed,
                    next_income_date: next,
                    protected_amount: parseMoney(reserve),
                    goal_amount: parseMoney(goals),
                    estimated_income: parseMoney(income),
                  },
                  app.data.transactions,
                  today,
                ),
              );
            } catch (err) {
              setResult(null);
              setError(err instanceof Error ? err.message : 'Confira seus valores.');
            }
          }}
        >
          <h2>Posso gastar?</h2>
          <label>
            Dinheiro disponível confirmado (R$)
            <input
              required
              inputMode="decimal"
              value={cash}
              onChange={(event) => {
                setCash(event.target.value);
                setConsent(false);
                setResult(null);
              }}
            />
          </label>
          <label>
            Conferido em
            <input
              required
              type="date"
              max={today}
              value={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.value);
                setConsent(false);
                setResult(null);
              }}
            />
          </label>
          <label>
            Próximo recebimento
            <input
              required
              type="date"
              min={today}
              value={next}
              onChange={(event) => {
                setNext(event.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Renda esperada (não recebida) (R$)
            <input
              inputMode="decimal"
              value={income}
              onChange={(event) => {
                setIncome(event.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Reserva que não quer gastar (R$)
            <input
              inputMode="decimal"
              value={reserve}
              onChange={(event) => {
                setReserve(event.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Separado em Caixinhas (R$)
            <input
              inputMode="decimal"
              value={goals}
              onChange={(event) => {
                setGoals(event.target.value);
                setResult(null);
              }}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setResult(null);
              }}
            />
            Confirmei o dinheiro disponível, sem somar limite de crédito. Os valores protegidos não se
            sobrepõem.
          </label>
          <div>
            <Button disabled={!consent}>
              <Calculator size={18} />
              Calcular com minhas premissas
            </Button>
          </div>
          {result && (
            <section className="verified-answer" aria-live="polite">
              <h2>
                {result.needs_confirmation
                  ? 'Confirme o saldo de hoje antes de usar o resultado'
                  : `Limite calculado: ${displayMoney(result.allowed)}`}
              </h2>
              {result.shortfall > 0 && (
                <p className="error-message">
                  Faltam {displayMoney(result.shortfall)} para cobrir as premissas.
                </p>
              )}
              <ul>
                {result.calculation.map((line) => (
                  <li key={line}>{visible ? line : redactFinancialText(line)}</li>
                ))}
              </ul>
              <h3>Contas consideradas</h3>
              <ul className="evidence-list">
                {result.bills.map((row) => (
                  <li key={row.id}>
                    {row.description} · {row.date} · {displayMoney(row.amount)}
                  </li>
                ))}
              </ul>
              <p className="muted">Outras contas ou gastos não anotados mudam o resultado.</p>
            </section>
          )}
        </form>
      )}
      {tool === 'patterns' && (
        <section className="simple-form">
          <h2>Padrões para conferir</h2>
          {signals.length ? (
            signals.map((signal, index) => (
              <article key={`${signal.kind}:${index}`} className="verified-answer">
                <h3>{visible ? signal.title : redactFinancialText(signal.title)}</h3>
                <p>{visible ? signal.explanation : redactFinancialText(signal.explanation)}</p>
                <ul className="evidence-list">
                  {signal.records.map((row) => (
                    <li key={row.id}>
                      {row.date} · {displayMoney(row.amount)}
                    </li>
                  ))}
                </ul>
                {signal.kind === 'subscription' && (
                  <Button
                    disabled={pending}
                    variant="secondary"
                    onClick={() =>
                      void action(async () => {
                        const last = signal.records.at(-1)!;
                        if (
                          app.data.recurring_rules.some(
                            (rule) =>
                              merchantKey(rule.description) === merchantKey(last.description) && rule.active,
                          )
                        )
                          throw new Error('Já existe recorrência ativa para este estabelecimento.');
                        await app.repository.saveRecurring({
                          id: crypto.randomUUID(),
                          description: last.description,
                          amount: last.amount,
                          category: last.category,
                          start_date: shiftMonths(last.date, 1),
                          active: true,
                          type: 'expense',
                          frequency: 'monthly',
                          end_date: null,
                          annual_adjustment_bps: 0,
                        });
                      })
                    }
                  >
                    <Check size={18} />
                    Confirmar como recorrência
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p className="muted">Ainda não há evidências suficientes para sugerir padrões.</p>
          )}
        </section>
      )}
      {tool === 'cards' && (
        <section className="simple-form">
          <h2>Faturas por ciclo</h2>
          <label>
            Mês da fatura
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <div>
            <Button onClick={() => setCardForm(true)}>
              <Plus size={18} />
              Cadastrar cartão
            </Button>
          </div>
          {app.data.financial_accounts
            .filter((account) => account.kind === 'credit')
            .map((account) => {
              if (!account.closing_day || !account.due_day)
                return <p key={account.id}>Configure fechamento e vencimento de {account.name}.</p>;
              const invoice = invoiceFor(
                app.data.transactions,
                account.id,
                account.closing_day,
                account.due_day,
                month,
              );
              return (
                <article key={account.id} className="verified-answer">
                  <h3>
                    <Wallet size={18} />
                    {account.name}
                  </h3>
                  <p>
                    Fechamento: dia {account.closing_day} · vencimento: {invoice.due}
                  </p>
                  <p>Compras e parcelas no ciclo: {displayMoney(invoice.total)}</p>
                  <p className="muted">
                    Limite informado: {displayMoney(account.credit_limit ?? 0)}. Não é dinheiro disponível nem
                    confirmação de pagamento da fatura.
                  </p>
                  <ul className="evidence-list">
                    {invoice.records.map((row) => (
                      <li key={row.id}>
                        {row.description} · {row.date} · {displayMoney(row.amount)}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
        </section>
      )}
      {tool === 'categories' && (
        <section className="simple-form">
          <h2>Preferências para próximos registros</h2>
          {app.data.category_preferences.length ? (
            app.data.category_preferences.map((item) => (
              <article className="plan-row" key={item.merchant}>
                <div>
                  <h3>{item.merchant}</h3>
                  <p>{item.category}</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void action(() => app.repository.categoryPreference(item.merchant, null))}
                >
                  Desfazer preferência
                </Button>
              </article>
            ))
          ) : (
            <p>
              Nenhuma preferência autorizada. Você pode autorizar ao corrigir a categoria de uma anotação.
            </p>
          )}
        </section>
      )}
      {tool === 'history' && (
        <section className="simple-form">
          <h2>
            <History size={18} />
            Histórico de alterações
          </h2>
          <p className="muted">
            Versões registradas a partir da ativação do histórico. Restaurar exige que o registro não tenha
            mudado desde aquela versão.
          </p>
          {app.demo ? (
            <p>O histórico seguro está disponível em contas reais; a demonstração não fabrica versões.</p>
          ) : history.isError ? (
            <p role="alert">Não foi possível carregar versões.</p>
          ) : history.isPending ? (
            <p role="status">Carregando…</p>
          ) : (
            history.data?.map((version) => (
              <article key={version.id} className="verified-answer">
                <h3>{version.after_data?.description ?? version.before_data?.description}</h3>
                <p>
                  {version.operation} · {new Date(version.created_at).toLocaleString('pt-BR')} ·{' '}
                  {version.actor_id === app.user?.id
                    ? 'Você'
                    : 'Serviço ou familiar identificado no registro'}
                </p>
                <p>
                  Antes:{' '}
                  {version.before_data ? displayMoney(Number(version.before_data.amount)) : 'Não existia'} ·
                  depois: {version.after_data ? displayMoney(Number(version.after_data.amount)) : 'Excluído'}
                </p>
                {version.before_data && (
                  <Button variant="secondary" disabled={pending} onClick={() => setRestoring(version.id)}>
                    Revisar restauração
                  </Button>
                )}
              </article>
            ))
          )}
        </section>
      )}
      {tool === 'metrics' && (
        <section className="simple-form">
          <h2>Operação deste mês</h2>
          <p className="muted">
            Eventos técnicos sem descrição, valor financeiro ou áudio armazenado. Tokens não são preço: o
            custo monetário depende da tarifa do modelo.
          </p>
          {app.demo ? (
            <p>A demonstração não simula custos de API.</p>
          ) : metrics.isError ? (
            <p role="alert">Não foi possível consultar métricas.</p>
          ) : metrics.isPending ? (
            <p role="status">Carregando…</p>
          ) : (
            <>
              <p>
                {metrics.data?.length ?? 0} operações recentes ·{' '}
                {metrics.data?.filter((row) => !row.success).length ?? 0} falhas
              </p>
              <ul className="evidence-list">
                {metrics.data?.map((row, index) => (
                  <li key={index}>
                    {row.operation} · {row.latency_ms} ms · {row.success ? 'sucesso' : 'falha'} ·{' '}
                    {row.input_tokens ?? '?'} tokens de entrada · {row.output_tokens ?? '?'} de saída
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {cardForm && (
        <Dialog
          title="Cadastrar cartão"
          onClose={() => {
            if (!pending) setCardForm(false);
          }}
        >
          <form
            className="simple-form"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await app.repository.save(
                  'financial_accounts',
                  accountSchema.parse({
                    id: crypto.randomUUID(),
                    name: cardName,
                    kind: 'credit',
                    opening_balance: 0,
                    closing_day: closing,
                    due_day: due,
                    credit_limit: parseMoney(limit),
                  }),
                  null,
                );
                setCardForm(false);
              });
            }}
          >
            <label>
              Nome do cartão
              <input
                required
                minLength={2}
                maxLength={80}
                value={cardName}
                onChange={(event) => setCardName(event.target.value)}
              />
            </label>
            <label>
              Dia de fechamento
              <input
                type="number"
                min={1}
                max={31}
                value={closing}
                onChange={(event) => setClosing(Number(event.target.value))}
              />
            </label>
            <label>
              Dia de vencimento
              <input
                type="number"
                min={1}
                max={31}
                value={due}
                onChange={(event) => setDue(Number(event.target.value))}
              />
            </label>
            <label>
              Limite informado (R$)
              <input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending}>Salvar cartão</Button>
          </form>
        </Dialog>
      )}
      {restoring && (
        <Dialog
          title="Restaurar versão anterior?"
          onClose={() => {
            if (!pending) setRestoring(null);
          }}
        >
          <div className="simple-form">
            <p>
              O banco vai conferir sua permissão e se a versão ainda corresponde ao registro atual. A
              restauração também ficará no histórico.
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button
              disabled={pending}
              onClick={() =>
                void action(async () => {
                  const response = await supabase!.rpc('restore_transaction_version', {
                    version_id: restoring,
                  });
                  if (response.error)
                    throw new Error('A versão mudou ou não está disponível para restaurar.');
                  setRestoring(null);
                  await history.refetch();
                })
              }
            >
              Confirmar restauração
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRestoring(null)}>
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
