# Nexo 1.0 — Polimento e validação

Esta matriz registra evidências verificáveis e separa testes automatizados de validações que dependem de pessoas, dispositivos ou serviços externos. Não trate mocks como homologação real.

| # | Frente | Estado | Evidência e limite |
| --- | --- | --- | --- |
| 1 | Auditoria visual | Automatizada | 25 rotas capturadas em 390×844 e 1440×900; 27 screenshots em viewport equivalente ao iPhone Pro Max (440×956 CSS, DPR 3, PNG 1320×2868) em [docs/screenshots/iphone-18-pro-max/README.md](screenshots/iphone-18-pro-max/README.md). São capturas do browser, não de aparelho físico. |
| 2 | Teste dos 5 segundos | Pendente externo | Requer participantes novos sem explicação prévia. Ainda não realizado; resultados não foram simulados. |
| 3 | Onboarding | Implementado | Nome → objetivo opcional → WhatsApp opcional → tour/Home. E2E focado passou em desktop e mobile para a sequência e opção de seguir sem WhatsApp. Compreensão real ainda requer participante. |
| 4 | WhatsApp — 50 frases reais | Pendente externo | Há testes Edge mockados para texto, navegação, correção/desfazer, contexto e respostas; não foram enviados 50 textos/áudios a um número Meta real. Isso exige número de teste autorizado e revisão de consentimento. |
| 5 | Loading, erro e empty states | Parcial | Busca estática e revisão das rotas principais; timeouts/retry nos fluxos críticos de Família, WhatsApp, MFA e Offline. Não prova todos os estados de serviço real nem cada resposta a falha de rede. |
| 6 | Confiança nos números | Parcial | Cálculos são determinísticos pelo Financial Engine e cobertos por testes unitários/Edge; a interface distingue previsto/registrado e informa que estimativas não são saldo bancário. Uma revisão independente de cada texto financeiro ainda falta. |
| 7 | Nexo IA | Parcial | Testes Edge confirmam uso de cálculos do motor, registros do usuário e fallback para falhas de IA/RAG. Não há bateria cega de 50 perguntas reais nem avaliação humana de qualidade. |
| 8 | Acessibilidade | Automatizada + pendente física | Axe WCAG 2.2 AA, temas claro/escuro, teclado/Escape e fonte a 200% estão cobertos por E2E. VoiceOver/TalkBack em aparelhos físicos não foi homologado. |
| 9 | Performance percebida | Parcial | Rotas secundárias são lazy-loaded e o build é medido no CI. O build aponta chunk `heic2any` de ~1,35 MB, isolado em asset próprio; não foi feito profiling em aparelho nem levantamento de requests duplicadas. |
| 10 | Segurança | Automatizada em teste; pendente live | Testes Edge/RLS e casos de duas identidades cobrem autorização em ambiente de teste. Não foi feito pentest em produção, ataque com credenciais reais ou revisão de upload contra infraestrutura live. |
| 11 | Remover o que não agrega | Parcial por decisão de produto | Empresa, score e simuladores já foram removidos da navegação pública. Não removi outras funções sem dados de uso/entrevistas que indiquem baixo valor. |
| 12 | Portfólio | Parcial | README e arquitetura estão no repositório; 27 screenshots Pro Max e vídeo demo em WebM estão vinculados abaixo. O vídeo usa somente dados demo; não representa uma mensagem WhatsApp real. O teste presencial continua sendo a próxima evidência de produto. |

## Evidências

- [`docs/screenshots/iphone-18-pro-max/README.md`](screenshots/iphone-18-pro-max/README.md): 27 PNGs de 1320×2868, viewport equivalente ao iPhone Pro Max.
- [`docs/videos/nexo-1.0-demo.webm`](videos/nexo-1.0-demo.webm): demonstração local, sem áudio/mensagem Meta real.
- [`PROFILE_UX_REFACTOR.md`](../PROFILE_UX_REFACTOR.md): matriz das 12 telas de Perfil.
- README e arquitetura: [`README.md`](../README.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Gates executados

- `npm run check`: lint, typecheck, 162 testes unitários e build passaram.
- `npm run typecheck:edge`: passou.
- `npm run test:edge`: 57 testes passaram.
- `npm run rag:check`: 20 documentos válidos; 13 revisados e 7 candidatos excluídos.
- `npx playwright test --workers=1`: 114 E2Es passaram em projetos desktop e mobile; inclui axe e a sequência atual do onboarding.

## Próximos passos externos

1. Fazer o teste de 5 segundos com pessoas sem familiaridade com o Nexo e registrar onde hesitam.
2. Homologar 50 mensagens/áudios variados em um número Meta de teste autorizado, incluindo ambiguidade, correção e desfazer.
3. Validar Família com duas contas Supabase separadas; TOTP e fila offline com conta autenticada.
4. Revisar com VoiceOver/TalkBack e medir Home/Histórico em aparelhos físicos.
5. Fazer revisão de segurança independente antes de ampliar o uso público.
