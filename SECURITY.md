# Segurança

## Controles implementados

- RLS em todas as tabelas públicas; propriedade por usuário e membership por organização.
- FK composta para impedir referência a contas de outros usuários.
- Papéis empresariais e operações privilegiadas em RPCs; proprietário não pode ser rebaixado.
- MFA TOTP opcional com exigência de aal2 em RLS e APIs após ativação.
- `auth.getUser()` valida o JWT em endpoints de usuário. CORS permite somente origens configuradas; CORS não substitui autenticação.
- Webhook Meta valida HMAC SHA-256 do corpo bruto via WebCrypto, número receptor e estrutura do payload.
- Vínculo de WhatsApp usa token aleatório de 128 bits, hash SHA-256, prazo de dez minutos e consumo único.
- Rate limit atômico no banco: vinte chamadas/minuto por bucket nas APIs e quinze mensagens/minuto por usuário no WhatsApp.
- Validação Zod/JSON Schema, limites de texto, arquivo e valores; gravação de lote WhatsApp transacional e idempotente.
- Download de mídia somente em hosts Meta permitidos; redirects não são seguidos; limite durante streaming.
- Áudio apenas em memória; nenhuma biblioteca de upload persistente.
- React escapa texto; não há renderização de HTML do modelo. CSV protege fórmulas iniciadas por caracteres especiais.
- Logs estruturados de status/latência/modelo/tokens sem prompts, áudio, JWT, telefone ou descrição financeira.
- Segredos fora do bundle; `.env*` ignorados pelo Git; workflows usam somente variáveis client-safe.

## Limites e operação

`service_role` ignora RLS; restringir acesso administrativo, rotacionar chaves e usar projetos distintos para desenvolvimento/homologação/produção. Policies não impedem um administrador do banco de ler dados. O frontend não promete criptografia ponta a ponta.

Sessões são persistidas pelo SDK Supabase no navegador; XSS continua sendo ameaça relevante. GitHub Pages não oferece configuração completa de cabeçalhos HTTP por projeto. Uma camada de hosting com CSP/headers próprios pode ser necessária conforme o risco operacional. Não há CSP relaxada fingindo resolver essa limitação.

MFA protege acesso pelo app/API; o vínculo WhatsApp é uma autorização delegada independente até revogação. Perda/reciclagem de número exige revogar o vínculo. Encerrar sessões invalida refresh tokens; access tokens já emitidos podem permanecer válidos até o vencimento configurado.

O banco não implementa controle de versão otimista em todos os formulários: edições manuais simultâneas podem sobrescrever valores. A garantia idempotente é específica do lote WhatsApp, não uma promessa global de execução exatamente uma vez. Respostas Meta podem ser entregues mais de uma vez em uma falha de confirmação; registros não devem duplicar.

Não foram homologados serviços externos, antiabuso distribuído, recuperação de desastre ou resistência completa a prompt injection. Testes numéricos e de RLS ajudam, mas não substituem auditoria independente. Antes de operação comercial: pentest, revisão de permissões, limites financeiros, monitoramento e restauração de backup.

Reporte problemas por canal privado do responsável pelo repositório. Não publique dados reais, tokens ou payloads financeiros em issues. Reprodução deve usar contas e dados sintéticos.
