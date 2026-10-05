import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Button, Card, Dialog } from '../design-system/components';
import { categories, transactionSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
import { civilDate, formatMoney, parseMoney, shiftMonths } from '../../shared/financial-engine';
import { monthlyFlow } from '../../shared/insights';

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

export function MoneyForm({
  type,
  existing,
  onClose,
}: {
  type: Transaction['type'];
  existing?: Transaction;
  onClose: () => void;
}) {
  const app = useApp();
  const today = civilDate(new Date(), app.data.profile.timezone);
  const [id] = useState(() => existing?.id ?? crypto.randomUUID());
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [category, setCategory] = useState(existing?.category ?? 'Outros');
  const [account, setAccount] = useState(existing?.account_id ?? '');
  const [status, setStatus] = useState<Transaction['status']>(existing?.status ?? 'paid');
  const [kind, setKind] = useState(type);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    let value: Transaction;
    try {
      if (date > today && status === 'paid')
        throw new Error('Para uma data futura, marque “Ainda não aconteceu” nos detalhes.');
      value = transactionSchema.parse({
        id,
        description,
        amount: parseMoney(amount),
        type: kind,
        category,
        date,
        status,
        source: existing?.source ?? 'manual',
        account_id: account || null,
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith('Para uma data futura')
          ? err.message
          : 'Confira o valor (por exemplo, 25,50), a descrição e a data.',
      );
      return;
    }
    setPending(true);
    try {
      await app.repository.save('transactions', value, null);
      setSaved(true);
      await app.refresh();
    } catch {
      setError('Não foi possível salvar. Confira sua conexão e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={
        saved
          ? 'Tudo certo!'
          : existing
            ? 'Corrigir anotação'
            : kind === 'expense'
              ? 'Anotar um gasto'
              : 'Anotar uma entrada'
      }
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      {saved ? (
        <div className="money-success" role="status">
          <CheckCircle2 size={48} />
          <h3>Anotação salva.</h3>
          <p>
            {description} · {formatMoney(parseMoney(amount))}
          </p>
          <p className="muted">Você pode corrigir depois em “Anotações”.</p>
          <Button onClick={onClose}>Concluir</Button>
        </div>
      ) : (
        <form className="simple-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={pending} className="simple-form">
            <label>
              Quanto foi? (R$)
              <input
                autoFocus
                data-dialog-autofocus
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="money-input"
              />
            </label>
            <label>
              {kind === 'expense' ? 'Com o quê?' : 'De onde veio?'}
              <input
                placeholder={
                  kind === 'expense' ? 'Ex.: mercado, farmácia, conta de luz' : 'Ex.: aposentadoria, salário'
                }
                maxLength={180}
                minLength={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <label>
              Quando?
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <small>{date === today ? 'Hoje' : 'Confira a data da anotação.'}</small>
            </label>
            <details className="simple-details">
              <summary>Mais detalhes (opcional)</summary>
              <div className="simple-form">
                <label>
                  Gasto ou entrada?
                  <select value={kind} onChange={(e) => setKind(e.target.value as Transaction['type'])}>
                    <option value="expense">Gasto</option>
                    <option value="income">Entrada</option>
                  </select>
                </label>
                <label>
                  Categoria
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {!categories.some((c) => c === category) && <option>{category}</option>}
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Já aconteceu?
                  <select value={status} onChange={(e) => setStatus(e.target.value as Transaction['status'])}>
                    <option value="paid">Sim, já paguei ou recebi</option>
                    <option value="planned">Ainda não aconteceu</option>
                  </select>
                </label>
                {app.data.financial_accounts.length > 0 && (
                  <label>
                    Onde movimentou o dinheiro?
                    <select value={account} onChange={(e) => setAccount(e.target.value)}>
                      <option value="">Não informar</option>
                      {app.data.financial_accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </details>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar anotação'}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
          </fieldset>
        </form>
      )}
    </Dialog>
  );
}

export function SimpleHome() {
  const app = useApp();
  const connection = useQuery({
    queryKey: ['whatsapp-connection', app.user?.id],
    queryFn: () =>
      invoke<{
        connected: boolean;
        chat_url: string;
        delivery_status: string | null;
        reply_error_code: number | null;
        phone_last_four: string | null;
      }>('whatsapp-link', { action: 'status' }),
    enabled: !app.demo && Boolean(app.user),
    retry: false,
    staleTime: 30_000,
  });
  const [adding, setAdding] = useState<Transaction['type'] | null>(null);
  const today = civilDate(new Date(), app.data.profile.timezone);
  const flow = monthlyFlow(
    app.data.transactions.filter((t) => t.date <= today),
    today.slice(0, 7),
  );
  const recent = app.data.transactions
    .filter((t) => t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return (
    <>
      <header className="simple-heading">
        <p className="muted">Seu dinheiro, sem complicação</p>
        <h1>Olá, {app.data.profile.name.split(' ')[0]}.</h1>
        <p>Vamos acompanhar suas anotações?</p>
      </header>
      <section className="whatsapp-home">
        <MessageCircle size={36} />
        <div>
          <h2>É só falar. O Nexo anota.</h2>
          <p>Envie uma mensagem ou um áudio contando o que gastou ou recebeu.</p>
          {connection.data?.connected ? (
            <a
              className="button button-primary"
              href={connection.data.chat_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir meu WhatsApp <ArrowUpRight size={20} />
            </a>
          ) : (
            <Link className="button button-primary" to="/integracoes">
              {app.demo ? 'Conhecer o WhatsApp' : 'Conectar meu WhatsApp'} <ChevronRight size={20} />
            </Link>
          )}
        </div>
      </section>
      {!app.demo && (
        <p className="notice">
          O WhatsApp aguarda liberação da Meta para responder. Por enquanto, use “Anotar gasto” ou “Anotar
          entrada” aqui no app. Confira suas anotações antes de repetir uma mensagem.
        </p>
      )}
      <Card className="simple-summary">
        <div className="simple-section-title">
          <h2>Seu mês até agora</h2>
          <span>{monthLabel(today.slice(0, 7))}</span>
        </div>
        <div className="simple-totals">
          <div>
            <span>Entrou</span>
            <strong className="positive">{formatMoney(flow.income)}</strong>
          </div>
          <div>
            <span>Saiu</span>
            <strong>{formatMoney(flow.expenses)}</strong>
          </div>
          <div className="simple-net">
            <span>{flow.net < 0 ? 'Faltou no mês' : 'Sobrou no mês'}</span>
            <strong>{formatMoney(Math.abs(flow.net))}</strong>
          </div>
        </div>
        <p className="muted">Pelas anotações deste mês. Esse valor não é o saldo da sua conta bancária.</p>
        {flow.count === 0 && <p>Comece anotando algo que recebeu ou gastou.</p>}
      </Card>
      <section>
        <h2 className="manual-title">Prefere anotar por aqui?</h2>
        <div className="money-actions">
          <button className="money-action expense-action" onClick={() => setAdding('expense')}>
            <span>
              <ArrowUpRight size={28} />
            </span>
            <strong>Anotar gasto</strong>
            <small>Algo que você pagou</small>
          </button>
          <button className="money-action income-action" onClick={() => setAdding('income')}>
            <span>
              <ArrowDownLeft size={28} />
            </span>
            <strong>Anotar entrada</strong>
            <small>Dinheiro que recebeu</small>
          </button>
        </div>
      </section>
      <Card>
        <div className="simple-section-title">
          <h2>Últimas anotações</h2>
          <Link className="text-link" to="/movimentos">
            Ver todas <ChevronRight size={18} />
          </Link>
        </div>
        {recent.length ? (
          <MoneyRows rows={recent} />
        ) : (
          <p className="muted">Ainda não há anotações. Use os botões acima para começar.</p>
        )}
      </Card>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function MoneyRows({ rows }: { rows: Transaction[] }) {
  const app = useApp();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!deleting) return;
    setPending(true);
    setError('');
    try {
      await app.repository.remove('transactions', deleting.id, null);
      setDeleting(null);
      await app.refresh();
      app.toast('Anotação excluída.');
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <ul className="money-list">
        {rows.map((t) => (
          <li key={t.id}>
            <div className="money-row-top">
              <span className={`money-kind ${t.type}`} aria-hidden="true">
                {t.type === 'income' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
              </span>
              <div className="money-description">
                <h3>{t.description}</h3>
                <p className="muted">
                  {new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${t.date}T12:00:00Z`))}
                  {t.source === 'whatsapp' ? ' · WhatsApp' : ''}
                </p>
              </div>
              <strong className={t.type === 'income' ? 'positive' : ''}>
                <span className="sr-only">{t.type === 'income' ? 'Entrada' : 'Gasto'}</span>
                {t.type === 'income' ? '+' : '−'} {formatMoney(t.amount)}
              </strong>
            </div>
            <div className="money-row-bottom">
              <span className="muted">
                {t.status === 'planned' ? 'Ainda não aconteceu' : t.type === 'income' ? 'Recebido' : 'Pago'}
              </span>
              <div>
                <Button
                  variant="ghost"
                  aria-label={`Corrigir ${t.description}`}
                  onClick={() => setEditing(t)}
                >
                  <Pencil size={16} /> Corrigir
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Excluir ${t.description}`}
                  onClick={() => {
                    setError('');
                    setDeleting(t);
                  }}
                >
                  <Trash2 size={16} /> Excluir
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {editing && <MoneyForm type={editing.type} existing={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Dialog
          title="Excluir esta anotação?"
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <div className="simple-form">
            <p>
              {deleting.description} · {formatMoney(deleting.amount)}
            </p>
            <p>Ela será retirada do seu resumo. Se precisar, você poderá anotar novamente.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              {pending ? 'Excluindo…' : 'Sim, excluir anotação'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>
              Não, voltar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SimpleHistory() {
  const app = useApp();
  const [month, setMonth] = useState(() => civilDate(new Date(), app.data.profile.timezone).slice(0, 7));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState<Transaction['type'] | null>(null);
  const rows = app.data.transactions
    .filter(
      (t) =>
        t.date.startsWith(month) &&
        (filter === 'all' || t.type === filter) &&
        t.description.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <header className="simple-heading">
        <h1>Suas anotações</h1>
        <p>Veja o que entrou e saiu. Toque em “Corrigir” para mudar algo.</p>
      </header>
      <div className="simple-inline-actions">
        <Button onClick={() => setAdding('expense')}>Anotar gasto</Button>
        <Button variant="secondary" onClick={() => setAdding('income')}>
          Anotar entrada
        </Button>
      </div>
      <Card>
        <div className="month-picker">
          <Button
            variant="secondary"
            aria-label="Mês anterior"
            onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}
          >
            <ChevronLeft />
          </Button>
          <label>
            Mês das anotações
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <Button
            variant="secondary"
            aria-label="Próximo mês"
            onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
        <label className="history-search">
          Buscar uma anotação
          <input
            type="search"
            placeholder="Ex.: mercado"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="history-filters" role="group" aria-label="Mostrar anotações">
          {[
            ['all', 'Todas'],
            ['expense', 'Gastos'],
            ['income', 'Entradas'],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? 'primary' : 'secondary'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {rows.length ? (
          <MoneyRows rows={rows} />
        ) : (
          <div className="simple-empty">
            <h2>Nenhuma anotação por aqui.</h2>
            <p>Confira o mês e a busca, ou anote seu primeiro gasto.</p>
          </div>
        )}
      </Card>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
