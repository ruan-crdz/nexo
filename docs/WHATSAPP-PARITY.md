# App e WhatsApp: paridade

Esta revisão implementa chat com ferramentas para o espaço pessoal. Não implementa literalmente todas as operações do app.
Texto e áudio transcrito usam o mesmo fluxo conversacional, sem exigir comandos de consulta. Ferramentas consultam dados reais; propostas de alteração precisam de autorização em outro turno e expiram em dez minutos.

| Ações existentes no app                                                                                       | Chat nesta revisão                                        | Limites                                                                      |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Movimentos: criar entrada/gasto, corrigir descrição/valor/data/categoria/conta, marcar pago/pendente, excluir | Consultar, preparar e confirmar alteração                 | Não executa pagamento real                                                   |
| Histórico: filtrar por período, descrição/categoria, conferir origem e estado                                 | Consulta e totais calculados em código                    | Até 30 registros por ferramenta; totais usam todos os resultados             |
| Resumo, contas pendentes, comparação de gastos, previsões                                                     | Cálculos verificados e gráficos                           | Não confundir anotações com saldo bancário                                   |
| Recorrências: criar, editar vencimento/valor/frequência/tipo, pausar/reativar, excluir                        | Consultar, preparar e confirmar alteração                 | Pergunta dados faltantes; recorrência não é pagamento realizado              |
| Contas e cartões: nome, tipo, saldo inicial informado, fechamento, vencimento, limite                         | Consultar, preparar e confirmar alteração                 | Saldo inicial não é confirmado automaticamente; limite não é dinheiro        |
| Metas: consultar, criar, editar objetivo/prazo/contribuição/prioridade, excluir                               | Consultar, preparar e confirmar alteração                 | Progresso guardado exige ferramenta própria; ainda no app                    |
| Orçamentos: categoria, limite e mês                                                                           | Consultar, criar, editar, excluir com confirmação         | Valores em centavos                                                          |
| Dívidas e patrimônio: consultar, criar, editar, excluir                                                       | Ferramentas de consulta e alteração                       | Não realiza quitação/transferência/investimento                              |
| Perfil: nome, objetivo, renda/despesas, dependentes, fuso, preferências de jornada                            | Consultar e atualizar com confirmação                     | Segurança e consentimento de avisos bloqueados                               |
| Jornada: guardar/retirar valores, check-in/reflexão, pontos, estilos, modo de recuperação                     | Metas consultáveis; demais ações ainda no app             | Preservar eventos, idempotência e desbloqueios exige ferramentas específicas |
| Posso gastar? e avaliação de compra                                                                           | Ferramenta com premissas confirmadas e contas/metas reais | Dinheiro disponível e reserva precisam ser explícitos; não salva a compra    |
| Parcelamento e demais simuladores                                                                             | Ainda no app para execução completa                       | Não inventar cálculos ou premissas                                           |
| Nota fiscal: foto/PDF, revisão, confirmação                                                                   | Leitura e confirmação                                     | Salva como pendente; foto não comprova pagamento                             |
| Extrato: CSV/OFX/JSON, revisar linhas, conciliar duplicados, importar lote                                    | Ainda no app                                              | Revisão/reconciliação não migradas                                           |
| Preferência de categoria por estabelecimento                                                                  | Ainda no app                                              | Não aprender regras implicitamente                                           |
| Histórico de versões, restaurar versão, Desfazer                                                              | Ainda no app para alterações do chat                      | Exclusão não é restauração de versão                                         |
| Imagens criativas a pedido; gráficos calculados                                                               | Ferramentas de geração/renderização                       | Três imagens criativas/minuto; até 5 MB; geração pode ser cobrada            |
| Família: convite, solicitar/aprovar/revogar, filtros, compartilhar, propor/aprovar correção                   | Ainda no app autenticado                                  | Sem liberar acesso administrativo a dados de familiares                      |
| Empresa: criar/excluir, perfil, movimentos, limites, funcionários, membros/papéis, auditoria, análises        | Ainda no app autenticado                                  | Ferramentas desta revisão só acessam tabelas pessoais permitidas             |
| Assistente no app, fontes/RAG, análise financeira, plano semanal                                              | Chat geral; pipelines especializados ainda no app         | Não afirmar que todas as análises foram executadas                           |
| Avisos/lembretes: consentimento, horário, pausa, diagnóstico                                                  | Ainda no app                                              | Esta revisão não ativa templates/cron ou lembretes proativos                 |
| Tema, ocultar valores, offline/sincronização, instalar/atualizar PWA                                          | Locais ao app/aparelho                                    | Conversa não altera o navegador                                              |
| Cadastro/login, senha, MFA, sessões/logout                                                                    | App autenticado obrigatório                               | Não pedir senhas/códigos ou simular autenticação pelo chat                   |
| Exportar CSV/JSON, excluir conta, apagar histórico, revogar vínculo                                           | App autenticado obrigatório                               | Não expor exportações ou endpoints administrativos pelo WhatsApp             |

## Critérios

“Tenho uma conta recorrente, 156 de internet” precisa gerar pergunta de vencimento/frequência quando ausentes. O chat apresenta os dados antes de salvar e aceita autorização conversacional. “Qual meu nome?” consulta o perfil real.

Contexto usa até oito mensagens recentes, com expiração após dez minutos de inatividade. A retenção física está em PRIVACY.md. Dados retornados por ferramentas são conteúdo não confiável, nunca instruções.

Testes locais/simulados não comprovam entrega real pela Meta nem compreensão perfeita de toda formulação. Para declarar paridade total, todos os itens ainda no app precisam de ferramentas próprias e testes de autorização, confirmação, efeitos colaterais e recuperação.
