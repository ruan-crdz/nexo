# Tela Início: layout implementado

Retrato factual da Home, conferido em 8 de outubro de 2026, após a reorganização para resumo simples e revelação progressiva dos detalhes. Os valores e nomes de exemplo abaixo não são conteúdo fixo.

## Estrutura

```text
DESKTOP
┌──────┬───────────────────────────────────────────────────────────┐
│  N   │                                      Ocultar valores  ◉   │
│  ⌂   ├───────────────────────────────────────────────────────────┤
│  ↕   │ Aviso de demonstração (quando aplicável)                  │
│  N   │ Seu mês >                                                 │
│  ◎   │ Valor livre para planejar · Entrou · Saiu                 │
│  ▦   │ WhatsApp · Anotar · Recibo · Planejar                     │
│      │ Insight curto (condicional)                               │
│      │ Objetivos >                                               │
│      │ Últimos movimentos                                        │
│  R   │                                                           │
└──────┴───────────────────────────────────────────────────────────┘

CELULAR
┌─────────────────────────────────────────┐
│ Avatar                         ◉    ◉   │
│ Olá, [nome]                             │
│ Aviso de demonstração (quando aplicável)│
│ Seu mês >                               │
│ Valor livre para planejar · Entrou · Saiu│
│ WhatsApp · Anotar · Recibo · Planejar   │
│ Insight curto (condicional)             │
│ Objetivos >                             │
│ Últimos movimentos                      │
├─────────────────────────────────────────┤
│ Início   Histórico     N     Objetivos   Planejar │
└─────────────────────────────────────────┘
```

## Navegação e moldura

- No desktop, a barra lateral fixa tem 80 px: marca Nexo compacta no topo, ícones de Início, Histórico, Nexo, Objetivos e Planejar, e avatar do perfil no rodapé. O destino Nexo usa a marca “N”, não um balão de mensagem. Os ícones têm rótulos acessíveis e tooltip; não há rótulos permanentes.
- O conteúdo principal fica centralizado em uma coluna com largura máxima de 820 px. O cabeçalho de desktop mantém os controles para ocultar valores e abrir Proteção.
- Até 700 px, a barra lateral some. O topo fica verde Moss (`#64715A` no tema claro; verde escuro no tema escuro), com avatar à esquerda, ocultar valores e Proteção à direita, e saudação na linha seguinte.
- A navegação fixa inferior do celular tem cinco destinos: Início, Histórico, Nexo, Objetivos e Planejar. Nexo aparece com o símbolo “N”; os demais mostram ícone e rótulo. Perfil abre pelo avatar do cabeçalho.
- Quando a demonstração está ativa, aparece antes do conteúdo o aviso “Você está experimentando com dados de exemplo. Criar minha conta”. O conteúdo deixa espaço inferior para a barra fixa; não há rolagem horizontal entre 320 e 1440 px.

## Conteúdo, de cima para baixo

1. **Resumo do mês:** sobre o fundo da página, sem card, borda ou painel verde. O título “Seu mês” e uma seta formam um botão que abre/recolhe detalhes. O valor principal e a legenda “livre para planejar neste mês” (ou “faltou nos movimentos deste mês” se negativo) ficam sempre visíveis, seguidos por uma linha com entradas e saídas.
2. **Detalhes do mês, recolhidos inicialmente:** ao abrir “Seu mês”, mostra resultado dos movimentos, valores destinados a Objetivos, valor reservado para contas e essenciais, contas previstas e metodologia. A metodologia informa que são estimativas baseadas nas anotações, que renda prevista não é dinheiro recebido e que o valor não é saldo bancário.
3. **Ações rápidas:** quatro atalhos circulares nesta ordem: WhatsApp, Anotar, Recibo e Planejar. WhatsApp abre a integração/conversa conforme o estado da conta; Anotar abre o registro; Recibo abre o envio de comprovante; Planejar abre Planejamento. A faixa distribui os quatro itens e rola horizontalmente se houver itens adicionais.
4. **Insight do Nexo, quando houver sinal:** faixa compacta com uma frase, um valor e uma seta de ação. Contas previstas dos próximos sete dias têm prioridade; sem elas, pode surgir uma variação relevante dos gastos pagos entre meses completos. Sem insight válido, a faixa não aparece.
5. **Objetivos:** cabeçalho “Objetivos” com seta para a área completa. Abaixo, um objetivo em foco mostra nome, valor guardado, alvo, barra de progresso e percentual. Não mostra aporte sugerido, prazo ou alerta longo na Home. Sem objetivo em foco, mostra “Escolha um objetivo”. O termo é apenas o rótulo desta tela; dados e rota interna continuam compatíveis com a estrutura existente.
6. **Últimos movimentos:** título e link “Histórico”, seguidos por até três registros recentes. Eles são agrupados por “Hoje”, “Ontem” ou data e mostram símbolo, descrição e valor; categoria, origem, data detalhada e status não ocupam a linha resumida. Tocar na descrição abre os detalhes. Sem registros, há uma mensagem de estado vazio.

## Aparência observada

- Tipografia: Manrope. Tema acompanha a preferência salva ou a configuração do aparelho.
- A página mantém fundo Cream no tema claro ou verde quase preto no tema escuro. O topo móvel usa Moss; insight usa uma faixa Sand com acento verde. Resumo, objetivos e movimentos são áreas abertas, sem cartões decorativos.
- Em 1440×900, o conteúdo principal mediu cerca de 724 px de largura. Em 390×844, resumo e conteúdo usaram 358 px com margens laterais de 16 px. A altura varia com a mensagem e o estado da conta.

## Exemplo da demonstração

Na captura consultada, o mês era outubro de 2026: R$ 0,00 livres para planejar; entradas de R$ 6.500,00 e saídas de R$ 2.251,00. O insight mostrava “Internet vence em 15 de out.” e R$ 119,90. O objetivo em foco era “Uma reserva para respirar”, com R$ 7.200,00 de R$ 10.200,00 e progresso de 71%. São dados demonstrativos, não valores fixos do layout.

Referências de implementação: `src/features/SimpleMoney.tsx` (`SimpleHome`), `src/features/Shell.tsx`, `src/design-system/simple.css` e `src/design-system/tokens.css`.
