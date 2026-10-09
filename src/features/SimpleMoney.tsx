import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Sparkles,
  MessageCircle,
  FileUp,
  Pencil,
  Trash2,
  Camera,
  Mic,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Button, Dialog, Progress } from '../design-system/components';
import { useMoneyDisplay } from '../design-system/financial-visibility';
import { categories, transactionSchema } from '../../shared/domain';
import type { Transaction } from '../../shared/domain';
import { civilDate, formatMoney, parseMoney, shiftDays, shiftMonths, sum } from '../../shared/financial-engine';
import { monthlyFlow } from '../../shared/insights';
import { goalMonthlyBudget, goalMonthlyPlan } from '../../shared/journey';
import { merchantKey } from '../../shared/financial-decisions';
import { useCaptureFlow } from '../design-system/capture-flow';

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
function movementDateLabel(date: string, today: string) {
  if (date === today) return 'Hoje';
  if (date === shiftDays(today, -1)) return 'Ontem';
  return dateLabel(date);
}
function historyGroupLabel(date: string, today: string) {
  if (date === today) return 'Hoje';
  if (date === shiftDays(today, -1)) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
function normalizeHistorySearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}
function fullDateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

const sourceLabels: Record<Transaction['source'], string> = {
  manual: 'Anotado no app',
  whatsapp: 'WhatsApp',
  import: 'Arquivo importado',
};

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
  /*
    const app = useApp();
    const today = civilDate(new Date(), app.data.profile.timezone);
    const currentMonth = today.slice(0, 7);
    const [month, setMonth] = useState(currentMonth);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [monthOpen, setMonthOpen] = useState(false);
    const [otherMonthOpen, setOtherMonthOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
    const [pendingOnly, setPendingOnly] = useState(false);
    const [sourceFilters, setSourceFilters] = useState<Transaction['source'][]>([]);
    const [draftType, setDraftType] = useState<'all' | 'expense' | 'income'>('all');
    const [draftPendingOnly, setDraftPendingOnly] = useState(false);
    const [draftSources, setDraftSources] = useState<Transaction['source'][]>([]);
    const [adding, setAdding] = useState<Transaction['type'] | null>(null);
    const recentMonths = Array.from({ length: 4 }, (_, index) =>
      shiftMonths(`${currentMonth}-01`, -index).slice(0, 7),
    );
    const monthChoices = recentMonths.includes(month) ? recentMonths : [month, ...recentMonths.slice(0, 3)];
    const normalizedSearch = normalizeHistorySearch(search);
    const rows = app.data.transactions
      .filter((transaction) => {
        if (!transaction.date.startsWith(month)) return false;
        if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
        if (pendingOnly && transaction.status !== 'planned') return false;
        if (sourceFilters.length && !sourceFilters.includes(transaction.source)) return false;
        if (!normalizedSearch) return true;
        const searchableValues = [
          transaction.description,
          transaction.category,
          sourceLabels[transaction.source],
          formatMoney(transaction.amount),
        ];
        return searchableValues.some((value) => normalizeHistorySearch(value).includes(normalizedSearch));
      })
      .sort((first, second) => second.date.localeCompare(first.date));
    const groups = rows.reduce<{ date: string; label: string; rows: Transaction[] }[]>((result, transaction) => {
      const lastGroup = result[result.length - 1];
      if (lastGroup?.date === transaction.date) lastGroup.rows.push(transaction);
      else result.push({ date: transaction.date, label: historyGroupLabel(transaction.date, today), rows: [transaction] });
      return result;
    }, []);
    const hasAppliedFilters = typeFilter !== 'all' || pendingOnly || sourceFilters.length > 0;
    const hasNoResults = rows.length === 0;
    const hasNoTransactions = app.data.transactions.length === 0;
    function clearFilters() {
      setTypeFilter('all');
      setPendingOnly(false);
      setSourceFilters([]);
      setSearch('');
    }
    function applyDraftFilters() {
      setTypeFilter(draftType);
      setPendingOnly(draftPendingOnly);
      setSourceFilters(draftSources);
      setFiltersOpen(false);
    }
    function clearDraftFilters() {
      setDraftType('all');
      setDraftPendingOnly(false);
      setDraftSources([]);
    }
    function toggleDraftSource(source: Transaction['source']) {
      setDraftSources((current) =>
        current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
      );
    }
    function removeSourceFilter(source: Transaction['source']) {
      setSourceFilters((current) => current.filter((item) => item !== source));
    }
    return (
      <div className="history-page">
        <header className="history-heading">
          <h1>Histórico</h1>
          <div className="history-heading-actions">
            <Button
              variant="ghost"
              aria-label={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
              title={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </Button>
            <Button
              variant="ghost"
              aria-label="Filtrar histórico"
              title="Filtrar histórico"
              aria-expanded={filtersOpen}
              onClick={() => {
                setDraftType(typeFilter);
                setDraftPendingOnly(pendingOnly);
                setDraftSources(sourceFilters);
                setFiltersOpen(true);
              }}
            >
              <SlidersHorizontal size={20} /> <span>Filtrar</span>
            </Button>
            <div className="history-overflow">
              <Button
                variant="ghost"
                aria-label="Mais opções do histórico"
                title="Mais opções"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreVertical size={20} />
              </Button>
              {menuOpen && (
                <div className="history-overflow-menu" role="menu">
                  <button role="menuitem" onClick={() => { setAdding('expense'); setMenuOpen(false); }}>
                    Anotar gasto
                  </button>
                  <button role="menuitem" onClick={() => { setAdding('income'); setMenuOpen(false); }}>
                    Anotar entrada
                  </button>
                  <Link role="menuitem" to="/perfil" onClick={() => setMenuOpen(false)}>
                    Meu perfil
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        {searchOpen && (
          <label className="history-search">
            Buscar no histórico
            <span className="history-search-control">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                placeholder="Descrição, categoria, origem ou valor"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}>
                  <X size={18} />
                </button>
              )}
            </span>
          </label>
        )}
        <div className="history-month-bar">
          <Button
            variant="ghost"
            aria-label="Mês anterior"
            title="Mês anterior"
            onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}
          >
            <ChevronLeft size={22} />
          </Button>
          <button className="history-month-current" onClick={() => setMonthOpen(true)}>
            {monthLabel(month)}
          </button>
          <Button
            variant="ghost"
            aria-label="Próximo mês"
            title="Próximo mês"
            onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}
          >
            <ChevronRight size={22} />
          </Button>
        </div>
        {(search || hasAppliedFilters) && (
          <div className="history-active-filters" aria-label="Filtros ativos">
            {search && (
              <button onClick={() => setSearch('')} aria-label="Remover busca">
                Busca: {search} <X size={14} />
              </button>
            )}
            {typeFilter !== 'all' && (
              <button onClick={() => setTypeFilter('all')}>
                {typeFilter === 'expense' ? 'Gastos' : 'Entradas'} <X size={14} />
              </button>
            )}
            {pendingOnly && (
              <button onClick={() => setPendingOnly(false)}>
                Pendentes <X size={14} />
              </button>
            )}
            {sourceFilters.map((source) => (
              <button key={source} onClick={() => removeSourceFilter(source)}>
                {source === 'manual' ? 'Aplicativo' : source === 'whatsapp' ? 'WhatsApp' : 'Arquivo'} <X size={14} />
              </button>
            ))}
            <button className="history-clear-filters" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
        {hasNoResults ? (
          <div className="history-empty">
            <h2>
              {hasNoTransactions
                ? 'Nada por aqui ainda.'
                : hasAppliedFilters || search
                  ? 'Nenhum resultado.'
                  : 'Nenhum movimento neste mês.'}
            </h2>
            {hasNoTransactions ? (
              <>
                <p>Mande seu primeiro gasto pelo WhatsApp.</p>
                <Link className="button button-primary" to="/integracoes">Abrir WhatsApp</Link>
              </>
            ) : hasAppliedFilters || search ? (
              <>
                <p>Tente mudar a busca ou os filtros.</p>
                <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>
              </>
            ) : (
              <p>Escolha outro mês para consultar seus registros.</p>
            )}
          </div>
        ) : (
          <div className="history-timeline">
            {groups.map((group) => (
              <section className="history-day-group" key={group.date} aria-labelledby={`history-day-${group.date}`}>
                <h2 id={`history-day-${group.date}`}>{group.label}</h2>
                <MoneyRows rows={group.rows} timeline />
              </section>
            ))}
          </div>
        )}
        {monthOpen && (
          <Dialog title="Escolher período" className="capture-sheet history-sheet" onClose={() => setMonthOpen(false)}>
            <div className="history-month-options">
              {monthChoices.map((option) => (
                <button
                  key={option}
                  aria-pressed={month === option}
                  onClick={() => { setMonth(option); setMonthOpen(false); }}
                >
                  {monthLabel(option)}
                </button>
              ))}
            </div>
            {otherMonthOpen ? (
              <label className="history-other-month">
                Escolher outra data
                <input
                  type="month"
                  value={month}
                  onChange={(event) => {
                    if (event.target.value) {
                      setMonth(event.target.value);
                      setMonthOpen(false);
                    }
                  }}
                />
              </label>
            ) : (
              <Button variant="secondary" onClick={() => setOtherMonthOpen(true)}>Escolher outra data</Button>
            )}
          </Dialog>
        )}
        {filtersOpen && (
          <Dialog title="Filtrar histórico" className="capture-sheet history-sheet" onClose={() => setFiltersOpen(false)}>
            <div className="history-filter-sections">
              <fieldset>
                <legend>Tipo</legend>
                {([
                  ['all', 'Todos'],
                  ['expense', 'Gastos'],
                  ['income', 'Entradas'],
                ] as const).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="history-type"
                      checked={draftType === value}
                      onChange={() => setDraftType(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Situação</legend>
                <label>
                  <input type="checkbox" checked={draftPendingOnly} onChange={(event) => setDraftPendingOnly(event.target.checked)} />
                  Pendentes
                </label>
              </fieldset>
              <fieldset>
                <legend>Origem</legend>
                {([
                  ['whatsapp', 'WhatsApp'],
                  ['manual', 'Aplicativo'],
                  ['import', 'Arquivo'],
                ] as const).map(([value, label]) => (
                  <label key={value}>
                    <input type="checkbox" checked={draftSources.includes(value)} onChange={() => toggleDraftSource(value)} />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="history-sheet-actions">
              <Button variant="secondary" onClick={clearDraftFilters}>Limpar</Button>
              <Button onClick={applyDraftFilters}>Aplicar filtros</Button>
            </div>
          </Dialog>
        )}
    */
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [learnCategory, setLearnCategory] = useState(false);
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
      } catch (validationError) {
        setError(
          validationError instanceof Error && validationError.message.startsWith('Para uma data futura')
            ? validationError.message
            : 'Confira o valor (por exemplo, 25,50), a descrição e a data.',
        );
        return;
      }
      setPending(true);
      let preferenceFailed = false;
      try {
        await app.repository.save('transactions', value, null);
        if (learnCategory && merchantKey(description).length >= 3) {
          try {
            await app.repository.categoryPreference(merchantKey(description), category);
          } catch {
            preferenceFailed = true;
          }
        }
        await app.refresh();
        const pendingOffline = !app.demo && !navigator.onLine;
        const canUndo = !existing && (app.demo || navigator.onLine);
        app.toast(
          preferenceFailed
            ? 'Movimento salvo; a preferência para os próximos registros não foi atualizada.'
            : pendingOffline
              ? 'Movimento pendente neste aparelho.'
              : existing
                ? 'Movimento atualizado.'
                : 'Movimento salvo.',
          canUndo
            ? {
                label: 'Desfazer',
                onClick: async () => {
                  await app.repository.remove('transactions', value.id, null);
                  await app.refresh();
                  app.toast('Movimento desfeito.');
                },
              }
            : undefined,
        );
        onClose();
      } catch {
        setError('Não foi possível salvar. Confira sua conexão e tente novamente.');
      } finally {
        setPending(false);
      }
    }
    return (
      <Dialog
        title={existing ? 'Corrigir movimento' : kind === 'expense' ? 'Anotar um gasto' : 'Anotar uma entrada'}
        onClose={() => {
          if (!pending) onClose();
        }}
      >
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
                onChange={(event) => setAmount(event.target.value)}
                required
                className="money-input"
              />
            </label>
            <label>
              {kind === 'expense' ? 'Com o quê?' : 'De onde veio?'}
              <input
                placeholder={kind === 'expense' ? 'Ex.: mercado, farmácia, conta de luz' : 'Ex.: aposentadoria, salário'}
                maxLength={180}
                minLength={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Quando?
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              <small>{date === today ? 'Hoje' : 'Confira a data do movimento.'}</small>
            </label>
            <details className="simple-details">
              <summary>Mais detalhes (opcional)</summary>
              <div className="simple-form">
                <label>
                  Gasto ou entrada?
                  <select value={kind} onChange={(event) => setKind(event.target.value as Transaction['type'])}>
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
          {existing && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={learnCategory}
                onChange={(event) => setLearnCategory(event.target.checked)}
              />
              Usar esta categoria nos próximos registros deste estabelecimento. Não alterar registros antigos.
            </label>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar movimento'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function CapturePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedType = (location.state as { entryType?: unknown } | null)?.entryType;
  const initialType = requestedType === 'expense' || requestedType === 'income' ? requestedType : null;
  const [adding, setAdding] = useState<Transaction['type'] | null>(initialType);
  useEffect(() => {
    if (initialType) navigate('/anotar', { replace: true, state: null });
  }, [initialType, navigate]);
  return (
    <>
      <header className="simple-heading">
        <h1>Anotar</h1>
        <p>Tudo que você adicionar aparece em Movimentos, com a origem identificada.</p>
      </header>
      <section className="capture-section" aria-labelledby="capture-manual-title">
        <h2 id="capture-manual-title">Registrar agora</h2>
        <div className="simple-inline-actions">
          <Button onClick={() => setAdding('expense')}>
            <ArrowUpRight size={18} /> Anotar gasto
          </Button>
          {/*
            const currentMonth = today.slice(0, 7);
            const [month, setMonth] = useState(currentMonth);
            <ArrowDownLeft size={18} /> Anotar entrada
            const [searchOpen, setSearchOpen] = useState(false);
            const [filtersOpen, setFiltersOpen] = useState(false);
            const [monthOpen, setMonthOpen] = useState(false);
            const [otherMonthOpen, setOtherMonthOpen] = useState(false);
            const [menuOpen, setMenuOpen] = useState(false);
            const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
            const [pendingOnly, setPendingOnly] = useState(false);
            const [sourceFilters, setSourceFilters] = useState<Transaction['source'][]>([]);
            const [draftType, setDraftType] = useState<'all' | 'expense' | 'income'>('all');
            const [draftPendingOnly, setDraftPendingOnly] = useState(false);
            const [draftSources, setDraftSources] = useState<Transaction['source'][]>([]);
      </section>
            const recentMonths = Array.from({ length: 4 }, (_, index) =>
              shiftMonths(`${currentMonth}-01`, -index).slice(0, 7),
            );
            const monthChoices = recentMonths.includes(month) ? recentMonths : [month, ...recentMonths.slice(0, 3)];
            const normalizedSearch = normalizeHistorySearch(search);
          <Link className="button button-secondary" to="/nexo">
            <Mic size={18} /> Falar ou escrever para o Nexo
                (transaction) => {
                  if (!transaction.date.startsWith(month)) return false;
                  if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
                  if (pendingOnly && transaction.status !== 'planned') return false;
                  if (sourceFilters.length && !sourceFilters.includes(transaction.source)) return false;
                  if (!normalizedSearch) return true;
                  const searchableValues = [
                    transaction.description,
                    transaction.category,
                    sourceLabels[transaction.source],
                    formatMoney(transaction.amount),
                  ];
                  return searchableValues.some((value) => normalizeHistorySearch(value).includes(normalizedSearch));
                },
            <FileUp size={18} /> Importar extrato
              .sort((first, second) => second.date.localeCompare(first.date));
            const groups = rows.reduce<{ date: string; label: string; rows: Transaction[] }[]>(
              (result, transaction) => {
                const lastGroup = result[result.length - 1];
                if (lastGroup?.date === transaction.date) lastGroup.rows.push(transaction);
                else result.push({ date: transaction.date, label: historyGroupLabel(transaction.date, today), rows: [transaction] });
                return result;
              },
              [],
            );
            const hasAppliedFilters = typeFilter !== 'all' || pendingOnly || sourceFilters.length > 0;
            function clearFilters() {
              setTypeFilter('all');
              setPendingOnly(false);
              setSourceFilters([]);
              setSearch('');
            }
            function applyDraftFilters() {
              setTypeFilter(draftType);
              setPendingOnly(draftPendingOnly);
              setSourceFilters(draftSources);
              setFiltersOpen(false);
            }
            function clearDraftFilters() {
              setDraftType('all');
              setDraftPendingOnly(false);
              setDraftSources([]);
            }
            function toggleDraftSource(source: Transaction['source']) {
              setDraftSources((current) =>
                current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
              );
            }
            function removeSourceFilter(source: Transaction['source']) {
              setSourceFilters((current) => current.filter((item) => item !== source));
            }
            const hasNoResults = !rows.length;
            const hasNoTransactions = app.data.transactions.length === 0;
          <Link className="button button-secondary" to="/integracoes">
            <MessageCircle size={18} /> Usar WhatsApp
                <div className="history-page">
                  <header className="history-heading">
                    <h1>Histórico</h1>
                    <div className="history-heading-actions">
                      <Button
                        variant="ghost"
                        aria-label={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
                        title={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
                        aria-expanded={searchOpen}
                        onClick={() => setSearchOpen((open) => !open)}
                      >
                        {searchOpen ? <X size={20} /> : <Search size={20} />}
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Filtrar histórico"
                        title="Filtrar histórico"
                        aria-expanded={filtersOpen}
                        onClick={() => {
                          setDraftType(typeFilter);
                          setDraftPendingOnly(pendingOnly);
                          setDraftSources(sourceFilters);
                          setFiltersOpen(true);
                        }}
                      >
                        <SlidersHorizontal size={20} /> <span>Filtrar</span>
                      </Button>
                      <div className="history-overflow">
                        <Button
                          variant="ghost"
                          aria-label="Mais opções do histórico"
                          title="Mais opções"
                          aria-expanded={menuOpen}
                          onClick={() => setMenuOpen((open) => !open)}
                        >
                          <MoreVertical size={20} />
                        </Button>
                        {menuOpen && (
                          <div className="history-overflow-menu" role="menu">
                            <button role="menuitem" onClick={() => { setAdding('expense'); setMenuOpen(false); }}>
                              Anotar gasto
                            </button>
                            <button role="menuitem" onClick={() => { setAdding('income'); setMenuOpen(false); }}>
                              Anotar entrada
                            </button>
                            <Link role="menuitem" to="/perfil" onClick={() => setMenuOpen(false)}>
                              Meu perfil
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </header>
                  {searchOpen && (
                    <label className="history-search">
                      Buscar no histórico
                      <span className="history-search-control">
                        <Search size={18} aria-hidden="true" />
                        <input
                          type="search"
                          placeholder="Descrição, categoria, origem ou valor"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                        {search && (
                          <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}>
                            <X size={18} />
                          </button>
                        )}
                      </span>
                    </label>
                  )}
                  <div className="history-month-bar">
                    <Button
                      variant="ghost"
                      aria-label="Mês anterior"
                      title="Mês anterior"
                      onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}
                    >
                      <ChevronLeft size={22} />
                    </Button>
                    <button className="history-month-current" onClick={() => setMonthOpen(true)}>
                      {monthLabel(month)}
                    </button>
                    <Button
                      variant="ghost"
                      aria-label="Próximo mês"
                      title="Próximo mês"
                      onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}
                    >
                      <ChevronRight size={22} />
                    </Button>
                  </div>
                  {(search || hasAppliedFilters) && (
                    <div className="history-active-filters" aria-label="Filtros ativos">
                      {search && (
                        <button onClick={() => setSearch('')} aria-label="Remover busca">
                          Busca: {search} <X size={14} />
                        </button>
                      )}
                      {typeFilter !== 'all' && (
                        <button onClick={() => setTypeFilter('all')}>
                          {typeFilter === 'expense' ? 'Gastos' : 'Entradas'} <X size={14} />
                        </button>
                      )}
                      {pendingOnly && (
                        <button onClick={() => setPendingOnly(false)}>
                          Pendentes <X size={14} />
                        </button>
                      )}
                      {sourceFilters.map((source) => (
                        <button key={source} onClick={() => removeSourceFilter(source)}>
                          {source === 'manual' ? 'Aplicativo' : source === 'whatsapp' ? 'WhatsApp' : 'Arquivo'}{' '}
                          <X size={14} />
                        </button>
                      ))}
                      <button className="history-clear-filters" onClick={clearFilters}>
                        Limpar filtros
                      </button>
                    </div>
                  )}
                  {hasNoResults ? (
                    <div className="history-empty">
                      <h2>{hasNoTransactions ? 'Nada por aqui ainda.' : hasAppliedFilters || search ? 'Nenhum resultado.' : 'Nenhum movimento neste mês.'}</h2>
                      {hasNoTransactions ? (
                        <>
                          <p>Mande seu primeiro gasto pelo WhatsApp.</p>
                          <Link className="button button-primary" to="/integracoes">Abrir WhatsApp</Link>
                        </>
                      ) : hasAppliedFilters || search ? (
                        <>
                          <p>Tente mudar a busca ou os filtros.</p>
                          <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>
                        </>
                      ) : (
                        <p>Escolha outro mês para consultar seus registros.</p>
                      )}
                    </div>
                  ) : (
                    <div className="history-timeline">
                      {groups.map((group) => (
                        <section className="history-day-group" key={group.date} aria-labelledby={`history-day-${group.date}`}>
                          <h2 id={`history-day-${group.date}`}>{group.label}</h2>
                          <MoneyRows rows={group.rows} timeline />
                        </section>
                      ))}
                    </div>
                  )}
                </div>
                {monthOpen && (
                  <Dialog title="Escolher período" className="capture-sheet history-sheet" onClose={() => setMonthOpen(false)}>
                    <div className="history-month-options">
                      {monthChoices.map((option) => (
                        <button
                          key={option}
                          aria-pressed={month === option}
                          onClick={() => { setMonth(option); setMonthOpen(false); }}
                        >
                          {monthLabel(option)}
                        </button>
                      ))}
                    </div>
                    {otherMonthOpen ? (
                      <label className="history-other-month">
                        Escolher outra data
                        <input
                          type="month"
                          value={month}
                          onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setMonthOpen(false); } }}
                        />
                      </label>
                    ) : (
                      <Button variant="secondary" onClick={() => setOtherMonthOpen(true)}>Escolher outra data</Button>
                    )}
                  </Dialog>
                )}
                {filtersOpen && (
                  <Dialog title="Filtrar histórico" className="capture-sheet history-sheet" onClose={() => setFiltersOpen(false)}>
                    <div className="history-filter-sections">
                      <fieldset>
                        <legend>Tipo</legend>
                        {([
                          ['all', 'Todos'],
                          ['expense', 'Gastos'],
                          ['income', 'Entradas'],
                        ] as const).map(([value, label]) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="history-type"
                              checked={draftType === value}
                              onChange={() => setDraftType(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      <fieldset>
                        <legend>Situação</legend>
                        <label>
                          <input type="checkbox" checked={draftPendingOnly} onChange={(event) => setDraftPendingOnly(event.target.checked)} />
                          Pendentes
                        </label>
                      </fieldset>
                      <fieldset>
                        <legend>Origem</legend>
                        {([
                          ['whatsapp', 'WhatsApp'],
                          ['manual', 'Aplicativo'],
                          ['import', 'Arquivo'],
                        ] as const).map(([value, label]) => (
                          <label key={value}>
                            <input type="checkbox" checked={draftSources.includes(value)} onChange={() => toggleDraftSource(value)} />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                    </div>
                    <div className="history-sheet-actions">
                      <Button variant="secondary" onClick={clearDraftFilters}>Limpar</Button>
                      <Button onClick={applyDraftFilters}>Aplicar filtros</Button>
                    </div>
                  </Dialog>
                )}
                {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
              </>
            ); */}
        </div>
      </section>
      <section className="capture-section" aria-labelledby="capture-other-title">
        <h2 id="capture-other-title">Ou escolha como enviar</h2>
        <div className="capture-sources">
          <Link className="button button-secondary" to="/nexo">
            <Mic size={18} /> Falar ou escrever para o Nexo
          </Link>
          <Link className="button button-secondary" to="/recibo">
            <Camera size={18} /> Fotografar ou enviar uma nota
          </Link>
          <Link className="button button-secondary" to="/importar">
            <FileUp size={18} /> Importar extrato
          </Link>
          <Link className="button button-secondary" to="/integracoes">
            <MessageCircle size={18} /> Usar WhatsApp
          </Link>
        </div>
      </section>
      <p className="muted">Fotos, extratos e mensagens são conferidos antes de virar um movimento salvo.</p>
      {adding && <MoneyForm type={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export function SimpleHome() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const { open: openCapture } = useCaptureFlow();
  const [monthDetailsOpen, setMonthDetailsOpen] = useState(false);
  const whatsapp = useQuery({
    queryKey: ['whatsapp-connection', app.user?.id],
    queryFn: () => invoke<{ connected: boolean; chat_url: string }>('whatsapp-link', { action: 'status' }),
    enabled: !app.demo && Boolean(app.user),
    retry: false,
    staleTime: 30_000,
  });
  const today = civilDate(new Date(), app.data.profile.timezone);
  const currentMonth = today.slice(0, 7);
  const posted = app.data.transactions.filter((transaction) => transaction.date <= today);
  const flow = monthlyFlow(posted, currentMonth);
  const goalBudget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
  const due = app.data.transactions.filter(
    (transaction) =>
      transaction.status === 'planned' &&
      transaction.type === 'expense' &&
      transaction.date <= shiftDays(today, 7),
  );
  const activeGoal =
    app.data.goals.find((goal) => goal.id === app.data.profile.active_goal_id) ??
    app.data.goals.find((goal) => goal.saved < goal.target) ??
    null;
  const goalProgress = activeGoal
    ? goalMonthlyPlan(activeGoal, today, goalBudget.available, goalBudget.contributed[activeGoal.id] ?? 0)
    : null;
  const recent = app.data.transactions
    .filter((transaction) => transaction.date <= today)
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 3);
  const recentGroups = [...new Set(recent.map((transaction) => transaction.date))].map((date) => ({
    date,
    label: movementDateLabel(date, today),
    rows: recent.filter((transaction) => transaction.date === date),
  }));
  const latestMonth = shiftMonths(`${currentMonth}-01`, -1).slice(0, 7);
  const previousMonth = shiftMonths(`${currentMonth}-01`, -2).slice(0, 7);
  const latestComplete = { month: latestMonth, ...monthlyFlow(posted, latestMonth) };
  const previousComplete = { month: previousMonth, ...monthlyFlow(posted, previousMonth) };
  const expenseChange = latestComplete.expenses - previousComplete.expenses;
  const meaningfulChange =
    latestComplete.count > 0 &&
    previousComplete.count > 0 &&
    Math.abs(expenseChange) >= Math.max(10_000, Math.round(previousComplete.expenses * 0.15));
  const insight = due.length
    ? {
        title:
          due.length === 1
            ? `${due[0].description} vence em ${dateLabel(due[0].date).replace(/\.$/, '')}.`
            : `${due.length} contas previstas nos próximos dias.`,
        amount: displayMoney(sum(due.map((item) => item.amount))),
        destination: '/planejar',
        action: 'Ver contas previstas',
        question: '',
      }
    : meaningfulChange
      ? {
          title: 'Seus gastos mudaram em relação ao mês passado.',
          amount: `${displayMoney(Math.abs(expenseChange))} ${expenseChange > 0 ? 'a mais' : 'a menos'}`,
          destination: '/nexo',
          action: 'Entender a diferença',
          question: `Compare os gastos pagos que anotei em ${monthLabel(latestComplete.month)} e ${monthLabel(previousComplete.month)}. Calcule a diferença pelos registros disponíveis e explique apenas o que as fontes sustentarem; não invente causas.`,
        }
      : null;
  return (
    <>
      <div className="home-layout">
        <section className="home-month-summary" aria-labelledby="monthly-summary-title">
          <button
            className="home-month-title"
            type="button"
            aria-expanded={monthDetailsOpen}
            aria-controls="home-month-details"
            onClick={() => setMonthDetailsOpen((open) => !open)}
          >
            <h1 id="monthly-summary-title">Seu mês</h1>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <div className="home-month-result" data-month={currentMonth}>
            <strong>{displayMoney(flow.net < 0 ? Math.abs(flow.net) : goalBudget.available)}</strong>
            <span>{flow.net < 0 ? 'faltou nos movimentos deste mês' : 'livre para planejar neste mês'}</span>
          </div>
          <p className="home-flow-line">
            Entrou {displayMoney(flow.income)} · Saiu {displayMoney(flow.expenses)}
          </p>
          {monthDetailsOpen && (
            <div className="home-month-details" id="home-month-details">
              <dl>
                <div>
                  <dt>Resultado dos movimentos</dt>
                  <dd>{displayMoney(flow.net)}</dd>
                </div>
                <div>
                  <dt>Objetivos</dt>
                  <dd>{displayMoney(goalBudget.allocated)}</dd>
                </div>
                <div>
                  <dt>Reservado para contas e essenciais</dt>
                  <dd>{displayMoney(goalBudget.reservedExpenses)}</dd>
                </div>
              </dl>
              <section className="home-month-bills" aria-label="Contas previstas">
                <h2>Contas previstas</h2>
                {due.length ? (
                  <ul>
                    {due.map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.description} · {dateLabel(item.date)}
                        </span>
                        <strong>{displayMoney(item.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhuma conta prevista nos próximos dias.</p>
                )}
              </section>
              <div className="home-month-method">
                <strong>Como é calculado</strong>
                <p>
                  O valor livre considera movimentos pagos, valores destinados a objetivos e contas previstas
                  registradas. Renda prevista não entra como dinheiro recebido; anotações incompletas podem
                  alterar a estimativa. Isso não é saldo bancário.
                </p>
              </div>
            </div>
          )}
          {flow.count === 0 && <p className="muted">Mande uma mensagem para começar.</p>}
        </section>
        <nav className="home-action-rail" aria-label="Ações rápidas">
          {whatsapp.data?.connected ? (
            <a
              className="home-quick-action"
              href={whatsapp.data.chat_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <MessageCircle size={22} />
              </span>
              <small>WhatsApp</small>
            </a>
          ) : (
            <Link className="home-quick-action" to="/integracoes">
              <span>
                <MessageCircle size={22} />
              </span>
              <small>WhatsApp</small>
            </Link>
          )}
          <button className="home-quick-action" onClick={openCapture}>
            <span>
              <Plus size={22} />
            </span>
            <small>Anotar</small>
          </button>
          <Link className="home-quick-action" to="/recibo">
            <span>
              <Camera size={22} />
            </span>
            <small>Recibo</small>
          </Link>
          <Link className="home-quick-action" to="/planejar">
            <span>
              <CalendarDays size={22} />
            </span>
            <small>Planejar</small>
          </Link>
        </nav>
        {insight && (
          <section className="home-insight" aria-labelledby="home-insight-title">
            <Sparkles size={18} aria-hidden="true" />
            <div className="home-insight-copy">
              <p className="eyebrow" id="home-insight-title">
                Nexo percebeu
              </p>
              <p>{insight.title}</p>
            </div>
            <strong className="home-insight-amount">{insight.amount}</strong>
            <Link
              className="home-insight-action"
              aria-label={insight.action}
              title={insight.action}
              to={insight.destination}
              state={insight.question ? { question: insight.question } : undefined}
            >
              <ChevronRight size={20} />
            </Link>
          </section>
        )}
        <section className="home-goal" aria-labelledby="home-goal-title">
          <div className="home-goal-heading">
            <h2 id="home-goal-title">Objetivos</h2>
            <Link
              className="home-goal-more"
              to="/metas"
              aria-label="Ver todos os objetivos"
              title="Ver todos os objetivos"
            >
              <ChevronRight size={20} />
            </Link>
          </div>
          {activeGoal && goalProgress ? (
            <>
              <div className="home-goal-content">
                <h3>{activeGoal.name}</h3>
                <p className="home-goal-amount">
                  <strong>{displayMoney(activeGoal.saved)}</strong>
                  <span>de {displayMoney(activeGoal.target)}</span>
                </p>
                <Progress
                  value={(activeGoal.saved / activeGoal.target) * 100}
                  label={`Progresso de ${activeGoal.name}`}
                />
                <span className="home-goal-percent">
                  {Math.round((activeGoal.saved / activeGoal.target) * 100)}%
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="home-goal-content">
                <h3>Escolha um objetivo</h3>
              </div>
            </>
          )}
        </section>
        <section className="home-recent" aria-labelledby="recent-title">
          <div className="simple-section-title">
            <h2 id="recent-title">Últimos movimentos</h2>
          </div>
          {recentGroups.length ? (
            recentGroups.map((group) => (
              <div className="home-recent-group" key={group.date}>
                <p className="home-recent-date">{group.label}</p>
                <MoneyRows rows={group.rows} showMetadata={false} showActions={false} compactHome />
              </div>
            ))
          ) : (
            <div className="home-empty">
              <p>Ainda não tem movimentos por aqui.</p>
              <span>Mande uma mensagem ao Nexo no WhatsApp para começar.</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function MoneyRows({
  rows,
  showMetadata = true,
  showActions = true,
  compactHome = false,
  timeline = false,
}: {
  rows: Transaction[];
  showMetadata?: boolean;
  showActions?: boolean;
  compactHome?: boolean;
  timeline?: boolean;
}) {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [details, setDetails] = useState<Transaction | null>(null);
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
      app.toast('Movimento excluído.');
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <ul className={`money-list${compactHome ? ' home-compact-list' : ''}${timeline ? ' history-money-list' : ''}`}>
        {rows.map((t) => (
          <li className={compactHome ? 'home-compact-money-row' : undefined} key={t.id}>
            <div className="money-row-top">
              <span className={`money-kind ${t.type}`} aria-hidden="true">
                {t.type === 'income' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
              </span>
              <div className="money-description">
                <h3>
                  <button
                    className="money-detail-trigger"
                    onClick={() => {
                      setDetails(t);
                    }}
                  >
                    {t.description}
                  </button>
                </h3>
                <p className={compactHome ? 'sr-only' : 'muted'}>
                  {timeline ? (
                    <>
                      {t.category}
                      {t.status === 'planned' && ` · Previsto para ${fullDateLabel(t.date)}`}
                    </>
                  ) : (
                    <>
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${t.date}T12:00:00Z`))}
                      {showMetadata && <> · {t.category} · {sourceLabels[t.source]}</>}
                    </>
                  )}
                </p>
              </div>
              <strong className={t.type === 'income' ? 'positive' : ''}>
                <span className="sr-only">{t.type === 'income' ? 'Entrada' : 'Gasto'}</span>
                {t.type === 'income' ? '+' : '−'} {displayMoney(t.amount)}
              </strong>
            </div>
            {showActions && !timeline && (
              <div className="money-row-bottom">
                <span className="muted">
                  {t.status === 'planned' ? 'Ainda não aconteceu' : t.type === 'income' ? 'Recebido' : 'Pago'}
                </span>
                <div>
                  <Button
                    variant="ghost"
                    aria-label={`Ver detalhes de ${t.description}`}
                    onClick={() => setDetails(t)}
                  >
                    <ChevronRight size={16} /> Detalhes
                  </Button>
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
            )}
          </li>
        ))}
      </ul>
      {details && (
        <Dialog
          title={timeline ? details.description : 'Detalhes do movimento'}
          className={timeline ? 'history-detail-sheet' : ''}
          onClose={() => {
            setDetails(null);
          }}
        >
          <div className="movement-detail">
            {!timeline && <h2>{details.description}</h2>}
            <strong className={details.type === 'income' ? 'positive' : ''}>
              {details.type === 'income' ? '+' : '−'} {displayMoney(details.amount)}
            </strong>
            <dl>
              <div>
                <dt>Categoria</dt>
                <dd>{details.category}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{fullDateLabel(details.date)}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{sourceLabels[details.source]}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {details.status === 'planned'
                    ? 'Pendente'
                    : details.type === 'income'
                      ? 'Recebido'
                      : 'Pago'}
                </dd>
              </div>
              <div>
                <dt>Conta</dt>
                <dd>
                  {details.account_id
                    ? (app.data.financial_accounts.find((account) => account.id === details.account_id)
                        ?.name ?? 'Conta não encontrada')
                    : 'Sem conta vinculada'}
                </dd>
              </div>
            </dl>
            <details className={timeline ? 'history-detail-origin' : undefined}>
              <summary>{timeline ? 'Como este registro chegou aqui?' : 'Origem do registro'}</summary>
              <p className="muted">
              {details.source === 'whatsapp'
                ? 'Registrado a partir de uma mensagem enviada pelo WhatsApp.'
                : details.source === 'import'
                  ? 'Registrado a partir de um arquivo importado.'
                  : 'Registrado manualmente no app.'}
              </p>
            </details>
            <Button
              onClick={() => {
                setEditing(details);
                setDetails(null);
              }}
            >
              <Pencil size={16} /> Corrigir movimento
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setError('');
                setDeleting(details);
                setDetails(null);
              }}
            >
              <Trash2 size={16} /> Excluir movimento
            </Button>
          </div>
        </Dialog>
      )}
      {editing && <MoneyForm type={editing.type} existing={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Dialog
          title="Excluir este movimento?"
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <div className="simple-form">
            <p>
              {deleting.description} · {displayMoney(deleting.amount)}
            </p>
            <p>Ela será retirada do seu resumo. Se precisar, você poderá anotar novamente.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              {pending ? 'Excluindo…' : 'Sim, excluir movimento'}
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
  const today = civilDate(new Date(), app.data.profile.timezone);
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [otherMonthOpen, setOtherMonthOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [sourceFilters, setSourceFilters] = useState<Transaction['source'][]>([]);
  const [draftType, setDraftType] = useState<'all' | 'expense' | 'income'>('all');
  const [draftPendingOnly, setDraftPendingOnly] = useState(false);
  const [draftSources, setDraftSources] = useState<Transaction['source'][]>([]);
  const recentMonths = Array.from({ length: 4 }, (_, index) =>
    shiftMonths(`${currentMonth}-01`, -index).slice(0, 7),
  );
  const monthChoices = recentMonths.includes(month) ? recentMonths : [month, ...recentMonths.slice(0, 3)];
  const normalizedSearch = normalizeHistorySearch(search);
  const rows = app.data.transactions
    .filter((transaction) => {
      if (!transaction.date.startsWith(month)) return false;
      if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
      if (pendingOnly && transaction.status !== 'planned') return false;
      if (sourceFilters.length && !sourceFilters.includes(transaction.source)) return false;
      if (!normalizedSearch) return true;
      return [
        transaction.description,
        transaction.category,
        sourceLabels[transaction.source],
        formatMoney(transaction.amount),
      ].some((value) => normalizeHistorySearch(value).includes(normalizedSearch));
    })
    .sort((first, second) => second.date.localeCompare(first.date));
  const groups = rows.reduce<{ date: string; label: string; rows: Transaction[] }[]>((result, transaction) => {
    const lastGroup = result[result.length - 1];
    if (lastGroup?.date === transaction.date) lastGroup.rows.push(transaction);
    else result.push({ date: transaction.date, label: historyGroupLabel(transaction.date, today), rows: [transaction] });
    return result;
  }, []);
  const hasAppliedFilters = typeFilter !== 'all' || pendingOnly || sourceFilters.length > 0;
  const hasNoResults = rows.length === 0;
  const hasNoTransactions = app.data.transactions.length === 0;
  function clearFilters() {
    setTypeFilter('all');
    setPendingOnly(false);
    setSourceFilters([]);
    setSearch('');
  }
  function applyDraftFilters() {
    setTypeFilter(draftType);
    setPendingOnly(draftPendingOnly);
    setSourceFilters(draftSources);
    setFiltersOpen(false);
  }
  function clearDraftFilters() {
    setDraftType('all');
    setDraftPendingOnly(false);
    setDraftSources([]);
  }
  function toggleDraftSource(source: Transaction['source']) {
    setDraftSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
    );
  }
  function removeSourceFilter(source: Transaction['source']) {
    setSourceFilters((current) => current.filter((item) => item !== source));
  }
  return (
    <div className="history-page">
      <header className="history-heading">
        <h1>Histórico</h1>
        <div className="history-heading-actions">
          <Button
            variant="ghost"
            aria-label={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
            title={searchOpen ? 'Fechar busca' : 'Buscar no histórico'}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </Button>
          <Button
            variant="ghost"
            aria-label="Filtrar histórico"
            title="Filtrar histórico"
            aria-expanded={filtersOpen}
            onClick={() => {
              setDraftType(typeFilter);
              setDraftPendingOnly(pendingOnly);
              setDraftSources(sourceFilters);
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal size={20} /> <span>Filtrar</span>
          </Button>
        </div>
      </header>
      {searchOpen && (
        <label className="history-search">
          Buscar no histórico
          <span className="history-search-control">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Descrição, categoria, origem ou valor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}>
                <X size={18} />
              </button>
            )}
          </span>
        </label>
      )}
      <div className="history-month-bar">
        <Button variant="ghost" aria-label="Mês anterior" onClick={() => setMonth(shiftMonths(`${month}-01`, -1).slice(0, 7))}>
          <ChevronLeft size={22} />
        </Button>
        <button className="history-month-current" onClick={() => setMonthOpen(true)}>{monthLabel(month)}</button>
        <Button variant="ghost" aria-label="Próximo mês" onClick={() => setMonth(shiftMonths(`${month}-01`, 1).slice(0, 7))}>
          <ChevronRight size={22} />
        </Button>
      </div>
      {(search || hasAppliedFilters) && (
        <div className="history-active-filters" aria-label="Filtros ativos">
          {search && <button onClick={() => setSearch('')} aria-label="Remover busca">Busca: {search} <X size={14} /></button>}
          {typeFilter !== 'all' && <button onClick={() => setTypeFilter('all')}>{typeFilter === 'expense' ? 'Gastos' : 'Entradas'} <X size={14} /></button>}
          {pendingOnly && <button onClick={() => setPendingOnly(false)}>Pendentes <X size={14} /></button>}
          {sourceFilters.map((source) => (
            <button key={source} onClick={() => removeSourceFilter(source)}>
              {source === 'manual' ? 'Aplicativo' : source === 'whatsapp' ? 'WhatsApp' : 'Arquivo'} <X size={14} />
            </button>
          ))}
          <button className="history-clear-filters" onClick={clearFilters}>Limpar filtros</button>
        </div>
      )}
      {hasNoResults ? (
        <div className="history-empty">
          <h2>
            {hasNoTransactions ? 'Nada por aqui ainda.' : hasAppliedFilters || search ? 'Nenhum resultado.' : 'Nenhum movimento neste mês.'}
          </h2>
          {hasNoTransactions ? (
            <>
              <p>Mande seu primeiro gasto pelo WhatsApp.</p>
              <Link className="button button-primary" to="/integracoes">Abrir WhatsApp</Link>
            </>
          ) : hasAppliedFilters || search ? (
            <>
              <p>Tente mudar a busca ou os filtros.</p>
              <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>
            </>
          ) : <p>Escolha outro mês para consultar seus registros.</p>}
        </div>
      ) : (
        <div className="history-timeline">
          {groups.map((group) => (
            <section className="history-day-group" key={group.date} aria-labelledby={`history-day-${group.date}`}>
              <h2 id={`history-day-${group.date}`}>{group.label}</h2>
              <MoneyRows rows={group.rows} timeline />
            </section>
          ))}
        </div>
      )}
      {monthOpen && (
        <Dialog title="Escolher período" className="capture-sheet history-sheet" onClose={() => setMonthOpen(false)}>
          <div className="history-month-options">
            {monthChoices.map((option) => (
              <button key={option} aria-pressed={month === option} onClick={() => { setMonth(option); setMonthOpen(false); }}>
                {monthLabel(option)}
              </button>
            ))}
          </div>
          {otherMonthOpen ? (
            <label className="history-other-month">
              Escolher outra data
              <input type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setMonthOpen(false); } }} />
            </label>
          ) : <Button variant="secondary" onClick={() => setOtherMonthOpen(true)}>Escolher outra data</Button>}
        </Dialog>
      )}
      {filtersOpen && (
        <Dialog title="Filtrar histórico" className="capture-sheet history-sheet" onClose={() => setFiltersOpen(false)}>
          <div className="history-filter-sections">
            <fieldset>
              <legend>Tipo</legend>
              {([
                ['all', 'Todos'],
                ['expense', 'Gastos'],
                ['income', 'Entradas'],
              ] as const).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="history-type" checked={draftType === value} onChange={() => setDraftType(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Situação</legend>
              <label><input type="checkbox" checked={draftPendingOnly} onChange={(event) => setDraftPendingOnly(event.target.checked)} />Pendentes</label>
            </fieldset>
            <fieldset>
              <legend>Origem</legend>
              {([
                ['whatsapp', 'WhatsApp'],
                ['manual', 'Aplicativo'],
                ['import', 'Arquivo'],
              ] as const).map(([value, label]) => (
                <label key={value}>
                  <input type="checkbox" checked={draftSources.includes(value)} onChange={() => toggleDraftSource(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="history-sheet-actions">
            <Button variant="secondary" onClick={clearDraftFilters}>Limpar</Button>
            <Button onClick={applyDraftFilters}>Aplicar filtros</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
