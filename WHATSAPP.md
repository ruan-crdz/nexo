# WhatsApp oficial

Integração com Meta WhatsApp Business Platform / Cloud API. Nenhum scraping ou automação de WhatsApp Web.

## Fluxo

Webhook bruto → HMAC → validação do número de destino → claim idempotente → vínculo de conta → rate limit → texto ou mídia → extração estruturada → validação → confirmação/gravação → resposta.

O GET do webhook verifica `hub.verify_token` e devolve o challenge. POST só aceita assinatura válida com App Secret. Nenhuma autenticação Supabase é exigida da Meta; endpoints acionados pelo app exigem JWT e MFA.

## Vínculo

Usuário autenticado gera código em `whatsapp-link`, válido por dez minutos. Só seu hash é persistido. Enviar `vincular CODIGO` ao número oficial consome o código e vincula o remetente. Não basta digitar um telefone no app. Revogar exclui a conexão.

## Suportado

- “Gastei 10 de coxinha”, “recebi 3500 de salário”, gastos múltiplos e datas explícitas/hoje/ontem.
- Áudio de até 10 MB, baixado server-side e transcrito. O timezone vem do perfil; “ontem” parte do instante da mensagem.
- “Notebook em 10x de 320”: valor de cada parcela, datas calculadas pelo motor e próximas parcelas previstas. Até vinte lançamentos por mensagem. Se só o total for informado, pede valor por parcela em vez de calcular via LLM.
- Confiança >=0,90 grava; 0,70–0,89 grava com aviso de correção; <0,70 exige “confirmar”. Valor ausente exige esclarecimento.
- “Desfazer” remove o último lote da conta registrado por WhatsApp nas últimas vinte e quatro horas.
- Perguntas consultam contexto e RAG; métricas calculadas são anexadas separadamente.

Não suportado ainda: empréstimos entre pessoas, alteração de cartão/metas por mensagem, criação de lembretes, agendamento de mensagens proativas, recibos/imagens, visão e Open Finance. O parser devolve `unsupported` e orienta o usuário; não inventa execução.

## Falhas e idempotência

`message_id` único protege concorrência. `commit_whatsapp` faz todos os movimentos e mudança de estado na mesma transação. Retries de mensagens completas não inserem novamente. Claims com falha ou abandonados por cinco minutos podem ser retomados. `sent_at` permite repetir entrega de resposta sem repetir transações.

Processamento é síncrono na Function, sem fila durável/worker dedicado. Em produção com volume, adicione fila, lease renovável, política de retentativas e dead-letter. Se o provedor aceitar uma mensagem e a confirmação se perder, a resposta pode ser repetida. Não prometemos entrega exatamente uma vez.

O endpoint `whatsapp-send` só envia texto de teste ao número vinculado do próprio usuário e requer mensagem recebida recentemente; não aceita destinatário ou corpo arbitrário. Agendamentos/marketing e templates não estão implementados.

## Credenciais e validação

Veja [DEPLOYMENT.md](DEPLOYMENT.md). App Secret e verify token são diferentes. Graph API version é configurável. A documentação Meta bloqueou leitura automática durante o desenvolvimento: validar payloads, janela de atendimento, permissões e políticas no painel oficial é pré-requisito de homologação. Nenhuma mensagem real foi enviada nesta sessão.

Teste: gasto único, gasto duplo, data/virada de fuso, parcela, valor ausente, baixa confiança, assinatura inválida, evento duplicado, retransmissão após falha, áudio inválido, revogação, confirmação expirada e desfazer de outra conta. Testes locais cobrem contratos, HMAC e SQL; a entrega externa continua pendente de credenciais.
