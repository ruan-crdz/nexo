# WhatsApp oficial

Integração com Meta WhatsApp Business Platform / Cloud API. Nenhum scraping ou automação de WhatsApp Web.

## Chat com ferramentas

Texto e áudio agora usam um chat conversacional com ferramentas. Pedidos claros e completos são executados em lote, sem uma segunda confirmação; campos ausentes ou alvos ambíguos geram perguntas. O modelo consulta perfil/registros reais. Contexto e propostas antigas expiram em dez minutos. Confirmações por botão continuam disponíveis para propostas anteriores e verificam vínculo, proprietário e registro atual.

Aplicar `202610070001_whatsapp_chat.sql` antes de publicar `whatsapp-webhook`. Usar `OPENAI_CHAT_MODEL` com suporte a tools na Responses API; na ausência dele, usa o modelo de extração configurado. O processamento envia aviso de falha quando possível em vez de apenas retornar erro à Meta.

A matriz completa de ações do app e pendências está em [docs/WHATSAPP-PARITY.md](docs/WHATSAPP-PARITY.md). Não há paridade total nesta revisão. Segurança, compartilhamento, empresa e várias operações especializadas ainda exigem o app. Lembretes proativos não são ativados.

As descrições de comandos abaixo documentam o fluxo anterior e formatos de dados; texto/áudio não dependem mais deles. Pedidos explícitos usam validação e gravação transacional; perguntas, hipóteses e sugestões não autorizam gravação.

## Sobra após registros e comparação com o app

Depois de uma operação salva, a resposta recebe pelo código o resultado dos movimentos e o valor livre para planejar, não apenas uma sugestão no prompt. Funciona em texto, áudio e confirmações por botão, com o resumo no início da legenda quando houver imagem. Se a consulta falhar, preserva a confirmação e avisa que não conseguiu consultar a sobra; nunca substitui por zero ou inventa saldo.

`money_snapshot` usa o mesmo `goalMonthlyBudget` da Home, sem exigir conta cadastrada. Mostra movimentos pagos até hoje, metas protegidas e despesas reservadas, sem antecipar renda prevista. `compare_money` calcula diferenças entre um valor declarado, o resultado dos movimentos e o valor livre; não identifica a causa nem salva ajuste automaticamente. Um ajuste não identificado precisa de autorização explícita.

`budget_until` usa dinheiro informado pela pessoa, dias incluindo hoje e contas pendentes até a data, incluindo atrasadas. O teto diário é limite, não recomendação de gastar. Se alimentação e transporte já estão garantidos, a orientação preserva a reserva em vez de repetir conselhos irrelevantes. Nenhum desses números é saldo bancário consultado.

O contexto monetário é atualizado após gravações. O resumo pós-gravação é reutilizado no envio final quando disponível; cada consulta tem limite de oito segundos e respeita o usuário vinculado.

## Dinheiro guardado em metas

Aplicar `202610070006_whatsapp_goal_progress.sql` antes do webhook atualizado. “Guardei R$ 10” usa `goal_progress`: aumenta o guardado da meta e insere um evento de progresso, sem criar despesa, entrada ou transferência bancária. A Home reduz o valor livre para planejar pela alocação registrada, mantendo o resultado bruto dos movimentos intacto. A resposta mostra o total guardado e o resumo atualizado.

Se a pessoa não nomear a meta, usa a meta em foco; sem foco, usa a única meta possível. Ambiguidade ou ausência de meta gera pergunta, sem gravação. “Pretendo guardar” e simulações não autorizam aporte. Retiradas e urgências usam a mesma operação com sinal negativo, preservando conquistas e impedindo saldo guardado negativo.

App e WhatsApp compartilham `update_goal_progress_for`, chamado por wrappers que preservam autenticação/MFA no app e vínculo/consentimento no WhatsApp. Message ID e request UUID determinístico impedem duplicação em retries. Uma operação de progresso não é misturada com outro lote de gravação na mesma mensagem; o chat deve informar o que falta e pedir a ação restante em outra mensagem, nunca afirmar que ambos foram executados.

## Pagamentos recorrentes conciliados

`202610070007_recurring_payment_reconciliation.sql` permite ligar uma ocorrência automática pendente a um pagamento já registrado. A pessoa precisa confirmar o pagamento; proprietário, despesa paga, nome, valor e período devem corresponder. Pagamento já usado por outra ocorrência não pode ser reutilizado. Valores iguais por si só não autorizam conciliação.

A operação preserva o lançamento pago e sua data, vincula a ocorrência a ele e remove apenas a previsão gerada duplicada, sem novo gasto. O vínculo evita recriação pela sincronização; os próximos ciclos continuam previstos. O chat expõe a origem da recorrência ao consultar movimentos e usa `reconcile_recurring_payment` mediante confirmação explícita. Projeções e avaliação de compra respeitam as chaves de ocorrências já processadas mesmo quando o pagamento tem ID manual diferente.

## Recuperação de respostas visuais

