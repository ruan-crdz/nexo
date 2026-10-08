# Experiência do Nexo no WhatsApp

Entrega de 08/10/2026. Público prioritário: pessoas que querem organizar finanças pessoais com pouca familiaridade digital, incluindo pessoas idosas. A interface deve explicar o próximo passo e confirmar o resultado sem exigir comandos decorados.

Abra [modelos.html](modelos.html) para ver seis cenários. Os textos dos menus e dos cadastros são gerados a partir dos mesmos módulos utilizados pelo webhook. Dados fictícios. A aparência final dos componentes depende do WhatsApp; o HTML é uma prévia, não uma captura de um aparelho real.

## O que foi implementado

| Antes                                                          | Agora                                                                                      | Evidência                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Três atalhos de boas-vindas                                    | Dez áreas no menu principal e 36 destinos de navegação                                     | Teste de alcance de todas as páginas, consultas, orientações e cadastros                             |
| Cadastro dependente de mensagem livre                          | Quatro cadastros guiados: gasto, entrada, meta e conta fixa                                | Cinco etapas validadas por cadastro, sem chamada à IA para interpretar escolhas ou números digitados |
| Resposta financeira seguida de texto genérico                  | Comprovante curto e acesso ao menu de próximos passos                                      | Templates determinísticos nos cadastros; instruções de estilo para conversa livre                    |
| Resumo completo repetido após cada alteração                   | Resumo consultado quando solicitado                                                        | Removida a inclusão automática antes de cada comprovante                                             |
| Correções exigiam descrever o alvo                             | Lista paginada de lançamentos, com valor e data; seleção do campo a corrigir               | Consultas limitadas ao proprietário; contexto da seleção salvo para a próxima resposta               |
| Exclusão pela conversa livre                                   | Também é possível escolher o registro na lista de exclusão                                 | Identificador, expiração e versão dos dados; exclusão atômica, sem confirmação redundante            |
| Resposta longa perdia botões; imagem não oferecia continuidade | Resposta em partes e menu no final                                                         | Partes guardadas antes do envio e retomada apenas do trecho ainda não enviado                        |
| Menu quase não cobria metas e planejamento                     | Acesso a metas, aportes, retiradas, limites, contas fixas, dívidas, bens, contas e cartões | Registro central de navegação e teste de alcance                                                     |

Os 36 destinos não são 36 novas funcionalidades financeiras. Incluem submenus, instruções, consultas e quatro cadastros guiados. Não são 36 botões apresentados ao mesmo tempo.

## Padrão de conversa

- **Início:** acolhimento curto, opção de menu, texto ou áudio.
- **Etapa guiada:** título da tarefa, progresso, uma pergunta, exemplo quando necessário e caminhos para voltar ou sair.
- **Conclusão:** o que foi realmente salvo, dados relevantes e “O que deseja fazer a seguir?”, com a lista principal.
- **Consulta:** responder o período e os valores consultados; distinguir resultado dos movimentos de dinheiro disponível ou saldo bancário.
- **Erro de entrada:** explicar o dado faltante e permanecer na mesma etapa. Não adivinhar valor ou data.
- **Botão antigo:** informar que expirou ou que os dados mudaram e oferecer o menu. Não repetir uma operação financeira.
- **Comprovante:** foto/PDF não comprova pagamento. Manter o status pendente até informação explícita.

Texto livre continua sendo o caminho rápido: “Paguei 35 reais na farmácia hoje”. Pedidos completos e múltiplos continuam executados diretamente, com o comportamento anterior de lotes. Quem escolhe o cadastro guiado aceita fornecer os campos por etapas; não acrescentamos confirmação extra depois da última escolha.

As mensagens de IA seguem um padrão de tom e estrutura, mas não são templates determinísticos: sua precisão precisa de avaliação própria. A alteração do prompt sobre saldo não substitui a validação das premissas financeiras.

## Componentes nativos e limites

