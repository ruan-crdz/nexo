# Simplificação e confiabilidade — 05/10/2026

## Entrega

- Início: resumo mensal, WhatsApp e anotações recentes com correção e exclusão. Gráficos recolhidos por padrão. Metas, check-ins e conquistas preservados em `/metas`.
- Consultas: meses por nome, ano explícito, ano passado, hoje, ontem, mês passado e últimos N dias. Períodos ambíguos ou não suportados pedem esclarecimento; nunca são substituídos silenciosamente pelo mês atual. O cálculo mostra o período usado. Correção compartilhada entre app e WhatsApp.
- Offline: gravação cifrada por anotação em IndexedDB, migração da fila antiga, comparação da versão ao concluir envio e Web Locks para coordenar abas. Uma correção durante a sincronização permanece pendente. Abas antigas que impeçam a atualização do banco precisam ser fechadas.
- Recibos: descrição, valor, data, categoria, tipo e situação editáveis antes de confirmar. Qualquer alteração exige nova confirmação. Data futura não pode ser marcada como paga. Demonstração explicitamente fictícia para experimentar a revisão sem chamar IA.
- Avisos: status autenticado do serviço, configuração e agenda verificadas, registro de execução recente e histórico separado do aceite/entrega. Agendamento no Vault/pg_cron protegido por credencial exclusiva. Preparação do template pelo backend, sem expor token da Meta.
- Telas opcionais carregadas sob demanda. Mantidos layout para PC, telas estreitas e tema claro/escuro.

## Verificação

`npm run check`, `npm run typecheck:edge`, `npm run test:edge` e Playwright. Regressões incluem janeiro versus mês atual, períodos conflitantes, fila concorrente, correção durante envio, migração da versão antiga e duas abas reais gravando/sincronizando 20 anotações. Os testes de revisão de recibo validam a interface e a persistência; não medem precisão de OCR em fotos reais.

## Operação dos lembretes

Aplicada a migração `202610050005_notification_operations.sql`. Publicadas `notification-status`, `financial-notifications` e a correção do `whatsapp-webhook`. Credencial do job instalada nos secrets e no Vault; não está no repositório. Agenda de 15 minutos preparada, inicialmente pausada.

Template `nexo_aviso_financeiro`, idioma `pt_BR`, um parâmetro no corpo, cadastrado na Meta. Status observado durante a entrega: **PENDING**. O comando de ativação recusa template pendente, incompatível ou diferente do configurado na função.

Com `.env.server` privado já configurado:

```powershell
# Somente consultar; não altera agendamento nem envia mensagens.
node --env-file=.env.server scripts/configure-notifications.mjs --status-only

# Após aprovação da Meta; verifica o template antes de ativar.
node --env-file=.env.server scripts/configure-notifications.mjs --activate
```

O envio considera apenas pessoas com consentimento e WhatsApp vinculado; a aprovação do template não garante a entrega. Falhas ficam no histórico. Não foram enviados avisos reais como parte dos testes desta entrega.

## Dependências externas ainda abertas

- **Open Finance:** não há conexão bancária implementada ou homologada. A implementação depende da seleção e contratação de um provedor, além de homologar consentimento, conexão, sincronização, revogação e conciliação. Não foi criada uma conexão simulada nem um botão que prometa conexão disponível.
- **Usabilidade com pessoas de 70 anos:** testes automatizados não substituem observação. Use o roteiro abaixo; nenhum resultado com pessoas foi alegado.
- **Precisão de recibos:** é necessário um conjunto autorizado de fotos reais variadas, com resultados conferidos, para medir erros de leitura.

## Roteiro de 10 minutos com cada familiar

Abra “Experimentar sem cadastro” e diga que são dados fictícios. Peça uma tarefa por vez, sem apontar onde clicar:

1. “Veja quanto saiu neste mês.”
2. “Anote um gasto de R$ 25,50 na farmácia.”
3. “O valor estava errado. Corrija para R$ 23,50.”
4. “Encontre onde você falaria com o Nexo pelo WhatsApp.” Na demonstração, avaliar apenas encontrar e entender o caminho; envio real exige conta vinculada.
5. “Descubra quanto gastou em janeiro.”
6. “Encontre suas metas e volte para o resumo.”

Anote para cada tarefa: conseguiu sozinho, tempo aproximado, dúvidas e erros. Ao final, pergunte o que significam “sobrou no mês” e “saldo bancário”. Qualquer dúvida sobre valores ou dificuldade repetida deve orientar a próxima alteração. Não tire conclusões comparativas com o Pierre a partir desse pequeno piloto.
