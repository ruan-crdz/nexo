# Refatoração de UX do Nexo

Status: em andamento. Shell, Home e mapa “Início/Histórico/Você” já foram simplificados; captura, movimentos e planejamento preservam seus fluxos. Integrações, recibos/extratos, família, autenticação e ajuda ainda precisam de revisão própria; não considerar a iniciativa concluída.

## Princípios e limites

- Referência de experiência: hierarquia por tarefa, ações frequentes, conteúdo progressivo, microcopy simples e segurança encontrável. Não reproduzir telas pixel a pixel, marca, ativos, textos ou componentes da Nubank.
- Preservar nome, logo, componentes, conteúdo e paleta existentes do Nexo. Os tokens atuais em `src/design-system/tokens.css` são a fonte de verdade. A paleta descrita no pedido difere dos valores versionados; nenhuma troca de cor fica implícita nesta refatoração.
- Não apresentar o Nexo como banco, corretora ou Open Finance. Não inventar saldo, cotações, proteções ou integração.
- Manter Financial Engine, contratos Zod, Supabase, RLS, Edge Functions, autenticação/MFA, modo demo isolado, offline, recibos, extratos e família.
- Mudanças desta iniciativa são de experiência, apresentação e navegação, salvo aprovação explícita para mudanças de domínio.

## Arquitetura anterior

- React, TypeScript, Vite e HashRouter. Rotas registradas em `src/App.tsx`; telas autenticadas compartilham `src/features/Shell.tsx`.
- `AppProvider` fornece sessão, estado MFA, demo, dataset, repository e toast. `src/data/repository.ts` escolhe repositório local de demo ou Supabase por usuário.
- `shared/` contém regras puras, dinheiro em centavos, datas civis, decisões, planejamento, importação e contratos. Edge Functions tratam IA, RAG, recibos, WhatsApp e direitos da conta.
- A interface combina `src/design-system/styles.css` e `simple.css`; os tokens de marca ficam em `tokens.css`. Componentes existentes incluem `Brand`, `Button`, `PageHeader`, `Card`, `SectionTitle`, `Stat`, `Progress`, `Badge`, `Empty`, `Why` e `Dialog`.
- O shell atual tem rail lateral desktop discreto e três destinos principais: Início, Histórico e Você. Mobile usa rodapé de três itens. Cabeçalho mostra avatar/saudação, olho e Proteção; Anotar fica na Home.
- Existem telas antigas em `Home.tsx`, `Settings.tsx`, `Planning.tsx`, `Resources.tsx` e `Business.tsx`. Elas não são rotas pessoais ativas em `App.tsx`; `Resources.tsx` ainda exporta utilitário usado pela importação. Não apagar sem rastrear dependências.

## Mapa de telas e rotas

