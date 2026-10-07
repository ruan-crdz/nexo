# Privacidade

Documento técnico inicial; não é uma política jurídica pronta para operação comercial. Revisão jurídica profissional, definição do controlador/operadores, base legal, canal do titular e regras de retenção são necessárias antes do lançamento comercial.

## Finalidade e minimização

O Nexo usa registros financeiros e contexto informado para organizar, simular e explicar decisões. Não há SDK de publicidade, venda de dados ou tracking de terceiros implementado. Nome é opcional no onboarding; usuário pode trabalhar com aproximações e ajustar depois.

Demo: somente dados fictícios em localStorage neste navegador. Conta real: Supabase Auth/Postgres. Ao usar IA, a Function envia pergunta, evidências e métricas necessárias à OpenAI; não envia todo o extrato por padrão. O parser recebe o texto que precisa interpretar. Transcrição envia o áudio ao provedor. OpenAI usa `store:false` no Responses; isso não substitui a política de retenção do fornecedor.

WhatsApp envolve também a Meta. Não há garantia de apagar cópias mantidas por usuários, dispositivos, backups ou fornecedores externos. Áudios baixados são mantidos apenas em memória durante a requisição.

O chat do WhatsApp usa até oito mensagens recentes como contexto temporário, que expira após dez minutos de inatividade. O modelo recebe esse contexto e resultados limitados das ferramentas, não acesso livre ao banco. Nome/perfil e registros financeiros podem ser enviados ao provedor quando necessários à pergunta. Esse contexto temporário não é o histórico opt-in do assistente no app.

## Controle do titular

- Exportar registros em JSON; CSV nas listagens.
- Salvar conversa é opt-in por solicitação; apagar histórico na interface.
- Revogar vínculo WhatsApp.
- Encerrar sessões e gerenciar autenticador.
- Excluir conta; dados pessoais usam cascata de exclusão. Proprietários precisam primeiro excluir suas empresas com confirmação explícita. Não apagamos dados compartilhados implicitamente.
- Excluir uma empresa remove dados, membros e auditoria daquela empresa. Exporte e cumpra obrigações de retenção antes de usar essa ação.

## Retenção técnica

`prune_ephemeral_data`, agendada diariamente, remove tokens expirados, conteúdo pendente de confirmação após dez minutos, texto de resposta após vinte e quatro horas, metadados de WhatsApp após trinta dias e contadores antigos após um dia. Esses prazos são defaults técnicos e precisam de revisão. A execução diária pode ultrapassar o limiar por até um ciclo do agendador. Sem cron, nada é apagado automaticamente.

Registros financeiros permanecem até exclusão pelo usuário; backup pode reter cópias conforme plano e configuração do projeto. Logs não devem receber conteúdo financeiro nem segredos. Auditoria empresarial contém antes/depois e deve ser tratada como dado sensível, acessível apenas a owner/admin.

Sessões e propostas pendentes do chat ficam inutilizáveis após dez minutos e são removidas fisicamente na próxima entrada de webhook por `prune_whatsapp_chat`. Sem novas entradas, dados expirados podem permanecer armazenados. Propostas aplicadas ficam vinculadas aos metadados para idempotência e são removidas em cascata quando esses metadados forem apagados pela limpeza de trinta dias. Exclusão da conta remove sessões e propostas por cascata.

Novas imagens enviadas como resposta são armazenadas temporariamente no cache privado `whatsapp_reply_media` para recuperar falhas de entrega, com expiração de 24 horas. Clientes autenticados não têm acesso direto à tabela. Arquivos expirados não podem ser reenviados e são removidos fisicamente pela rotina diária `prune_ephemeral_data` ou pela próxima entrada de webhook. Sem execução de limpeza, podem permanecer armazenados; exclusão dos metadados ou da conta remove o cache por cascata.

## Transparência

HTTPS e controles de armazenamento dependem da infraestrutura configurada. RLS isola contas, mas administradores privilegiados podem acessar dados tecnicamente. Acesso administrativo precisa ser restrito, justificado e auditado na operação. Não prometemos que desenvolvedores sejam tecnicamente incapazes de acessar informações.
