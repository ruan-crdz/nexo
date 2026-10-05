import { readdir, writeFile } from 'node:fs/promises';
const excluded = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  '.env',
  '.env.server',
  '.env.functions',
  '.supabase',
]);
async function tree(path, prefix = '') {
  const entries = (await readdir(path, { withFileTypes: true }))
    .filter((e) => !excluded.has(e.name) && !e.name.endsWith('.tsbuildinfo'))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  let text = '';
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index],
      last = index === entries.length - 1;
    text += `${prefix}${last ? '└──' : '├──'} ${entry.name}${entry.isDirectory() ? '/' : ''}\n`;
    if (entry.isDirectory()) text += await tree(`${path}/${entry.name}`, prefix + (last ? '    ' : '│   '));
  }
  return text;
}
await writeFile(
  'docs/PROJECT_TREE.md',
  '# Árvore do projeto\n\nGerada por `node scripts/project-tree.mjs`. Dependências, builds, secrets e relatórios temporários omitidos.\n\n```text\nnexo/\n' +
    (await tree('.')) +
    '```\n',
);
