# WhatsApp oficial

Integração com Meta WhatsApp Business Platform / Cloud API. Nenhum scraping ou automação de WhatsApp Web.

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
- “Ajuda” e “oi” retornam instruções curtas. Outras perguntas recebem orientação sobre as funções disponíveis; não encaminham a simuladores removidos.

Perguntas “por que gastei mais?”, “quanto falta para minha meta?” e “quais contas ainda vencem?” usam cálculos determinísticos, com períodos e registros de origem. O app mostra a evidência completa; o WhatsApp limita a lista e aponta para a consulta completa quando necessário. Nenhuma anotação é criada ao consultar.

Consultas também aceitam hoje/ontem/mês passado/últimos N dias e filtros conhecidos de categoria, conta e estabelecimento. Filtros não reconhecidos pedem esclarecimento, sem criar lançamentos. Preferências de categoria autorizadas valem somente para próximos registros.

JPG/PNG/WEBP de recibos até 5 MB usam `OPENAI_VISION_MODEL`: a imagem gera prévia pendente; “confirmar” não comprova pagamento. O usuário marca como pago no app depois de conferir. Imagens ilegíveis ou sem valor/data confiáveis pedem esclarecimento. Não há conteúdo de imagem em logs.

Não suportado ainda: empréstimos entre pessoas, alteração de cartão/metas ou criação de lembretes por mensagem e Open Finance. O parser devolve `unsupported` e orienta o usuário; não inventa execução.

## Avisos proativos

`financial-notifications` é um worker preparado, não um agendamento já ativado. Exige a migração de planejamento, consentimento externo explícito (desativado por padrão), número vinculado, `FINANCIAL_JOB_SECRET` de pelo menos 32 caracteres e `WHATSAPP_FINANCIAL_TEMPLATE` aprovado na Meta em `pt_BR`, com um parâmetro de corpo contendo o aviso. Nunca use o token Meta como credencial do job.

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
