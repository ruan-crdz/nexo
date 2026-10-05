import { useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { v5 as uuid } from 'uuid';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Button } from '../design-system/components';
import { civilDate, parseMoney } from '../../shared/financial-engine';
import { merchantKey } from '../../shared/financial-decisions';
import { categories, transactionSchema } from '../../shared/domain';
type Preview = {
  parsed: { clarification: string | null };
  transactions: {
    description: string;
    amount: number;
    date: string;
    category: string;
    type: 'income' | 'expense';
    status: 'paid' | 'planned';
  }[];
};
export function ReceiptImport() {
  const app = useApp();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [amounts, setAmounts] = useState<string[]>([]);
  const today = civilDate(new Date(), app.data.profile.timezone);
  function edit(index: number, changes: Partial<Preview['transactions'][number]>) {
    setConfirmed(false);
    setPreview(
      (current) =>
        current && {
          ...current,
          transactions: current.transactions.map((row, position) =>
            position === index ? { ...row, ...changes } : row,
          ),
        },
    );
  }
  async function read(file: File) {
    setPending(true);
    setPreview(null);
    setConfirmed(false);
    setError('');
    try {
      if (app.demo) throw new Error('Leitura de recibos exige conta real e modelo de visão configurado.');
      if (file.size > 5_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('Escolha JPG, PNG ou WEBP de até 5 MB.');
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      setFingerprint(
        [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
      );
      const form = new FormData();
      form.set('file', file);
      const received = await invoke<Preview>('ai-receipt', form);
      for (const row of received.transactions) {
        const preference = app.data.category_preferences.find(
          (item) => item.merchant === merchantKey(row.description),
        );
        if (preference) row.category = preference.category;
      }
      setPreview(received);
      setAmounts(received.transactions.map((row) => (row.amount / 100).toFixed(2).replace('.', ',')));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a imagem.');
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!preview || !confirmed) return;
    setPending(true);
    setError('');
    try {
      const rows = preview.transactions.map((row, index) => {
        if (row.status === 'paid' && row.date > today)
          throw new Error('Uma data futura deve ficar como pagamento ainda não confirmado.');
        return transactionSchema.parse({
          ...row,
          amount: parseMoney(amounts[index]),
          id: uuid(
            `${app.demo ? 'demo' : app.user!.id}:${fingerprint}:${index}`,
            'cab180da-3bd7-4d93-99cc-26fd4c7e0053',
          ),
          source: 'import',
          account_id: null,
        });
      });
      const result = await app.repository.importTransactions(rows);
      await app.refresh();
      setPreview(null);
      app.toast(`${result.saved} anotações salvas; ${result.skipped} já existentes.`);
    } catch (err) {
      setError(
        err instanceof Error && !err.message.startsWith('[')
          ? err.message
          : 'Confira a descrição, o valor e a data antes de salvar.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="simple-heading">
        <h1>Ler recibo por foto</h1>
        <p>Confira os dados legíveis antes de salvar. A imagem não cria uma anotação sozinha.</p>
      </header>
      {app.demo && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setPreview({
              parsed: {
                clarification: 'Exemplo fictício para experimentar a revisão. Nenhuma imagem foi lida.',
              },
              transactions: [
                {
                  description: 'Mercado exemplo',
                  amount: 1234,
                  date: today,
                  category: 'Alimentação',
                  type: 'expense',
                  status: 'planned',
                },
              ],
            });
            setAmounts(['12,34']);
            setFingerprint('demo-receipt');
            setConfirmed(false);
            setError('');
          }}
        >
          Experimentar com recibo fictício
        </Button>
      )}
      <label>
        Foto do recibo
        <input
          className="statement-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
            event.target.value = '';
          }}
        />
      </label>
      {pending && <p role="status">Processando…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {preview && (
        <section className="simple-form">
          <h2>
            <Camera size={18} />
            Confira a leitura
          </h2>
          {preview.parsed.clarification && <p>{preview.parsed.clarification}</p>}
          <ul className="receipt-review-list">
            {preview.transactions.map((row, index) => (
              <li key={index}>
                <fieldset className="simple-form" disabled={pending}>
                  <legend>Item {index + 1}</legend>
                  <label>
                    Descrição do recibo
                    <input
                      minLength={2}
                      maxLength={180}
                      value={row.description}
                      onChange={(event) => edit(index, { description: event.target.value })}
                    />
                  </label>
                  <label>
                    Valor do recibo (R$)
                    <input
                      inputMode="decimal"
                      value={amounts[index] ?? ''}
                      onChange={(event) => {
                        setConfirmed(false);
                        setAmounts((current) =>
                          current.map((amount, position) =>
                            position === index ? event.target.value : amount,
                          ),
                        );
                      }}
                    />
                  </label>
                  <label>
                    Data do recibo
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) =>
                        edit(index, {
                          date: event.target.value,
                          ...(event.target.value > today ? { status: 'planned' as const } : {}),
                        })
                      }
                    />
                  </label>
                  <label>
                    Categoria do recibo
                    <select
                      value={row.category}
                      onChange={(event) => edit(index, { category: event.target.value })}
                    >
                      {!categories.some((category) => category === row.category) && (
                        <option>{row.category}</option>
                      )}
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Gasto ou entrada do recibo?
                    <select
                      value={row.type}
                      onChange={(event) => edit(index, { type: event.target.value as 'income' | 'expense' })}
                    >
                      <option value="expense">Gasto</option>
                      <option value="income">Entrada</option>
                    </select>
                  </label>
                  <label>
                    Situação do recibo
                    <select
                      value={row.status}
                      onChange={(event) => edit(index, { status: event.target.value as 'paid' | 'planned' })}
                    >
                      <option value="planned">Pagamento ainda não confirmado</option>
                      <option
                        value="paid"
                        disabled={row.date > civilDate(new Date(), app.data.profile.timezone)}
                      >
                        Já paguei ou recebi
                      </option>
                    </select>
                  </label>
                </fieldset>
              </li>
            ))}
          </ul>
          {preview.transactions.length > 0 && (
            <>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Conferi e corrigi valor, descrição, data e categoria.
              </label>
              <Button disabled={pending || !confirmed} onClick={() => void save()}>
                <Check size={18} />
                Salvar dados conferidos
              </Button>
            </>
          )}
        </section>
      )}
    </>
  );
}