Aplicar `202610070002_whatsapp_reply_media.sql` antes do webhook atualizado. Novas imagens ficam em cache privado por até 24 horas para recuperar rejeições confirmadas sem gerar novamente nem repetir ações financeiras. O retry verifica o vínculo e um claim atômico reserva a entrega. Resultado ambíguo (timeout após envio, resposta 5xx ou ausência do ID remoto) fica em `reconcile`, sem reenvio automático, para evitar duplicatas. Depois da expiração, o bot informa que a imagem não pode mais ser recuperada; não substitui silenciosamente a imagem pela legenda.

Imagens anteriores à implantação desse cache não podem ser reconstruídas a partir dos metadados antigos. A retenção física depende da limpeza descrita em PRIVACY.md.

## Fluxo

Webhook bruto → HMAC → validação do número de destino → claim idempotente → vínculo de conta → rate limit → texto ou mídia → extração estruturada → validação → confirmação/gravação → resposta.

O GET do webhook verifica `hub.verify_token` e devolve o challenge. POST só aceita assinatura válida com App Secret. Nenhuma autenticação Supabase é exigida da Meta; endpoints acionados pelo app exigem JWT e MFA.

## Vínculo

Usuário autenticado toca em “Conectar meu WhatsApp”. `whatsapp-link` gera código válido por dez minutos e URL `wa.me` com “Olá Nexo, meu código de vinculação é CODIGO”. O usuário precisa enviar a mensagem para conectar. Só o hash fica persistido; o comando antigo `vincular CODIGO` continua aceito. O app consulta o status da conexão. Desconectar exclui a conexão, preservando anotações.

## Suportado

- “Gastei 10 de coxinha”, “recebi 3500 de salário”, gastos múltiplos e datas explícitas/hoje/ontem.
- Áudio de até 10 MB, baixado server-side e transcrito. O timezone vem do perfil; “ontem” parte do instante da mensagem.
- “Notebook em 10x de 320”: valor de cada parcela, datas calculadas pelo motor e próximas parcelas previstas. Até vinte lançamentos por mensagem. Se só o total for informado, pede valor por parcela em vez de calcular via LLM.
- Confiança >=0,90 grava; 0,70–0,89 grava com aviso de correção; <0,70 exige “confirmar”. Valor ausente exige esclarecimento.
- “Desfazer” remove o último lote da conta registrado por WhatsApp nas últimas vinte e quatro horas.
- “Resumo”, “saldo” ou “quanto gastei este mês?” retornam entradas, gastos e diferença do mês, calculados em centavos, sem chamada de IA. Consulta usa usuário vinculado e seu fuso, desconsiderando previsões e datas futuras. Não representa saldo bancário.
- “Posso comprar um Play 5 por R$ 5.000?” abre uma avaliação em etapas. O Nexo pede preço, dinheiro confirmado hoje, próximo recebimento, reserva e valor separado para metas; a conversa expira em dez minutos. O cálculo usa as contas pendentes, nunca trata renda esperada como dinheiro recebido e não salva compra. “Cancelar” encerra a avaliação.
- Na avaliação de compra, metas já guardadas, renda do perfil e recebimentos/recorrências futuros são reaproveitados quando disponíveis. Saldo de hoje e reserva não são inferidos; a pessoa precisa informá-los. A resposta identifica quando uma premissa veio do app.
- “Ajuda” e “oi” retornam instruções curtas. Outras perguntas recebem orientação sobre as funções disponíveis; não encaminham a simuladores removidos.

Perguntas “por que gastei mais?”, “quanto falta para minha meta?” e “quais contas ainda vencem?” usam cálculos determinísticos, com períodos e registros de origem. O app mostra a evidência completa; o WhatsApp limita a lista e aponta para a consulta completa quando necessário. Nenhuma anotação é criada ao consultar.

Consultas também aceitam hoje/ontem/mês passado/últimos N dias e filtros conhecidos de categoria, conta e estabelecimento. Filtros não reconhecidos pedem esclarecimento, sem criar lançamentos. Preferências de categoria autorizadas valem somente para próximos registros.

JPG/PNG/WEBP de recibos até 5 MB usam `OPENAI_VISION_MODEL`: a imagem gera prévia pendente; “confirmar” não comprova pagamento. O usuário marca como pago no app depois de conferir. Imagens ilegíveis ou sem valor/data confiáveis pedem esclarecimento. Não há conteúdo de imagem em logs.

Pedidos de resumo, comparação de gastos e metas podem receber gráficos PNG calculados pelo Nexo, com legenda em texto para preservar os valores exatos. Pedidos explícitos de “crie uma imagem”, “gere uma foto” ou “faça um desenho” usam o modelo `OPENAI_IMAGE_MODEL` (padrão `gpt-image-2.5-flare`) e enviam o JPEG pelo Media Upload API da Meta. Cada geração consome a cota/crédito OpenAI da conta; o webhook limita essas solicitações a três por minuto por usuário. Não enviamos dados financeiros ao gerador de imagens.