| Rota atual                   | Função e uso atual                                                                                                       | Novo destino mental                             | Reuso e migração                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                          | Apresentação, cadastro e entrada na demo (`SimpleLanding`)                                                               | Acesso ao Nexo                                  | Reusar marca, cadastro e demo explícita; não recriar o onboarding autenticado como landing longa.                                             |
| `/login`                     | Autenticação (`AuthPage`)                                                                                                | Perfil/entrada de conta                         | Preservar Supabase Auth, recuperação e estados existentes; só reorganizar layout.                                                             |
| `/cadastro`                  | Criação de conta (`AuthPage`)                                                                                            | Perfil/entrada de conta                         | Preservar validação e auth.                                                                                                                   |
| `/recuperar`                 | Recuperação de senha (`AuthPage`)                                                                                        | Perfil/segurança                                | Preservar fluxo.                                                                                                                              |
| `/redefinir-senha`           | Redefinição de senha (`AuthPage`)                                                                                        | Perfil/segurança                                | Preservar fluxo.                                                                                                                              |
| `/onboarding`                | Três etapas: nome, WhatsApp opcional e objetivo (`SimpleOnboarding`)                                                     | Início/primeiro acesso                          | Persiste o nome antes da conexão; integração pode ser pulada; objetivo fica no perfil ao finalizar.                                           |
| `/inicio`                    | Resultado do mês, CTA WhatsApp, dois atalhos, insight opcional, meta e até três movimentos (`SimpleHome`)                | Início: conferir em cinco segundos              | Gráficos, alertas e calendário saíram da tela inicial; cálculos continuam disponíveis em Histórico/Planejar. Resultado não é saldo bancário.  |
| `/anotar`                    | Página de compatibilidade (`CapturePage`); ação global abre diálogo/folha com Digitar, Falar, Recibo, Extrato e WhatsApp | Ação global Anotar                              | A captura global e atalhos da Home usam `MoneyForm` e mantêm revisão. A URL antiga segue acessível.                                           |
| `/movimentos`                | Busca, mês, filtros de entradas/gastos/origem/pendentes, detalhe e CRUD (`SimpleHistory`, `MoneyRows`)                   | Movimentos: “O que aconteceu?”                  | Detalhe mostra data, categoria, origem, status e conta quando existe; ledger e CRUD preservados.                                              |
| `/planejar`                  | Próximas contas, limites, metas e recorrências em seções verticais (`PlanningHub`)                                       | Planejar: “O que vai acontecer?”                | Migração de tabs para lista vertical concluída; schemas e operações do repository preservados.                                                |
| `/metas`                     | Progresso, hábitos e eventos de meta (`GoalsPage`, `GoalJourney`)                                                        | Planejar > Metas                                | Reusar motor `goalJourney`, eventos e consentimentos; manter `/metas` como URL compatível.                                                    |
| `/controle`                  | Permissão de gasto, padrões, faturas, histórico, preferências e operação (`FinancialTools`)                              | Nexo > Posso gastar?; configurações em Perfil   | Separar decisões de preferências/operação sem duplicar cálculos; manter redirect/alias compatível.                                            |
| `/perguntas`                 | Perguntas determinísticas e evidências (`FinancialQuestions`)                                                            | Nexo > respostas calculadas                     | Reusar `answerFinancialQuestion`; incorporar sugestões sem substituir o cálculo pela IA.                                                      |
| `/nexo`                      | Página de entendimento com sugestões, pergunta Posso gastar?, conversa, métricas e fontes (`AssistantPage`)              | Nexo: entender e decidir                        | Sugestões e respostas sem cartão de chat genérico; preserva Edge Function, fontes, demo e explicabilidade. Layout ainda precisa de polimento. |
| `/integracoes`               | Conectar, verificar e revogar WhatsApp (`IntegrationsPage`)                                                              | Perfil > Integrações; atalho em Anotar          | Reusar vínculo/status e recuperação; manter URL como alias. WhatsApp não vira destino da navegação principal.                                 |
| `/importar`                  | CSV/OFX/QFX, mapeamento, revisão, deduplicação e confirmação (`StatementImport`)                                         | Anotar > Importar extrato; Perfil > Integrações | Reusar parser e revisão; não salvar antes da confirmação; manter URL antiga.                                                                  |
| `/recibo`                    | Foto/PDF, extração, revisão e confirmação (`ReceiptImport`)                                                              | Anotar > Fotografar recibo                      | Reusar processamento/limites e revisão; manter URL antiga e demo sem falsa conexão de IA.                                                     |
| `/familia`                   | Convites, escopo, consentimento, snapshot e propostas (`FamilyPage`)                                                     | Perfil > Família                                | Reusar RPCs, RLS, escopos e confirmação; não ampliar compartilhamento automaticamente.                                                        |
| `/perfil`                    | Nome, tema, offline, avisos, integrações/família, privacidade e ajuda agrupados (`SimpleSettings`)                       | Perfil: conta e configurações                   | Seções reorganizadas; estados, persistência, consentimento e rollback preservados. Ainda precisa de revisão visual completa.                  |
| `/seguranca`                 | Configuração/verificação TOTP (`MfaPage`) e status confirmado                                                            | Proteção, acessível pelo escudo e pelo Perfil   | Mostra somente TOTP vindo do Supabase; não exibe sessões ou último acesso inexistentes.                                                       |
| `/privacidade`               | Exportar dados, explicar tratamento e excluir conta (`SimplePrivacy`)                                                    | Perfil > Privacidade                            | Reusar export/delete Edge Functions e confirmação explícita.                                                                                  |
| `/ajuda`                     | Instruções curtas por tarefa (`SimpleHelp`)                                                                              | Perfil > Ajuda                                  | Reusar conteúdo e links para movimentos/integração.                                                                                           |
| Qualquer rota não registrada | Atualmente redireciona para `/inicio`                                                                                    | Alias específico ou fallback seguro             | Adicionar redirects explícitos para URLs antigas importantes; manter fallback sem tela quebrada. `/investimentos` não será recriada.          |

