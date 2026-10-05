# RUAN, PARA COLOCAR O NEXO NO AR, FAÇA ISSO.

## 1. Confira a demonstração

```sh
npm install
npm run dev
```

Abra `http://localhost:5173`. Em PowerShell restrito, use `npm.cmd`/`npx.cmd` em todos os comandos abaixo.

## 2. Crie o Supabase e configure o frontend

Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard). Em Project Settings → API / API Keys, copie URL e chave **publishable** (a legada anon também funciona). Nunca use service_role no frontend.

Copie `.env.example` para `.env`:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
VITE_BASE_PATH=/
```

Reinicie Vite após alterações. Demo e conta real permanecem separadas.

## 3. Instale o banco

```sh
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

O comando aplica todas as migrations em ordem. Esse fluxo remoto não precisa de Docker. Alternativamente, execute cada arquivo de `supabase/migrations/` no SQL Editor, em ordem, sem repetir migrations já aplicadas.

## 4. Configure Auth

Em Authentication → URL Configuration, Site URL local: `http://localhost:5173`; produção: `https://ruan-crdz.github.io/nexo/`. Acrescente em Redirect URLs os endereços usados e `https://ruan-crdz.github.io/nexo/**`.

Mantenha confirmação de e-mail, configure SMTP próprio antes de uso público e senha mínima de doze caracteres. TOTP é ativado no Centro de Privacidade. Após habilitar um fator, RLS exige JWT aal2. Os nomes de menu do painel podem mudar.

## 5. Preencha os segredos

Copie `.env.server.example` para `.env.server`, ignorado pelo Git. Nunca envie chaves pelo chat ou use prefixo `VITE_` em secrets.

| Variável                        | Onde obter                                                                  | Onde colocar                            | Visibilidade                                         |
| ------------------------------- | --------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL no painel Supabase                                                      | `.env` + variável GitHub                | Pública                                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase API Keys → publishable/anon                                        | `.env` + variável GitHub                | Pública, limitada por RLS                            |
| `SUPABASE_URL`                  | Mesma URL                                                                   | `.env.server`, para ingestão            | URL pública usada no servidor                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase API Keys → legacy service_role                                     | `.env.server`, só ingestão local        | **Secreta**; Functions recebem automaticamente       |
| `OPENAI_API_KEY`                | [OpenAI API keys](https://platform.openai.com/api-keys)                     | `.env.server` → secrets                 | **Secreta**                                          |
| `OPENAI_MODEL`                  | [Catálogo oficial](https://developers.openai.com/api/docs/models)           | `.env.server` → secrets                 | Exemplo `gpt-6.1-sol`                                |
| `OPENAI_EXTRACTION_MODEL`       | Mesmo catálogo                                                              | `.env.server` → secrets                 | Exemplo `gpt-6-luna`                                 |
| `OPENAI_EMBEDDING_MODEL`        | [Embeddings](https://developers.openai.com/api/docs/guides/embeddings)      | `.env.server` → secrets                 | Exemplo `text-embedding-3-small`, dimensão 1536      |
| `OPENAI_TRANSCRIPTION_MODEL`    | [Transcrição](https://developers.openai.com/api/docs/guides/speech-to-text) | `.env.server` → secrets                 | Exemplo `gpt-4o-mini-transcribe`                     |
| `ALLOWED_ORIGIN`                | Origem do frontend                                                          | `.env.server` → secrets                 | `https://ruan-crdz.github.io`, sem `/nexo/`          |
| `WHATSAPP_ACCESS_TOKEN`         | Meta app → WhatsApp → configuração/API                                      | `.env.server` → secrets                 | **Secreta**; token adequado à operação               |
| `WHATSAPP_PHONE_NUMBER_ID`      | Painel WhatsApp Meta                                                        | `.env.server` → secrets                 | ID do número, não o telefone                         |
| `WHATSAPP_APP_SECRET`           | Meta app → configurações básicas → App Secret                               | `.env.server` → secrets                 | **Secreta**, valida HMAC                             |
| `WHATSAPP_VERIFY_TOKEN`         | Gere valor longo e aleatório no seu gerenciador de senhas                   | `.env.server` e campo Verify Token Meta | **Secreta**                                          |
| `WHATSAPP_GRAPH_VERSION`        | Versão suportada nas configurações/docs Meta                                | `.env.server` → secrets                 | Formato `vNN.N`; não use versão permanente presumida |

`ALLOWED_ORIGIN` aceita lista separada por vírgulas; não use `*`. Nomes de modelos são exemplos consultados na documentação, não garantia de acesso na sua conta.

```sh
npm run secrets:prepare
npx supabase secrets set --env-file .env.functions
npx supabase functions deploy
```

O script exclui variáveis reservadas `SUPABASE_*`, injetadas pela plataforma, e não exibe valores. `.env.functions` também é ignorado pelo Git. `verify_jwt=false` é intencional: endpoints de usuário verificam JWT com `auth.getUser()` e MFA; o webhook verifica HMAC Meta.

## 6. Indexe o RAG

```sh
npm run rag:check
npm run rag:seed
```

O primeiro comando só valida o seed. O segundo usa Supabase e OpenAI, com custo de embeddings. Candidatos não revisados continuam excluídos. Veja [RAG.md](RAG.md).

## 7. Ative o WhatsApp

1. No app Meta, configure Callback URL `https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`.
2. Use o mesmo `WHATSAPP_VERIFY_TOKEN` dos secrets e assine o evento `messages`.
3. Confira que o número de destino corresponde a `WHATSAPP_PHONE_NUMBER_ID`.
4. No Nexo real → WhatsApp → **Gerar código de vinculação**.
5. Envie `vincular CODIGO` ao número oficial em até dez minutos.
6. Envie um gasto, confira no app e envie `desfazer`.
7. Envie áudio com dois gastos e confira valores, categorias e datas.

A documentação Meta bloqueou leitura automática nesta sessão. A implementação precisa de homologação no seu número de teste; não há garantia de aprovação do app ou entrega. Regras de templates/janelas precisam ser confirmadas na sua conta.

## 8. Agende retenção e operação

No Supabase Cron/pg_cron, agende diariamente:

```sql
select public.prune_ephemeral_data();
```

Sem agendamento, a limpeza não ocorre sozinha. Configure backup, restauração, alertas e limites de orçamento na OpenAI. Veja [PRIVACY.md](PRIVACY.md).

## 9. Publique no GitHub Pages

1. Envie o projeto ao repositório `ruan-crdz/nexo` com seu fluxo Git. Nenhum push foi feito automaticamente.
2. Settings → Secrets and variables → Actions → **Variables**: adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Settings → Pages → Source: **GitHub Actions**.
4. Actions → **Publish GitHub Pages** → Run workflow.
5. Abra `https://ruan-crdz.github.io/nexo/`.

O workflow usa base `/nexo/`; ajuste se renomear o repositório. Em domínio próprio use `/`. HashRouter permite refresh de rotas sem servidor. Sem variáveis Supabase, a publicação oferece somente demo.

## 10. Homologue

Confira [STATUS](docs/STATUS.md). Crie duas contas de teste e exercite isolamento, papéis, MFA, recuperação de senha, RAG vazio/com fontes, webhook duplicado, áudio, confirmação, desfazer, exportação, exclusão e restauração de backup. Testes locais não comprovam configuração dos serviços externos.
