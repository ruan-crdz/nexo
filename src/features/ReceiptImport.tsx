import { useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { v5 as uuid } from 'uuid';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { Button } from '../design-system/components';
import { civilDate, formatMoney } from '../../shared/financial-engine';
import { merchantKey } from '../../shared/financial-decisions';
import { transactionSchema } from '../../shared/domain';
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
      const rows = preview.transactions.map((row, index) =>
        transactionSchema.parse({
          ...row,
          id: uuid(`${app.user!.id}:${fingerprint}:${index}`, 'cab180da-3bd7-4d93-99cc-26fd4c7e0053'),
          source: 'import',
          account_id: null,
        }),
      );
      const result = await app.repository.importTransactions(rows);
      await app.refresh();
      setPreview(null);
      app.toast(`${result.saved} anotações salvas; ${result.skipped} já existentes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
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
          <ul className="evidence-list">
            {preview.transactions.map((row, index) => (
              <li key={index}>
                <span>
                  {row.description} · {row.date} · {formatMoney(row.amount)} · {row.category}
                </span>
                <label>
                  Situação do recibo
                  <select
                    value={row.status}
                    onChange={(event) => {
                      setConfirmed(false);
                      setPreview({
                        ...preview,
                        transactions: preview.transactions.map((item, position) =>
                          position === index
                            ? { ...item, status: event.target.value as 'paid' | 'planned' }
                            : item,
                        ),
                      });
                    }}
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
                Conferi valor, descrição, data e categoria. Se estiver errado, não salvar.
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