### Rotas antigas e módulos fora do shell pessoal

- `/empresa`, `/futuro` e `/patrimonio` não são rotas atuais; testes confirmam fallback. Mapear aliases apenas quando um destino pessoal inequívoco existir.
- `/investimentos` permanece fora do produto. Tipos de conta/ativo com `investment` são dados de domínio existentes, não uma tela Investir.
- `Business.tsx`, `Home.tsx`, `Planning.tsx`, `Settings.tsx` e partes de `Resources.tsx` parecem pertencer a experiências legadas/empresariais. Localizar importadores antes de remover ou mover qualquer módulo.

## Navegação observada

- Mobile lista Início, Histórico e Você. Planejar, Nexo e demais capacidades ficam contextuais ou dentro de Você. Anotar abre a folha inferior a partir da Home.
- Desktop usa rail lateral com Início, Histórico e Você; o conteúdo mantém largura máxima confortável.
- Olho persiste a preferência localmente e mascara valores renderizados nas áreas pessoais ativas, respostas textuais do Nexo e dados familiares/financeiros. Campos editáveis continuam legíveis durante a digitação. E2E cobre mudança entre páginas e reload.
- Escudo abre `/seguranca`, que mostra apenas estado/configuração TOTP confirmado. Não afirmar sessões, último acesso ou cobertura global.

## Antes → Depois

| Área               | Antes                                                               | Depois planejado                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell              | Cabeçalho com menu horizontal ou rodapé                             | Rail desktop e três destinos (Início, Histórico, Você); avatar/saudação, olho e Proteção. Implementado; ainda exige sweep final.                           |
| Início             | Painel com blocos/cartões e prioridades difusas                     | Seu mês, CTA WhatsApp, dois atalhos, um insight, uma meta e três movimentos. Gráficos/alertas fora da Home. Implementado; critérios E2E ativos.            |
| Onboarding         | Formulário de nome que encerrava a configuração                     | Nome, WhatsApp opcional e objetivo principal em três passos. Implementado sem forçar conexão.                                                              |
| Anotar             | Página separada que encaminha para vários fluxos                    | Bottom sheet/dialog, Digitar progressivo, Falar, Recibo, Extrato e WhatsApp. Implementado com `MoneyForm` existente.                                       |
| Movimentos         | Histórico chamado de anotações                                      | Busca, mês, entradas/gastos/origem/pendentes, detalhe e CRUD. Implementado com origem explícita.                                                           |
| Planejar           | Três tabs que escondiam contexto                                    | Próximas contas, limites, metas e recorrências em seções verticais. Implementado; precisa de validação final.                                              |
| Nexo               | Chat em cartão e perguntas determinísticas separadas                | Sugestões, Posso gastar?, resposta de leitura clara, cálculo, fontes e privacidade. Estrutura inicial implementada; composição da resposta ainda pendente. |
| Perfil/Proteção    | Links financeiros misturados a conta/configurações                  | Grupos de conta, integrações/família, segurança/privacidade e ajuda; TOTP real. Primeira organização implementada.                                         |
| Fluxos secundários | Importação/recibo, família, ajuda e autenticação com layout próprio | Preservados, ainda pendentes de composição responsiva e fluxos progressivos próprios.                                                                      |

## Plano de execução