Quando o processamento pode levar alguns segundos, o webhook marca a mensagem como lida e mostra o indicador nativo de digitação da Meta. Ele expira após 25 segundos ou quando a resposta chega.

Não suportado ainda: empréstimos entre pessoas, alteração de cartão/metas ou criação de lembretes por mensagem e Open Finance. O parser devolve `unsupported` e orienta o usuário; não inventa execução.

## Avisos proativos

Jornada de hábitos exige `202610050004_goal_journey.sql`. Mensagens vinculadas recebem 2 pontos, até 5 mensagens por dia no fuso do perfil; retransmissão do mesmo ID não pontua outra vez. Check-in vale 5 pontos por dia/semana conforme preferência, revisão 10 por semana, anotações manuais 2 até 5 por dia, e progresso de reserva 10 até uma vez por dia, independentemente do valor. Pontos nunca caem por retirada, urgência ou pausa e não são score de crédito.

O resumo semanal pode incluir a meta em foco e um passo pequeno, sem prometer rendimento. Lembretes de jornada são opt-in, no horário escolhido entre 09h e 19h, diários/semanais conforme preferência; pausa e check-in do período suprimem convites. Além dessa preferência, é necessário consentimento externo em Ajustes. A restrição atual da conta Meta e ausência de template/job continuam sendo bloqueios de entrega real; preparar o código não garante mensagem recebida.

`financial-notifications` é um worker implementado, mas o agendamento de produção está desligado. Para ativá-lo, são necessários consentimento externo explícito (desativado por padrão), número vinculado, `FINANCIAL_JOB_SECRET` de pelo menos 32 caracteres, template aprovado pela Meta em `pt_BR` com um parâmetro de corpo, credenciais atuais no Supabase e configuração do Vault/Cron. Nunca use o token Meta como credencial do job.

Os tipos de aviso são vencimentos, excesso de limite e resumo da última semana completa, conforme as preferências. Chaves estáveis impedem reenvio diário do mesmo evento. A função confere consentimento e vínculo novamente antes de enviar. Envia somente entre 09h e 20h no fuso do perfil e limita cada execução a 20 tentativas; assinantes e dados são lidos em páginas, sem o antigo bloqueio de 200 assinantes.

`accepted` significa aceite da API, não entrega. Webhook atualiza `delivered`, `read` ou `failed`. Erros transitórios comprovadamente rejeitados têm backoff e até três tentativas. Timeout, HTTP 5xx, ID de envio ausente e leases interrompidos vão para `reconcile`, sem repetição automática. O operador deve conferir o resultado antes de repetir, porque exatamente uma entrega não é garantida pela API externa. O histórico fica em Ajustes. Nenhum conteúdo financeiro é escrito em logs do worker.

Após configurar template e secrets, crie no Vault `nexo_financial_job_url` (URL da função) e `nexo_financial_job_secret` (mesma credencial do job). Execute `supabase/operations/financial-notifications.sql` para agendar a cada 15 minutos. O script não contém credenciais. Desative o job no Cron para interromper a operação global; cada usuário pode retirar seu consentimento em Ajustes.

## Falhas e idempotência

`message_id` único protege concorrência. `commit_whatsapp` faz todos os movimentos e mudança de estado na mesma transação. Retries de mensagens completas não inserem novamente. Claims com falha ou abandonados por cinco minutos podem ser retomados. `sent_at` permite repetir entrega de resposta sem repetir transações.

Processamento é síncrono na Function, sem fila durável/worker dedicado. Em produção com volume, adicione fila, lease renovável, política de retentativas e dead-letter. Se o provedor aceitar uma mensagem e a confirmação se perder, a resposta pode ser repetida. Não prometemos entrega exatamente uma vez.

O endpoint `whatsapp-send` só envia texto de teste ao número vinculado do próprio usuário e requer mensagem recebida recentemente; não aceita destinatário ou corpo arbitrário. Agendamentos/marketing e templates não estão implementados.

## Credenciais e validação

Veja [DEPLOYMENT.md](DEPLOYMENT.md). App Secret e verify token são diferentes. `WHATSAPP_BUSINESS_PHONE` é o número completo em dígitos para o link, diferente do `WHATSAPP_PHONE_NUMBER_ID`. Graph API version é configurável. Os avisos fixos de bloqueio foram retirados após o responsável confirmar a correção da configuração. Código 131030 indica destinatário de teste não autorizado; 131031 indica restrição da conta na tentativa registrada. Falhas são exibidas como resultado da última tentativa, sem presumir que uma restrição antiga continua ativa. Enviar “ajuda” permite verificar uma nova resposta sem repetir lançamentos.

Teste: gasto único, gasto duplo, data/virada de fuso, parcela, valor ausente, baixa confiança, assinatura inválida, evento duplicado, retransmissão após falha, áudio inválido, revogação, confirmação expirada e desfazer de outra conta. Testes locais cobrem contratos, HMAC e SQL; a entrega externa continua pendente de credenciais.
