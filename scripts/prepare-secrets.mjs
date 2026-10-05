import { writeFile } from 'node:fs/promises';
const names = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_EXTRACTION_MODEL',
  'OPENAI_EMBEDDING_MODEL',
  'OPENAI_TRANSCRIPTION_MODEL',
  'ALLOWED_ORIGIN',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_PHONE',
  'WHATSAPP_GRAPH_VERSION',
];
const lines = names
  .filter((name) => process.env[name])
  .map((name) => {
    const value = process.env[name];
    if (/[\r\n]/.test(value)) throw new Error(`Valor inválido em ${name}.`);
    return `${name}=${value}`;
  });
await writeFile('.env.functions', lines.join('\n') + '\n', { mode: 0o600 });
console.log(
  'Arquivo .env.functions preparado. Nenhum valor secreto foi exibido. Variáveis SUPABASE_* são injetadas pela plataforma e foram excluídas.',
);
