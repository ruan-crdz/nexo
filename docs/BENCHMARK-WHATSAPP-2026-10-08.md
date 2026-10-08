Benchmark de experiência financeira no WhatsApp — consulta em 08/10/2026.

Este é um levantamento documental, não um teste comparativo de contas reais. Foram consultadas fontes dos próprios fornecedores. Central de ajuda documenta comportamento declarado; demonstração em landing page ilustra a experiência anunciada, sem comprovar execução, latência ou precisão. Ausência de documentação não significa ausência da funcionalidade. Não foram enviadas mensagens, contratados planos nem compartilhados dados com concorrentes. Não há ranking de qualidade medido.

| Referência | Evidência pública consultada | Aplicação proposta ao Nexo |
| --- | --- | --- |
| [Pierre — funcionamento](https://ajuda.pierre.finance/pt-BR/articles/16020658-como-o-pierre-funciona) e [canais](https://ajuda.pierre.finance/pt-BR/articles/16035173-como-usar-o-pierre) | Open Finance para importar dados; WhatsApp para consultas rápidas e avisos, app para experiência completa. | Integrar canais em torno dos mesmos dados e acompanhar mudanças importantes. A automação bancária permanece uma diferença relevante. |
| [Mobills PRO — central de ajuda](https://mobills.zendesk.com/hc/pt-br/articles/39727734628251-Tudo-sobre-o-Mobills-PRO) | Registro por texto/áudio, consultas de contas/cartões e lembretes. A documentação manda corrigir no app e informa que fotos/vídeos não são aceitos pelo assistente. | O Nexo já implementa edição e leitura de imagens no WhatsApp: há uma vantagem de cobertura frente ao escopo documentado, sem demonstrar superioridade de precisão. |
| [Poupa.ai](https://poupa.ai/) | Anuncia registro por texto, áudio e foto, categorização, lembretes, uso compartilhado e painel; Google Sheets no plano Casal. | Valor para famílias vem do uso cotidiano compartilhado e de lembretes úteis. Não basta acrescentar formatos de entrada. |
| [GranAI](https://granai.app/) | Demonstra registro com resposta curta; consulta com resumo e link para relatório; lembrete seguido de atualização por mensagem. | Concluir a ação no chat e oferecer aprofundamento opcional. Não obrigar a abrir o app para saber se algo foi concluído. |
| [Granafin](https://granafin.com/) | Demonstra entrada/saída, categorização e confirmação posterior ao registro. Anuncia áudio, texto, foto e painel. | Pedido claro → execução → comprovante curto. Os botões de exemplos na página são da demonstração web, não prova de botões nativos no WhatsApp. |
| [Banco do Brasil — WhatsApp](https://www.bb.com.br/site/pra-voce/atendimento/whatsapp-bb/) | Documenta início com saudação/menu, consultas por áudio e acesso a atendimento humano. É referência de canal, não concorrente equivalente: opera serviços bancários. | Oferecer caminhos visíveis para quem não sabe o que pedir e uma saída de ajuda quando a conversa falha. Não copiar operações bancárias para um organizador de registros. |

Sobre preços e posicionamento, todos sujeitos a alteração:

- [Pierre](https://ajuda.pierre.finance/pt-BR/articles/16035183-quais-sao-os-planos-do-pierre): Básico gratuito com um banco, um agente e conversas limitadas; Pro anunciado a R$ 39/mês. Gratuidade não é exclusividade do Nexo.
- Mobills: WhatsApp faz parte do PRO; a central consultada oferece teste de sete dias solicitado ao suporte, mas não traz preço atual suficiente para comparação numérica.
- Poupa.ai: anuncia modalidade sem mensalidade condicionada à IA do usuário e planos pagos com IA inclusa. A modalidade gratuita não equivale a operação sem custo; sua integração com assinaturas de terceiros não foi validada nesta pesquisa.
- GranAI: anuncia Individual mensal a R$ 19,90 e Família mensal a R$ 34,90, além de ofertas anuais e teste de sete dias. As condições anuais devem ser conferidas no checkout.
- Granafin: anuncia R$ 59,90/mês, oferta anual de R$ 159,90 e teste de três dias. São ofertas públicas, não compras verificadas.

O padrão observado nas demonstrações de GranAI e Granafin é uma resposta de execução curta. No Pierre, a documentação de [assistentes personalizados](https://ajuda.pierre.finance/pt-BR/articles/16021492-como-criar-um-assistente-personalizado-no-pierre) descreve transformar pedidos em condições de monitoramento, frequência e canal. São duas frentes distintas: registrar com pouco esforço e acompanhar sem depender de novas perguntas.

Não foi encontrada evidência suficiente para comparar memória de longo prazo, taxa de erro, recuperação de exclusões ou qualidade de aconselhamento na situação “tenho pouco dinheiro até o próximo recebimento”. Não presumir que as empresas resolvem corretamente esses casos. Também não há base para atribuir-lhes modelos, prompts ou arquitetura interna.

Para o Nexo, a direção recomendada é uma combinação de conversa livre, execução direta e escolhas pontuais. As mensagens abaixo são propostas próprias, não transcrições dos concorrentes:

| Situação | Resposta ou interação proposta |
| --- | --- |
| Registro simples concluído | “Anotado: R$ 36,64 no Carrefour, hoje.” Ações opcionais: Corrigir, Desfazer, Ver no app. |
| Vários registros concluídos | “Pronto: registrei os 4 movimentos e as 2 recorrências. Confira os detalhes no app.” Usar apenas contagens retornadas pelo banco. |
| Correção ambígua | “Encontrei dois gastos no Carrefour. Qual deles?” Mostrar valor e data nas escolhas. |
| Consulta | Responder primeiro o valor e o período; oferecer registros/gráfico como aprofundamento. |
| Meta | Informar progresso e uma próxima ação viável, sem inventar dinheiro disponível para o aporte. |
| Necessidades já garantidas | Preservar essa informação; perguntar apenas pelos custos adicionais ainda desconhecidos. |
| Saldo e planejamento | Distinguir dinheiro declarado pela pessoa, resultado dos registros e projeção. Nunca mudar a origem do valor durante a conversa. |
| Falha após salvar | Confirmar o que efetivamente foi concluído; não mandar repetir o pedido inteiro. |

Botões são sugestões de UX. Não acrescentar confirmação obrigatória a um pedido claro; usá-los para descoberta, desambiguação e recuperação. Desfazer exige restauração real e vinculada à operação, inclusive em lote, antes de ser anunciado como disponível. Links para detalhes devem respeitar a autenticação e abrir o contexto certo, sem dados financeiros expostos na URL.

Prioridades propostas, sem pressupor que já foram implementadas:

1. Dar origem, data e validade a cada premissa de aconselhamento. O valor mostrado na Home não vira automaticamente dinheiro disponível. É o problema evidenciado na conversa enviada pelo usuário.
2. Preservar fatos úteis: necessidades cobertas, dinheiro declarado, horizonte de planejamento, compromissos e itens já concluídos. Atualizar ou esclarecer fatos que possam ter mudado, sem perguntar tudo novamente.
3. Separar registro de aconselhamento. Um gasto simples merece uma confirmação curta; avaliação de compra ou sobrevivência até uma data merece premissas e uma pergunta relevante. Evitar repetir o painel financeiro inteiro a cada registro.
4. Acrescentar recuperação simples e desambiguação por escolhas. Desfazer uma ação é diferente de pedir autorização duas vezes.
5. Validar lembretes e resumos proativos de ponta a ponta antes de anunciá-los. Medir utilidade e permitir escolher frequência e interromper os avisos.

Para um benchmark real de qualidade, executar a mesma bateria em contas de teste autorizadas de cada produto. A tabela abaixo é um protocolo proposto, ainda não executado nos concorrentes:

| Cenário | Critério observado |
| --- | --- |
| Um gasto por texto | Valor, data, categoria e status corretos; quantidade de mensagens necessárias. |
| Áudio com três gastos e uma entrada | Todos os itens salvos uma vez, sem perder um item. |
| Dois gastos e uma recorrência | Distinguir pagamento realizado de compromisso futuro. |
| Correção do valor anterior | Alterar o alvo correto, sem criar outro gasto. |
| Dois registros semelhantes | Desambiguar antes de alterar um deles. |
| Reenvio e “continue” | Não duplicar o que já foi concluído. |
| Comprovante repetido | Detectar ou esclarecer duplicidade; verificar disponibilidade do recurso. |
| Dinheiro até uma data | Usar dinheiro declarado, período correto e custos conhecidos; explicitar o que falta. |
| Necessidades garantidas + novos passeios | Manter contexto e pedir somente custos adicionais desconhecidos. |
| Falha de entrega depois de salvar | Recuperar confirmação sem repetir gravação. |

Registrar: sucesso por tarefa, erros de valor/data/alvo, alterações indevidas, mensagens por tarefa, tempo mediano e percentil 95, retenção de contexto, recuperação e custo. Cada teste deve ter uma situação inicial conhecida e verificável no painel; quando não houver acesso, marcar “não testado”, não zero. Critérios de aprovação são metas próprias de produto, não indicadores medidos da concorrência.

Conclusão de produto: o Nexo já cobre parte relevante do registro conversacional. Correção no chat e leitura de recibos merecem destaque frente às limitações publicadas do Mobills PRO. Para competir com o Pierre, dados automáticos e acompanhamento proativo são diferenças relevantes. A oportunidade para o público do Nexo é fazer tarefas cotidianas com pouca interação e premissas financeiras consistentes; superioridade só poderá ser afirmada após comparação prática.