1. Mapeamento de rotas, arquitetura e contratos: concluído.
2. Shell e navegação desktop/mobile: três destinos concluídos.
3. Design system: provider global de privacidade e formato monetário concluído; faltam padrões de skeleton, detalhe e seção.
4. Home e captura: Home de conferência e ações comuns concluídas; fluxos menos usados seguem em telas próprias.
5. Movimentos, filtro Pendentes, detalhe e desfazer da gravação manual: primeira implementação concluída. Undo não é oferecido para registro real ainda enfileirado offline.
6. Planejar: tabs substituídas por seções; validação completa da fase pendente.
7. Nexo: estrutura de sugestões e explicabilidade iniciada; revisão da resposta/decisão pendente.
8. Perfil e Proteção: agrupamento inicial concluído; integração e MFA mantidos.
9. Refatorar layouts próprios de recibo, extrato, família, ajuda, privacidade e autenticação.
10. Polir acessibilidade, teclado, zoom, loading/skeleton e reduced motion.
11. Rodar gates completos, E2E em 320/360/375/390/430/768/1024/1440 e validar deploy antes de declarar conclusão.

## Componentes e contratos

- Reusar `MoneyRows`, `MoneyForm`, `PlanningHub`, `GoalJourney`, `AssistantPage`, `FinancialTools`, `StatementImport`, `ReceiptImport`, `IntegrationsPage`, `FamilyPage`, `MfaPage` e `SimplePrivacy` conforme o destino acima.
- `FinancialVisibilityProvider`, `useMoneyDisplay`, `MoneyValue`, `redactFinancialText` e `CaptureFlowProvider` foram adicionados para privacidade e captura compartilhadas. Toast aceita ação opcional; `Dialog` aceita classe específica para a folha inferior de Anotar. Novos padrões candidatos: `QuickAction`, `TransactionRow`, `Insight`, `SecurityStatus` e `Skeleton`; criar apenas quando reduzirem repetição real.
- Preservar `Dataset`, schemas Zod, `Repository`, modo demo namespaced, RLS, RPCs, centavos/BigInt, datas civis, Edge Functions e fontes RAG. Mudança de UI não autoriza migration nem mudança de dado.

### Criados e removidos

- Criados: `FinancialVisibilityProvider`, `MoneyValue`, `useMoneyDisplay`, `redactFinancialText`, `CaptureFlowProvider` e `useCaptureFlow`; toast global com ação opcional; bottom sheet mobile de captura, rail desktop, trilho de ações Home, seção de contas próximas e detalhe de movimento.
- Removidos como padrões de interface, sem apagar capacidades: tabs de Planejar; barra de seis opções imediatas em Mais controle; cartão genérico em volta de toda a experiência de chat; três cards independentes de privacidade; tela de sucesso pós-registro substituída por toast com Desfazer quando a remoção é segura; grade/atalhos redundantes da Home.
- Nenhuma rota de backend ou função de domínio foi removida. `/anotar`, `/controle`, `/integracoes`, `/importar`, `/recibo`, `/familia`, `/seguranca` e `/privacidade` continuam acessíveis; `/investimentos` não foi recriada.

## Acessibilidade e privacidade

- Alvo WCAG 2.2 AA, corpo mínimo legível, alvos de toque de pelo menos 44 px, labels persistentes, teclado/foco, contraste, zoom, fonte ampliada, sem quebra de palavras ou rolagem horizontal e respeito a reduced motion.
- Demo sempre identificada. Cálculos distinguem anotações de saldo bancário; valores ocultos não podem permanecer expostos para leitores de tela quando o olho estiver fechado.
- Não simular MFA, sessões, último acesso, integrações, cobertura de contas, retorno ou oferta financeira. Segurança e privacidade devem refletir dados reais disponíveis.

## Riscos e validação

- A base contém folhas grandes e regras compartilhadas; cada fase deve validar o fluxo tocado e todo o sweep responsivo.
- O shell é usado por páginas lazy-loaded e estados demo/offline/MFA; mudança de layout não deve contornar redirecionamentos nem controles de autenticação.
- Importação e recibo só salvam após revisão; família depende de consentimento/RLS; IA só interpreta cálculos e evidências. Esses limites são critérios de aceite.
- Testes atuais incluem 118 unitários, testes SQL/RLS, Edge e Playwright; os E2E existentes cobrem demo, movimentos, importação, metas, MFA, privacidade, acessibilidade, tema, nove larguras e offline. Revisão com usuários e leitores de tela ainda é necessária; testes automatizados não a substituem.
