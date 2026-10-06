# Como a aba Investir funciona hoje

Este documento descreve o comportamento implementado no Nexo em 5 de outubro de 2026. Ele registra o estado atual, não uma proposta de produto nem uma promessa de aconselhamento de investimentos.

## Onde fica

- Navegação principal: **Investir** (`/#/investimentos`).
- Desktop: controles do plano à esquerda; orientação e explicações à direita. O painel da direita fica fixo durante a rolagem.
- Celular: duas abas, **Meu plano** e **Minha orientação**. Ao escolher uma preferência de variação ou salvar o plano, a tela muda para a orientação. O usuário pode alternar pelas abas.

## Fluxo visível

1. **Escolher um objetivo.** A tela lista objetivos financeiros já cadastrados. Também permite criar um com nome, valor desejado, valor já guardado e data desejada. O objetivo é salvo na tabela `goals`; não é criada uma conta ou aplicação financeira.
2. **Definir quanto guardar por mês.** O campo começa com o valor mensal da meta. O usuário pode alterá-lo e salvar. Isso atualiza `monthly_contribution` da meta; não movimenta dinheiro nem agenda uma transferência.
3. **Indicar quanto aceita que o valor mude.** Existem três opções: pouca mudança, alguma mudança ou grandes mudanças. A escolha afeta o texto de orientação e a fonte mostrada; ela fica apenas no estado local da tela, não é salva no perfil ou na meta.
4. **Consultar a orientação.** Uma regra local relaciona a preferência escolhida e o prazo restante ao texto exibido. No celular, esse conteúdo fica na aba **Minha orientação**.
5. **Pedir uma explicação à IA.** Em conta real, a tela chama `ai-chat` com objetivo, valores, prazo, preferência e contexto financeiro agregado. A resposta pode trazer explicação e fontes; o histórico não é salvo. Na demonstração, a IA não é chamada.

## Regras atuais da orientação

O prazo é calculado a partir da data desejada e limitado a 600 meses. A orientação fixa segue estas regras:

| Escolha | Prazo | Orientação atual | Fonte apresentada |
| --- | --- | --- | --- |
| Pouca mudança | Qualquer prazo | Priorizar previsibilidade e acesso; ainda pode haver perda. | Simulador “Meu Título Ideal” do Tesouro Direto. |
| Alguma mudança | Qualquer prazo | Comparar opções mais estáveis e opções que podem subir ou cair. | Portal do Investidor/CVM. |
| Grandes mudanças | Até 24 meses | Avisar que a preferência e o prazo não combinam bem. | Página de riscos da CVM. |
| Grandes mudanças | Mais de 24 meses | Explicar variações e risco de perda em prazo maior. | Página de tipos de investimento da CVM. |

Essa regra é código determinístico em `directionFor`; não é uma recomendação gerada pela IA. A fonte do Tesouro aparece na opção de pouca mudança, não como sugestão universal. A tela não compara ofertas de Nubank, bancos ou corretoras.

## Cálculo exibido

- A conta usa o valor desejado, o que já está guardado, a data desejada e o valor mensal informado.
- O motor calcula quanto seria necessário guardar mensalmente para alcançar o objetivo na data, sem ganhos.
- A outra quantia mostrada soma o valor já guardado aos depósitos mensais informados, limitada ao valor do objetivo. Não inclui juros, taxas, impostos ou inflação.
- A indicação de que o plano é suficiente compara o valor mensal digitado com a quantia mensal calculada.
- O painel “Ver os números usados neste plano” mostra dinheiro estimado após contas, reserva e renda menos contas fixas com base nos registros do Nexo. Os números podem estar incompletos e não autorizam transferências.

Observação para uma futura US: o texto da soma acumulada deve deixar inequívoco que usa o valor mensal digitado, enquanto a quantia necessária é mostrada separadamente.

## Como a IA é usada

- A pergunta enviada inclui nome e valores do objetivo, prazo em meses, opção de variação escolhida e os totais de dinheiro livre, reserva e dívidas.
- `ai-chat` busca até cinco itens na base RAG e calcula contexto financeiro no servidor. A explicação só é exibida com fontes retornadas como suporte; sem evidência suficiente, a resposta declara essa limitação.
- O prompt proíbe recomendação de compra de produto, banco, título, ação ou fundo, retorno garantido e sugestões de Tesouro Direto por padrão. A IA deve explicar se preferência e prazo combinam ou entram em conflito.
- A tela mostra a explicação e as fontes, mas não usa a resposta da IA para alterar o plano, escolher ativos ou movimentar dinheiro.
- Os materiais brasileiros de investimento da base RAG ainda não estão todos revisados e ativados. Portanto, a IA pode não ter evidência suficiente para orientação específica no Brasil.

## Limites do produto atual

- Não há conexão Open Finance nesta tela nem consulta às ofertas, taxas, saldo ou posição de uma instituição.
- Não há ordem, transferência, compra, venda, custódia ou execução automática.
- A preferência de variação não é um teste formal de adequação, não é persistida e não basta para determinar um perfil completo.
- Os textos fixos têm quatro caminhos e não comparam produtos pelo prazo, custos e regras de resgate de uma oferta real.
- A IA explica conceitos apoiada na base disponível; não é consultoria regulada e não substitui os formulários de perfil/suitability da instituição escolhida.
- Nenhum valor projetado é promessa de resultado. O cenário numérico atual deliberadamente considera zero de ganhos.

## Código e testes relacionados

- Tela e regra de orientação: `src/features/InvestmentsPage.tsx`.
- Cálculo de meta: `shared/financial-engine.ts`, função `goalPlan`.
- Contexto e busca de evidências da IA: `supabase/functions/_shared/advice.ts` e `financial-context.ts`.
- Testes de fluxo, risco, navegação mobile e acessibilidade: `tests/e2e/app.spec.ts`.

## Ideias ainda não implementadas

- Perguntar em linguagem simples quanto tempo o usuário pode deixar o dinheiro guardado, se pode precisar dele antes e se aceita perder parte.
- Explicar a diferença entre “posso perder?” e “posso retirar quando quiser?”, produto a produto, com fonte e data de atualização.
- Personalizar a orientação usando objetivo, prazo e orçamento sem tratar o rótulo escolhido como perfil completo.
- Mostrar um próximo passo apropriado ao caso e explicar quando os dados não permitem indicar onde investir.
- Testar a conclusão da tarefa com pessoas sem familiaridade com investimentos antes de afirmar que a tela está clara.