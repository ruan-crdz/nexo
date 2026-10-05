import { expect, it } from 'vitest';
import { csvCandidates, csvTable, ofxCandidates, inferCsvMapping } from '../../shared/statement-import';
const mapping = {
  date: 0,
  description: 1,
  amount: 2,
  type: null,
  numberFormat: 'br' as const,
  dateFormat: 'br' as const,
};
it('CSV usa parser para separadores e aspas, mantendo centavos e identificadores estáveis', () => {
  const text =
    'Data;Descrição;Valor\n04/10/2026;"Mercado; bairro";-12,34\n04/10/2026;"Mercado; bairro";-12,34';
  expect(csvTable(text).headers).toHaveLength(3);
  const candidates = csvCandidates(text, mapping, null, []);
  expect(candidates[0].transaction).toMatchObject({
    amount: 1234,
    type: 'expense',
    description: 'Mercado; bairro',
    source: 'import',
  });
  expect(candidates[0].transaction.id).not.toBe(candidates[1].transaction.id);
  expect(
    csvCandidates(
      text,
      mapping,
      null,
      candidates.map((item) => item.transaction),
    ).every((item) => item.duplicate === 'confirmed'),
  ).toBe(true);
  expect(csvCandidates(text, mapping, null, [], 'user-a')[0].transaction.id).not.toBe(
    csvCandidates(text, mapping, null, [], 'user-b')[0].transaction.id,
  );
});
it('sinaliza registros parecidos e rejeita datas inválidas antes de salvar', () => {
  const text = 'Data;Descrição;Valor\n04/10/2026;Mercado;-12,34';
  const row = csvCandidates(text, mapping, null, [])[0].transaction;
  expect(
    csvCandidates(text, mapping, null, [{ ...row, id: crypto.randomUUID(), source: 'manual' }])[0].duplicate,
  ).toBe('possible');
  expect(() => csvCandidates(text.replace('04/10/2026', '31/02/2026'), mapping, null, [])).toThrow(/Linha 2/);
});
it('CSV grande preserva linhas válidas e lista inválidas na revisão', () => {
  const text =
    'Data;Descrição;Valor\n' +
    Array.from({ length: 1501 }, (_, index) => `04/10/2026;Compra ${index};-12,34`).join('\n') +
    '\n31/02/2026;Inválida;-1,00';
  const issues: { line: number; message: string }[] = [];
  expect(csvCandidates(text, mapping, null, [], 'a', issues)).toHaveLength(1501);
  expect(issues).toHaveLength(1);
  expect(inferCsvMapping(['Data', 'Descrição', 'Valor'])?.amount).toBe(2);
});
it('OFX usa FITID, identifica conta e conserva valor', () => {
  const text =
    '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF><BANKACCTFROM><BANKID>1</BANKID><ACCTID>123</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261004120000</DTPOSTED><TRNAMT>-12.34</TRNAMT><FITID>unique-1</FITID><NAME>Mercado</NAME></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const row = ofxCandidates(text, null, [])[0].transaction;
  expect(row).toMatchObject({ amount: 1234, type: 'expense', date: '2026-10-04' });
  expect(ofxCandidates(text, null, [row])[0].duplicate).toBe('confirmed');
  expect(() => ofxCandidates(text.replace('BRL', 'USD'), null, [])).toThrow(/BRL/);
});