Até três respostas rápidas usam botões. Menus maiores e escolhas com descrição usam listas, com no máximo dez linhas. O botão “Ver opções” abre a lista nativa. ID do clique é usado para roteamento, nunca o rótulo enviado pelo cliente. Referência técnica: [Action Object do SDK oficial da Meta](https://raw.githubusercontent.com/WhatsApp/WhatsApp-Nodejs-SDK/main/website/docs/api-reference/types/ActionObject.md).

Os valores e datas são digitados ou enviados por áudio na conversa. Esta entrega não publica WhatsApp Flows e não oferece enquetes como se fossem formulários financeiros. As escolhas da lista são individuais; isso evita transformar uma operação financeira em votação.

Cadastros guiados expiram em 30 minutos. O contexto da conversa livre e das perguntas de correção mantém a janela existente de dez minutos. Não há promessa de memória permanente. Formatos numéricos do cadastro guiado são brasileiros, como `1.250,50`; uma transcrição por extenso que o parser não entender recebe uma orientação para usar números.

Cadastro manual de conta não conecta banco. Preferências de avisos, convites familiares, segurança, exportação e exclusão de conta levam ao app. Não há atendimento humano anunciado como disponível. Nenhum pagamento ou transferência é executado.

## O que aproveitamos das referências

| Referência                                                                                           | Padrão aproveitado                                               | Limite da comparação                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pierre](https://ajuda.pierre.finance/pt-BR/articles/16035173-como-usar-o-pierre)                    | WhatsApp para interação rápida, app para aprofundar e configurar | O Nexo ainda não demonstrou equivalência à automação bancária do Pierre                                                                              |
| [Mobills PRO](https://mobills.zendesk.com/hc/pt-br/articles/39727734628251-Tudo-sobre-o-Mobills-PRO) | Texto e áudio como entrada cotidiana                             | A documentação manda editar no app e informa ausência de leitura de fotos; o Nexo tem maior cobertura nesses dois itens, sem prova de maior precisão |
| [Poupa.ai](https://poupa.ai/)                                                                        | Rotina simples e orientação para família                         | Permissões familiares continuam no app; não anunciamos automação que não foi validada                                                                |
| [GranAI](https://granai.app/)                                                                        | Comprovante curto, consulta objetiva e acesso aos detalhes       | Demonstração comercial não prova tempo de resposta nem acerto em produção                                                                            |
| [Granafin](https://granafin.com/)                                                                    | Pedido claro seguido de registro e confirmação                   | Não atribuímos uma arquitetura ou interface nativa ao concorrente com base em uma landing page                                                       |
| [Banco do Brasil](https://www.bb.com.br/site/pra-voce/atendimento/whatsapp-bb/)                      | Menu para descoberta e caminhos claros de ajuda                  | Banco é referência de canal; Nexo não oferece serviços bancários ou atendimento humano equivalente                                                   |

O [benchmark documental](../BENCHMARK-WHATSAPP-2026-10-08.md) continua separado da evidência de implementação. Ausência de um recurso em uma página não prova que o concorrente não o tem.

## Validação e prova disponível

Testes adicionados cobrem alcance de navegação, limites de payload nativo, quatro cadastros completos, datas/valores inválidos, voltar uma etapa, ownership, botão vencido, clique duplicado, rollback, seleção de registros, mudança do registro depois da lista, contexto de pergunta, resposta longa, imagem com continuidade, entrega ambígua e recuperação de comprovante após gravação.

O teste de banco aplica a migração em PostgreSQL local via PGlite e verifica isolamento e atomicidade. Os testes de transporte interceptam chamadas à Meta/Supabase; não enviam mensagens reais. A prévia foi verificada em 1440 px e 390 px, incluindo expansão do menu e ausência de rolagem horizontal.

Resultados finais e publicação são registrados abaixo após a execução. Testes automatizados do Nexo não demonstram vitória sobre concorrentes. Para comprovar superioridade, precisamos executar o mesmo protocolo em contas de teste de cada produto e medir sucesso, erros, esforço, tempo e custo, além de observar o uso por pessoas do público-alvo. Esse estudo não foi realizado nesta entrega.

## Roteiro de teste no seu WhatsApp

1. Envie `menu`. Abra **Ver opções** e confira as dez áreas.
2. Entre em **Anotar gasto**, preencha um gasto real e use Hoje e Já paguei. A última escolha salva; não é necessário confirmar novamente.
3. Confira o registro no app e o menu na mensagem de conclusão.
4. Abra **Corrigir ou excluir → Corrigir um registro**, escolha o lançamento, depois Valor, e envie o valor correto.
5. Comece outro cadastro, use **Voltar uma etapa**, depois **Cancelar cadastro**. Nenhum lançamento desse cadastro deve aparecer no app.
6. Toque num botão de uma etapa já concluída. Ele deve orientar a usar a etapa atual ou abrir o menu, sem repetir o lançamento.
7. Consulte metas e planejamento pelo menu. Para testar a leitura de foto ou áudio, use dados próprios que realmente deseja registrar.

Os cadastros em produção não são simulações. A galeria local é o lugar seguro para ver exemplos fictícios sem gravar dados.
