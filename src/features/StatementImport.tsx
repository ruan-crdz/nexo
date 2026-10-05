import { useState } from 'react';
import { Download, Upload, Check } from 'lucide-react';
import { useApp } from '../data/context';
import { Button } from '../design-system/components';
import { csvCandidates, csvTable, ofxCandidates } from '../../shared/statement-import';
import type { CsvMapping, ImportCandidate } from '../../shared/statement-import';
import { formatMoney } from '../../shared/financial-engine';
import { download } from './Resources';
export function StatementImport() {
  const app = useApp();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [mapping, setMapping] = useState<CsvMapping>({
    date: 0,
    description: 1,
    amount: 2,
    type: null,
    numberFormat: 'br',
    dateFormat: 'br',
  });
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null);
  async function open(file: File) {
    setError('');
    setCandidates([]);
    setResult(null);
    setSelected(new Set());
    setText('');
    setHeaders([]);
    setName('');
    try {
      if (file.size > 2_000_000) throw new Error('Use um arquivo de até 2 MB.');
      if (!/\.(csv|ofx|qfx)$/i.test(file.name)) throw new Error('Escolha CSV ou OFX.');
      const content = await file.text();
      setText(content);
      setName(file.name);
      if (/\.csv$/i.test(file.name)) setHeaders(csvTable(content).headers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o extrato.');
      setText('');
    }
  }
  function review() {
    setError('');
    setResult(null);
    try {
      const ownerId = app.demo ? 'demo' : app.user!.id;
      const rows = headers.length
        ? csvCandidates(text, mapping, account || null, app.data.transactions, ownerId)
        : ofxCandidates(text, account || null, app.data.transactions, ownerId);
      setCandidates(rows);
      setSelected(new Set(rows.filter((item) => !item.duplicate).map((item) => item.transaction.id)));
    } catch (err) {
      setCandidates([]);
      setError(err instanceof Error ? err.message : 'Confira o arquivo e as colunas.');
    }
  }
  async function save() {
    setPending(true);
    setError('');
    try {
      const rows = candidates
        .filter((item) => selected.has(item.transaction.id) && item.duplicate !== 'confirmed')
        .map((item) => item.transaction);
      const saved = await app.repository.importTransactions(rows);
      setResult(saved);
      await app.refresh();
      setCandidates([]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nada foi confirmado. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  const column = (field: 'date' | 'description' | 'amount') => (
    <label>
      {field === 'date'
        ? 'Coluna de data'
        : field === 'description'
          ? 'Coluna de descrição'
          : 'Coluna de valor'}
      <select
        value={mapping[field]}
        onChange={(event) => {
          setMapping({ ...mapping, [field]: Number(event.target.value) });
          setCandidates([]);
        }}
      >
        {headers.map((header, index) => (
          <option key={index} value={index}>
            {header || `Coluna ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <header className="simple-heading">
        <h1>Importar extrato</h1>
        <p>Revise o arquivo e escolha o que salvar. Seus dados ficam separados dos de outras pessoas.</p>
      </header>
      <section className="simple-form">
        <label>
          Extrato CSV ou OFX
          <input
            disabled={pending}
            type="file"
            className="statement-file"
            accept=".csv,.ofx,.qfx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void open(file);
              event.target.value = '';
            }}
          />
        </label>
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              download(
                'nexo-modelo.csv',
                'Data;Descrição;Valor;Tipo\n04/10/2026;Mercado;-25,50;Gasto\n04/10/2026;Salário;2000,00;Entrada',
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={18} />
            Baixar modelo CSV
          </Button>
        </div>
        <label>
          Conta deste extrato
          <select
            value={account}
            onChange={(event) => {
              setAccount(event.target.value);
              setCandidates([]);
            }}
          >
            <option value="">Sem conta vinculada</option>
            {app.data.financial_accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {headers.length > 0 && (
          <div className="import-mapping">
            {column('date')}
            {column('description')}
            {column('amount')}
            <label>
              Coluna de tipo
              <select
                value={mapping.type ?? ''}
                onChange={(event) => {
                  setMapping({
                    ...mapping,
                    type: event.target.value === '' ? null : Number(event.target.value),
                  });
                  setCandidates([]);
                }}
              >
                <option value="">Valor negativo = gasto; positivo = entrada</option>
                {headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Formato dos valores
              <select
                value={mapping.numberFormat}
                onChange={(event) => {
                  setMapping({ ...mapping, numberFormat: event.target.value as 'br' | 'decimal' });
                  setCandidates([]);
                }}
              >
                <option value="br">1.234,56</option>
                <option value="decimal">1234.56 (sem separador de milhar)</option>
              </select>
            </label>
            <label>
              Formato das datas
              <select
                value={mapping.dateFormat}
                onChange={(event) => {
                  setMapping({ ...mapping, dateFormat: event.target.value as 'iso' | 'br' });
                  setCandidates([]);
                }}
              >
                <option value="br">DD/MM/AAAA</option>
                <option value="iso">AAAA-MM-DD</option>
              </select>
            </label>
          </div>
        )}
        {text && (
          <div>
            <p className="muted">{name}</p>
            <Button onClick={review} disabled={pending}>
              <Upload size={18} />
              Revisar registros
            </Button>
          </div>
        )}
      </section>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="notice" role="status">
          {result.saved} registros salvos; {result.skipped} duplicatas ignoradas.
        </p>
      )}
      {candidates.length > 0 && (
        <section className="simple-form">
          <h2>Revisão: {candidates.length} registros</h2>
          <p className="muted">
            Registros parecidos ficam desmarcados. Duplicatas confirmadas não podem ser salvas novamente.
          </p>
          <ul className="import-preview">
            {candidates.map(({ transaction, duplicate }, index) => (
              <li key={`${transaction.id}:${index}`}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    disabled={pending || duplicate === 'confirmed'}
                    checked={selected.has(transaction.id) && duplicate !== 'confirmed'}
                    onChange={(event) => {
                      const updated = new Set(selected);
                      if (event.target.checked) updated.add(transaction.id);
                      else updated.delete(transaction.id);
                      setSelected(updated);
                    }}
                  />
                  <span>
                    {transaction.description}
                    <small>
                      {transaction.date} · {transaction.type === 'expense' ? 'Gasto' : 'Entrada'} ·{' '}
                      {formatMoney(transaction.amount)}
                      {duplicate === 'confirmed'
                        ? ' · Já importado'
                        : duplicate === 'possible'
                          ? ' · Possível duplicata'
                          : ''}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <Button disabled={pending || !selected.size} onClick={() => void save()}>
              <Check size={18} />
              {pending ? 'Salvando…' : `Salvar ${selected.size} registros selecionados`}
            </Button>
          </div>
        </section>
      )}
      <section className="open-finance-note">
        <h2>Conexão automática com bancos</h2>
        <p className="muted">
          Ainda não disponível. CSV e OFX não exigem sua senha bancária. A conexão futura terá consentimento e
          opção de revogar acesso.
        </p>
      </section>
    </>
  );
}
