export async function readPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  size = 500,
): Promise<Row[]> {
  if (!Number.isInteger(size) || size < 1 || size > 1000) throw new Error('Página inválida.');
  const rows: Row[] = [];
  for (let from = 0; ; from += size) {
    const page = await fetchPage(from, from + size - 1);
    if (page.error) throw new Error('Não foi possível ler todos os registros.', { cause: page.error });
    if (!page.data) throw new Error('A leitura retornou uma página inválida.');
    rows.push(...page.data);
    if (page.data.length < size) return rows;
  }
}
