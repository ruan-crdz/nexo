import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const schema = z.array(
  z.object({
    title: z.string().min(3),
    organization: z.string(),
    source_url: z.url(),
    topic: z.string(),
    content: z.string().min(20),
    evidence_level: z.enum(['A', 'B', 'C', 'D']),
    jurisdiction: z.string(),
    verified: z.boolean(),
  }),
);
const documents = schema.parse(
  JSON.parse(await readFile(new URL('../knowledge/seed.json', import.meta.url), 'utf8')),
);
if (process.argv.includes('--check')) {
  console.log(
    `${documents.length} documentos válidos; ${documents.filter((d) => d.verified).length} revisados, ${documents.filter((d) => !d.verified).length} candidatos excluídos da recuperação.`,
  );
  process.exit(0);
}
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'OPENAI_EMBEDDING_MODEL'];
for (const name of required) if (!process.env[name]) throw new Error(`Configure ${name} em .env.server.`);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
for (const doc of documents) {
  const { data, error } = await db
    .from('knowledge_documents')
    .upsert(
      {
        ...doc,
        author: 'Equipe Nexo — síntese autoral',
        source_type: 'institutional_education',
        summary: doc.content,
        license: 'Resumo autoral; fonte referenciada, sem reprodução integral.',
        publication_year: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_url,topic' },
    )
    .select('id')
    .single();
  if (error) throw new Error(`Falha no documento ${doc.topic}: ${error.code}`);
  if (!doc.verified) continue;
  // Each initial principle is one semantic chunk. Longer future documents should
  // be segmented by topic, with overlap that preserves the source attribution.
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL,
      input: `${doc.title}\n${doc.content}`,
      dimensions: 1536,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error(
      `Falha de embedding (${response.status}); execute novamente após corrigir a configuração.`,
    );
  const embedding = (await response.json()).data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 1536)
    throw new Error('Dimensão de embedding incompatível.');
  const chunk = await db
    .from('knowledge_chunks')
    .upsert(
      { document_id: data.id, ordinal: 0, content: doc.content, embedding },
      { onConflict: 'document_id,ordinal' },
    );
  if (chunk.error) throw new Error(`Falha ao salvar chunk: ${chunk.error.code}`);
  console.log(`Indexado: ${doc.topic}`);
}
console.log('Ingestão concluída. Candidatos não verificados permanecem fora do RAG.');
