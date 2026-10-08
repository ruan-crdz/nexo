# Histórico: layout atual

Ficha factual da página **Histórico** (rota interna `/#/movimentos`, componente `SimpleHistory`), conferida em 8 de outubro de 2026. O nome exibido no título é “Movimentos”. Este documento descreve a interface atual, não propõe um redesign. Quantidades, descrições, datas e valores dependem dos registros da conta.

## Mapa da tela

```text
DESKTOP
┌────────┬────────────────────────────────────────────────────────────┐
│ Nexo   │ Avatar do perfil                 Ocultar valores Protecao │
│ Inicio ├────────────────────────────────────────────────────────────┤
│ Histor.│ Aviso de demonstracao, se aplicavel                        │
│ Nexo   │ Movimentos                                                 │
│ Objet. │ Texto explicativo                                          │
│ Planej.│ Anotar gasto   Anotar entrada                              │
│        │ ┌──────────── Painel de movimentos ──────────────────────┐ │
│        │ │ Mes anterior  Mes dos movimentos  Proximo mes           │ │
│        │ │ Buscar movimentos                                     │ │
│        │ │ Todas | Gastos | Entradas | Pendentes                  │ │
│        │ │ Todas as origens | No app | WhatsApp | Arquivo         │ │
│        │ │ Movimento: dados, valor, situacao e acoes               │ │
│        │ │ Movimento: dados, valor, situacao e acoes               │ │
│        │ └───────────────────────────────────────────────────────┘ │
│  R     │                                                            │
└────────┴────────────────────────────────────────────────────────────┘

CELULAR
┌────────────────────────────────────────────┐
│ Avatar                              Olhos   │
│ Ola, [nome]                         Protecao│
│ Aviso de demonstracao, se aplicavel         │
│ Movimentos                                  │
│ Texto explicativo                           │
│ Anotar gasto       Anotar entrada           │
│ ┌──────────── Painel ─────────────────────┐ │
│ │ Mes anterior | Mes | Proximo mes        │ │
│ │ Buscar movimentos                       │ │
│ │ Todas | Gastos | Entradas               │ │
│ │ Pendentes                               │ │
│ │ Todas as origens | No app | WhatsApp ...│ │
│ │ Movimento: descricao e valor            │ │
│ │ Data, categoria, origem e situacao      │ │
│ │ Detalhes / Corrigir / Excluir           │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ Inicio | Historico | Nexo | Objetivos | Plan.│
└────────────────────────────────────────────┘
```

## Moldura compartilhada

- **Desktop:** sidebar fixa/colapsada visualmente em 80 px, com a marca Nexo e cinco destinos icônicos: Início, Histórico, Nexo (marca “N”), Objetivos e Planejar. O avatar do perfil fica no fim da sidebar. A área de conteúdo central tem largura máxima de 820 px.
- **Celular (até 700 px):** sidebar vira barra fixa inferior com os mesmos cinco destinos. Nexo aparece como a marca “N”, sem texto visível. O topo Moss mostra avatar, saudação, ocultar/mostrar valores e Proteção.
- Quando a demonstração está ativa, aparece antes da página a faixa “Você está experimentando com dados de exemplo. Criar minha conta”.
- A tela rola verticalmente; os filtros quebram em mais linhas quando necessário. Em 390 px não há rolagem horizontal.

## Conteudo em ordem

1. **Título e explicação:** “Movimentos” e “Tudo que entrou no Nexo, com a origem de cada registro. Toque em ‘Corrigir’ para mudar algo.”
2. **Acoes de registro:** “Anotar gasto” como botao principal e “Anotar entrada” como secundario. Cada um abre o fluxo de registro correspondente sobre a tela.
3. **Painel único:** uma superfície delimitada envolve seletor de mês, busca, filtros e lista/estado vazio. Os movimentos não ficam em cards individuais.
4. **Seletor de mês:** seta para mês anterior, select “Mês dos movimentos” e seta para próximo mês. Inicia no mês atual. O select oferece 133 meses, de 120 meses antes do atual até 12 meses depois; as setas continuam permitindo navegar além da lista.
5. **Busca:** campo “Buscar movimentos”, placeholder “Ex.: mercado”. Filtra pelo texto da descrição, sem diferenciar maiúsculas/minúsculas. Não pesquisa categoria, conta ou origem.
6. **Filtro por tipo/situação:** botões “Todas”, “Gastos”, “Entradas” e “Pendentes”. O selecionado usa o estilo principal e `aria-pressed`; “Pendentes” inclui registros com status `planned`.
7. **Filtro por origem:** botões “Todas as origens”, “No app”, “WhatsApp” e “Arquivo”. O selecionado usa o estilo principal e `aria-pressed`.
8. **Lista:** mostra os movimentos que correspondem ao mês, busca, tipo/status e origem escolhidos. A ordem é da data mais recente para a mais antiga. Não há totalizador, agrupamento por dia nem paginação nessa tela.

## Linha de movimento

Cada linha é separada por um divisor fino e mostra:

- **Ícone de tipo:** seta de saída para gasto; seta de entrada para receita. Gasto usa tom terracota, receita usa tom verde.
- **Descricao:** texto clicavel que abre “Detalhes do movimento”.
- **Data, categoria e origem:** por exemplo, “20 de out. de 2026 · Moradia · Anotado no app”. As origens sao “Anotado no app”, “WhatsApp” e “Arquivo importado”.
- **Valor:** sinal negativo para gasto e positivo para entrada; valores de entrada recebem estilo verde. Exemplo visual: “− R$ 165,00”.
- **Situação:** gasto previsto mostra “Ainda não aconteceu”; gasto pago mostra “Pago”; entrada recebida mostra “Recebido”.
- **Acoes:** “Detalhes”, “Corrigir” e “Excluir”. Corrigir abre o formulario do movimento existente. Excluir abre uma confirmacao antes da remocao.

No celular, o ícone e a descrição ficam na primeira linha; o valor pode ir para a linha seguinte alinhado com a descrição. Situação e ações ficam abaixo e podem quebrar em mais de uma linha.

## Detalhes e confirmacoes

Ao tocar na descrição ou em “Detalhes”, abre um diálogo “Detalhes do movimento” com descrição e valor em destaque, seguido por:

- Categoria;
- Data completa;
- Origem;
- Status: Pendente, Recebido ou Pago;
- Conta vinculada, ou “Sem conta vinculada”.

O diálogo explica a origem: mensagem do WhatsApp, arquivo importado ou registro manual no app. Inclui o botão “Corrigir movimento”.

“Excluir” abre “Excluir este movimento?”, mostra descrição e valor, explica que o registro será retirado do resumo e oferece “Sim, excluir movimento” e “Não, voltar”. Se a exclusão falha, a mensagem de erro aparece no diálogo.

## Estado sem resultados

Se a combinação atual de mês, busca e filtros não encontrar registros, a lista é substituída por “Nenhum movimento por aqui.” e “Confira o mês e a busca, ou anote seu primeiro gasto.” Os seletores, busca e botões de filtro continuam visíveis.

## Referencias de implementacao

- `src/features/SimpleMoney.tsx`: `SimpleHistory`, `MoneyRows`, dialogos de detalhe/exclusao e formulario de correcao.
- `src/features/Shell.tsx`: cabecalho e navegacao compartilhados.
- `src/design-system/simple.css` e `src/design-system/styles.css`: painel, filtros, linhas, dialogos e breakpoints responsivos.
