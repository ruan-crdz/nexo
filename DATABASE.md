# Banco e autorização

Migrations são a especificação executável; aplique todas em ordem. PostgreSQL com pgvector e pgcrypto em `extensions`.

| Domínio   | Tabelas                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Pessoal   | profiles, financial_accounts, transactions, goals, debts, assets, budgets                                              |
| Empresas  | organizations, organization_members, business_profiles, business_transactions, employees, business_budgets, audit_logs |
| IA/RAG    | ai_messages, knowledge_documents, knowledge_chunks                                                                     |
| Operações | api_rate_limits, whatsapp_connections, whatsapp_messages_metadata                                                      |

Preferências estão em profiles; contas a pagar/receber são movimentos planned; departamentos são atributos. Outras entidades propostas no pedido não foram criadas como tabelas vazias: snapshots, recorrência, notificações, histórico de aportes/pagamentos constam em STATUS.

UUIDs, bigint em centavos, constraints e índices por usuário/empresa/data. FK composta `(account_id,user_id)` impede associação à conta alheia. RAG tem HNSW de 1536 dimensões. Realtime está habilitado para transações pessoais.

Todas as tabelas públicas têm RLS; anon não lê finanças. Pessoal usa auth.uid(); `org_role` evita recursão e verifica associação. MFA é política restritiva adicional: conta com fator verificado exige aal2. RPCs também verificam assurance.

| Papel          | Ler | Alterar finanças | Membros | Auditoria |
| -------------- | --- | ---------------- | ------- | --------- |
| owner          | sim | sim              | sim     | sim       |
| admin          | sim | sim              | não     | sim       |
| finance        | sim | sim              | não     | não       |
| manager/viewer | sim | não              | não     | não       |

Convites usam UUID de conta cadastrada; não enviam e-mail. Manager tem leitura nesta versão, sem restrição por departamento. Triggers empresariais registram ator, data, operação, recurso e antes/depois. Auditoria contém dados sensíveis; exclusão integral da empresa também apaga esse histórico.

RPCs: criação atômica de empresa; atribuição protegida de membros; exclusão com nome confirmado; recuperação verificada; rate limit atômico; vínculo hasheado; claim/commit/undo de WhatsApp; limpeza operacional agendada.

Leitura interativa limita a 5.000 registros por entidade e falha explicitamente no teto; exportação é paginada. A paginação de grandes históricos ainda precisa ser implementada.

`tests/unit/database.test.ts` aplica as migrations reais em PGlite com pgvector e Auth mínimo, testando isolamento, papéis, FK cruzada, auditoria, idempotência, RAG, MFA e exclusão. Não testa Auth hospedado, Realtime ou concorrência distribuída.
