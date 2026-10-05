# Matriz de entrega e limites

Registro inicial: 04/10/2026. O pedido descreve um produto extenso. Esta entrega implementa uma versão inicial executável com os fluxos centrais e backend integrável, mas não cumpre ainda toda a definição de pronto de produção.

## Implementado e verificável localmente

Atualização de integração: Supabase configurado e OpenAI ativa no backend. Busca de fontes, extração de gasto, esclarecimento de valor ausente e resposta do assistente passaram com chamadas reais. Ver [VALIDATION](VALIDATION.md). Continuam pendentes SMTP, Meta/WhatsApp, publicação do frontend e as homologações restantes abaixo.

| Área                | Entrega                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto/arquitetura | Benchmark com fontes, arquitetura, tokens e roadmap                                                                                                                     |
| Frontend            | Landing, auth, onboarding, home, listas/formulários, metas, jornada, orçamento, dívidas, patrimônio, cenários, relatórios, assistente, perfil, privacidade, integrações |
| Persistência        | Demo no navegador; repositório Supabase com validação, erro explícito e Realtime para movimentos pessoais                                                               |
| Motor               | Centavos/BigInt, taxas, juros, Price/SAC, parcelas, metas, inflação, score, reserva, quitação, runway, break-even, contratação, unit economics                          |
| Empresas            | Workspace, cadastro de empresa/equipe, orçamento por categoria, fluxo/previstos, DRE estimada, cenários, papéis e auditoria                                             |
| Banco               | Migrations reais testadas em Postgres WASM, RLS, FK cruzada, RPCs atômicas, MFA                                                                                         |
| APIs                | Endpoints de IA, RAG, extração, transcrição, plano, análise empresarial, vínculo/webhook/envio controlado, exportação/exclusão                                          |
| Privacidade         | Exportação, histórico opt-in, revogação, sessões, exclusão explícita de conta/empresa, limpeza operacional configurável                                                 |
| Publicação          | Build estático com base path/HashRouter e GitHub Actions                                                                                                                |

## Implementado, mas depende de homologação externa

- Supabase Auth, entrega de e-mail, recuperação de senha, TOTP e Realtime hospedados.
- OpenAI: avaliação ampla de qualidade e custo/latência, além de transcrição real de áudio. Acesso aos modelos, extração e resposta com fontes passaram no teste hospedado.
- Ingestão real de embeddings e qualidade de recuperação da base no projeto do usuário.
- Meta: app/número, tokens, permissões, webhook, download de mídia, resposta e políticas vigentes.
- Publicação Pages, CORS e redirects no domínio final.
- Cron de retenção, backup/restauração, observabilidade e revisão jurídica/financeira.

Supabase e OpenAI foram conectados com credenciais reais e testados. Não houve mensagem WhatsApp real, push ou publicação do frontend.

## Requisitos do pedido ainda não implementados integralmente

- Recorrências automáticas, lembretes/agenda e notificações proativas.
- Histórico transacional de aportes e pagamentos de dívida, conciliação de transferências e fatura completa de cartões.
- Snapshots históricos automáticos de patrimônio/score e acompanhamento de marcos concluídos. A home mostra o próximo marco; evolução sem base não é inventada.
- Jornada considerando todas as variáveis biográficas propostas (profissão, idade, formação etc.). A heurística atual usa contexto financeiro, dependentes, renda variável e proteção.
- Gestão de categorias/departamentos como entidades independentes, limites por departamento e administração de convites por e-mail.
- Metas empresariais específicas, cenários salvos, demissão/filial/equipamentos como fluxos dedicados e painel de unit economics. Fórmulas de unit economics existem no motor.
- Todos os comandos WhatsApp da especificação: empréstimos pessoais, metas, cartões e lembretes são recusados como não suportados. Texto/áudio de movimentos, parcelas, perguntas, confirmação e desfazer estão implementados.
- Recibos/imagens/visão e Open Finance: planejados, sem integração falsa.
- Base RAG extensa de estudos A/B e curadoria brasileira aprofundada: seed inicial tem treze princípios revisados e sete candidatos inativos.
- Fila durável para WhatsApp, dashboard de custos, orçamento de IA por conta e avaliação semântica contínua.
- Paginação de grandes históricos, prevenção de sobrescrita concorrente em todos os formulários, testes completos de acessibilidade assistiva e segurança independente.

## Evidência de validação

Os comandos reproduzíveis ficam no README. Relatório final de execução: `docs/VALIDATION.md`. Migrations são exercitadas com roles e policies reais no PGlite; o schema Auth é uma fixture. Backend Deno é testado sem rede com respostas externas controladas. Playwright roda em desktop e celular; axe valida a home. Esses resultados não equivalem a homologação de serviços externos.
