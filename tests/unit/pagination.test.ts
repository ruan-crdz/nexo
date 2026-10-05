import { expect, it } from 'vitest';
import { readPages } from '../../shared/pagination';
it('lê mais de seis mil registros sem omissão ou duplicação', async () => {
  const rows = Array.from({ length: 6201 }, (_, index) => ({ id: index, amount: index }));
  const loaded = await readPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(loaded).toEqual(rows);
  expect(new Set(loaded.map((row) => row.id)).size).toBe(6201);
});
it('recusa leitura parcial se uma página falhar', async () => {
  await expect(
    readPages(async (from) =>
      from === 0
        ? { data: Array.from({ length: 500 }, () => 1), error: null }
        : { data: null, error: new Error('offline') },
    ),
  ).rejects.toThrow(/todos os registros/);
});
