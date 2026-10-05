> Atualização de 05/10/2026: veja [Simplificação e confiabilidade](SIMPLICITY-RELEASE.md). Os registros abaixo são históricos e não representam o estado atual de publicação ou do WhatsApp.

# Validação da entrega

Executado em 04/10/2026, Windows/PowerShell, Node 24.12.0. Scripts foram executados com `npm.cmd` por causa da política local do PowerShell. A rodada inicial abaixo foi local; as integrações hospedadas posteriores estão registradas ao final.

| Verificação                                       | Resultado                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Instalação limpa `npm ci`                         | Aprovada; lockfiles usam registry.npmjs.org, sem dependência de mirror privado  |
| `npm run lint`                                    | Aprovado, zero warnings                                                         |
| `npm run typecheck`                               | Aprovado                                                                        |
| `npm run test:coverage`                           | 51 testes aprovados, incluindo 11 de banco                                      |
| Cobertura Financial Engine                        | 100% statements/linhas/funções; 95,13% branches                                 |
| `npm run typecheck:edge`                          | Todos os 12 entrypoints aprovados no Deno                                       |
| `npm run test:edge`                               | 5 testes aprovados, sem permissão de rede                                       |
| `npm run rag:check`                               | 20 documentos válidos; 13 revisados, 7 candidatos inativos                      |
| `npm run test:e2e`                                | 10 testes aprovados, desktop e Pixel 7                                          |
| Rechecagem de simulações após fortalecer asserção | 2 testes aprovados; custo exato de três contratações verificado                 |
| Axe na home                                       | Nenhuma violação nos grupos WCAG 2/2.1/2.2 A/AA examinados, em desktop e mobile |
| Build local                                       | Aprovado; arquivos divididos em chunks menores que 500 kB                       |
| Build `VITE_BASE_PATH=/nexo/`                     | Aprovado                                                                        |
| `node scripts/check-pages.mjs`                    | Assets, chunks, navegação e refresh em `/nexo/#/metas` sem erro/HTTP 4xx        |
| `npm audit --omit=dev`                            | Zero vulnerabilidades reportadas naquele momento                                |
| Busca de nomes de secrets privilegiados no bundle | Nenhuma ocorrência de OPENAI_API_KEY, SERVICE_ROLE_KEY ou WHATSAPP_ACCESS_TOKEN |
| `git diff --check`                                | Sem erros de whitespace                                                         |

Total: **66 casos distintos automatizados aprovados**, além de verificações de build, instalação, seed e auditoria de dependências. Reexecuções não foram contadas como testes adicionais.

Os testes de banco aplicam as migrations reais em PostgreSQL via PGlite/pgvector. O schema Auth e claims JWT são fixtures, portanto não comprovam o comportamento do serviço Auth hospedado. Os testes de API OpenAI usam respostas controladas. HMAC, contratos de extração, RLS, RBAC, MFA e idempotência são exercitados localmente; integração externa e concorrência distribuída permanecem por homologar.

Screenshots desktop/mobile foram renderizados pelo Playwright e inspecionados visualmente. Acessibilidade automática não é certificação nem substitui revisão com tecnologia assistiva.

Prévia iniciada nesta sessão: `http://127.0.0.1:4173/nexo/`. Se o processo não estiver mais ativo, execute `npm run dev` para abrir a versão de desenvolvimento em `http://localhost:5173`.

Ainda não executado: entrega de e-mail, MFA remoto, transcrição real de áudio, entrega Meta, publicação do frontend, push ou restauração de backup. Consulte [STATUS](STATUS.md) e [DEPLOYMENT](../DEPLOYMENT.md) para concluir essas etapas e conhecer os requisitos funcionais pendentes.

## Configuração hospedada do Supabase — 04/10/2026

Projeto `rusyuburebykohuadbwt` vinculado. Quatro migrations aplicadas; nova simulação de `db push` confirmou banco atualizado. As 20 tabelas públicas têm RLS ativo. As 12 Edge Functions estão ACTIVE, com autenticação explícita no código e import map declarado no config.toml.

Auth configurado com senha mínima de 12 caracteres, confirmação de e-mail, TOTP e redirects locais (5173/4173) e GitHub Pages. Site URL atual: `http://localhost:5173`. `config diff` confirmou zero alterações declaradas pendentes. CORS aceita as origens locais e `https://ruan-crdz.github.io`.

Teste hospedado com duas contas temporárias: login por senha; trigger de perfil; criação de transação; bloqueio de leitura e escrita entre usuários; plano semanal; exportação; CORS; rejeição de token inválido; exclusão de conta. Todos passaram; contas e dados temporários foram removidos. Não foram enviados e-mails no teste.

Cron `nexo-prune-ephemeral` ativo diariamente às 06:15 UTC, conforme `supabase/operations/retention.sql`. O agendamento foi verificado; a primeira execução automática ainda não foi observada. Instalação baseada na [documentação oficial do Supabase Cron](https://supabase.com/docs/guides/cron/install).

`.env`, `.env.server` e `.env.functions` configurados e ignorados pelo Git. A chave privilegiada está apenas no arquivo de servidor; valores não foram registrados na documentação. As credenciais Meta continuam pendentes. A OpenAI foi configurada e testada conforme o registro abaixo.

## OpenAI hospedada — 04/10/2026

Chave enviada aos secrets das Edge Functions, sem exposição ao frontend. Consulta autenticada ao catálogo confirmou acesso aos quatro modelos configurados: `gpt-6.1-sol`, `gpt-6-luna`, `text-embedding-3-small` e `gpt-4o-mini-transcribe`.

Ingestão concluída: 20 documentos cadastrados, dos quais 13 revisados com embeddings de 1536 dimensões. Os sete candidatos permanecem excluídos da recuperação.

Testes com chamadas reais pelo backend hospedado e conta temporária:

- `rag-search`: retornou cinco fontes verificadas para uma pergunta sobre reserva de emergência.
- `ai-transaction-parser`: interpretou um gasto de R$ 25,00 como 2500 centavos.
- `ai-transaction-parser`: pediu esclarecimento quando o gasto não tinha valor, sem gerar lançamento.
- `ai-chat`: respondeu em português com três fontes e passou pela validação que separa texto gerado dos cálculos financeiros.

Todos passaram. A conta temporária foi removida; não houve gravação de gastos ou histórico de conversa. Transcrição de áudio teve apenas acesso ao modelo confirmado, sem envio de áudio nesta rodada. Esses testes pontuais não substituem avaliações amplas de qualidade, custo e latência.
