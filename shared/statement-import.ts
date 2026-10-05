import Papa from 'papaparse';
import { parseStrict } from 'ofx-js';
import { v5 as uuid } from 'uuid';
import { transactionSchema } from './domain';
import type { Transaction } from './domain';
import { money, parseMoney, validDate } from './financial-engine';
import { merchantKey, reconciliationMatches } from './financial-decisions';

const namespace = 'd759f194-f45b-4c60-8a47-0c41b49cf92f';
export type CsvMapping = {
  date: number;
  description: number;
  amount: number;
  type: number | null;
  numberFormat: 'br' | 'decimal';
  dateFormat: 'iso' | 'br';
};
export type ImportCandidate = {
  transaction: Transaction;
  duplicate: 'confirmed' | 'possible' | null;
  matches?: Transaction[];
};
export function csvTable(text: string) {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length || parsed.data.length < 2 || parsed.data.length > 10001)
    throw new Error('Confira o CSV: cabeçalho e até 10.000 registros são necessários.');
  return { headers: parsed.data[0], rows: parsed.data.slice(1) };
}
function decimalAmount(value: string) {
  const cleaned = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(cleaned)) throw new Error('Valor decimal inválido.');
  return parseMoney(cleaned.replace('.', ','));
}
function signedType(value: string | undefined, amount: number): Transaction['type'] {
  if (!value?.trim()) return amount < 0 ? 'expense' : 'income';
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (['expense', 'gasto', 'saida', 'debito', 'despesa', 'debit'].includes(normalized)) return 'expense';
  if (['income', 'entrada', 'credito', 'receita', 'credit'].includes(normalized)) return 'income';
  throw new Error('Tipo inválido; use entrada/saída ou deixe o valor assinado indicar o tipo.');
}
function signature(transaction: Transaction) {
  return JSON.stringify([
    transaction.date,
    transaction.type,
    transaction.amount,
    transaction.description.normalize('NFKC').trim().toLowerCase(),
    transaction.account_id,
  ]);
}
function review(rows: Transaction[], existing: Transaction[]) {
  const knownIds = new Set(existing.map((row) => row.id));
  const signatures = new Set(existing.map(signature));
  return rows.map((transaction): ImportCandidate => {
    const matches = reconciliationMatches(transaction, existing);
    const duplicate = knownIds.has(transaction.id)
      ? 'confirmed'
      : signatures.has(signature(transaction)) || matches.length > 0
        ? 'possible'
        : null;
    knownIds.add(transaction.id);
    return { transaction, duplicate, matches };
  });
}
export function csvCandidates(
  text: string,
  mapping: CsvMapping,
  accountId: string | null,
  existing: Transaction[],
  ownerId = 'demo',
  issues?: { line: number; message: string }[],
) {
  const table = csvTable(text);
  const occurrences = new Map<string, number>();
  const rows = table.rows.map((row, index) => {
    try {
      const rawDate = row[mapping.date]?.trim() ?? '';
      let date = rawDate;
      if (mapping.dateFormat === 'br') {
        const matched = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!matched) throw new Error('Use uma data no formato DD/MM/AAAA.');
        date = `${matched[3]}-${matched[2]}-${matched[1]}`;
      }
      if (!validDate(date)) throw new Error('Data inválida.');
      const amount =
        mapping.numberFormat === 'br'
          ? parseMoney(row[mapping.amount] ?? '')
          : decimalAmount(row[mapping.amount] ?? '');
      const transaction = transactionSchema.parse({
        id: crypto.randomUUID(),
        description: row[mapping.description],
        amount: money(Math.abs(amount)),
        type: signedType(mapping.type === null ? undefined : row[mapping.type], amount),
        date,
        category: 'Outros',
        status: 'paid',
        source: 'import',
        account_id: accountId,
      });
      const fingerprint = signature(transaction);
      const ordinal = (occurrences.get(fingerprint) ?? 0) + 1;
      occurrences.set(fingerprint, ordinal);
      return { ...transaction, id: uuid(`${ownerId}:csv:${fingerprint}:${ordinal}`, namespace) };
    } catch (error) {
      if (issues) {
        issues.push({
          line: index + 2,
          message:
            error instanceof Error && error.message.length < 200 ? error.message : 'Confira os campos.',
        });
        return null;
      }
      throw new Error(
        `Linha ${index + 2}: ${error instanceof Error && error.message.length < 200 ? error.message : 'confira os campos selecionados.'}`,
        { cause: error },
      );
    }
  });
  return review(
    rows.filter((row): row is Transaction => row !== null),
    existing,
  );
}
const arrayOf = <Item>(value: Item | Item[] | undefined): Item[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
export function ofxCandidates(
  text: string,
  accountId: string | null,
  existing: Transaction[],
  ownerId = 'demo',
) {
  const parsed = parseStrict(text);
  const statements = [
    ...arrayOf(parsed.OFX.BANKMSGSRSV1?.STMTTRNRS).map((response) => response.STMTRS),
    ...arrayOf(parsed.OFX.CREDITCARDMSGSRSV1?.CCSTMTTRNRS).map((response) => response.CCSTMTRS),
  ];
  const rows: Transaction[] = [];
  for (const statement of statements) {
    if (!statement) continue;
    if (statement.CURDEF !== 'BRL') throw new Error('Somente extratos em reais (BRL) são aceitos.');
    const bankAccount = 'BANKACCTFROM' in statement ? statement.BANKACCTFROM : statement.CCACCTFROM;
    const accountKey =
      'BANKID' in bankAccount
        ? JSON.stringify(['bank', bankAccount.BANKID, bankAccount.ACCTID])
        : JSON.stringify(['credit', bankAccount.ACCTID]);
    for (const record of arrayOf(statement.BANKTRANLIST?.STMTTRN)) {
      const posted = String(record.DTPOSTED).slice(0, 8);
      const date = `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`;
      if (!record.FITID) throw new Error('O OFX precisa de um FITID por registro para evitar duplicatas.');
      const amount = decimalAmount(String(record.TRNAMT));
      rows.push(
        transactionSchema.parse({
          id: uuid(`${ownerId}:ofx:${accountKey}:${record.FITID}`, namespace),
          date,
          description: record.NAME || record.MEMO || 'Registro do extrato',
          amount: Math.abs(amount),
          type: amount < 0 ? 'expense' : 'income',
          category: 'Outros',
          status: 'paid',
          source: 'import',
          account_id: accountId,
        }),
      );
    }
  }
  if (!rows.length || rows.length > 10000) throw new Error('O OFX deve ter de 1 a 10.000 registros.');
  return review(rows, existing);
}
export function inferCsvMapping(headers: string[]): CsvMapping | null {
  const names = headers.map((header) => merchantKey(header));
  const find = (pattern: RegExp) => names.findIndex((name) => pattern.test(name));
  const date = find(/^(data|date|data lancamento|data transacao)$/),
    description = find(/descricao|historico|description|memo|estabelecimento/),
    amount = find(/^(valor|amount|valor transacao)$/);
  if (date < 0 || description < 0 || amount < 0) return null;
  const type = find(/^(tipo|type)$/);
  return { date, description, amount, type: type < 0 ? null : type, dateFormat: 'br', numberFormat: 'br' };
}
