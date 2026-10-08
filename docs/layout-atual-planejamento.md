# Planejamento: layout atual

Ficha factual da página **Planejar**, rota interna `/#/planejar`, componente `PlanningHub`. Conferida em 8 de outubro de 2026. A página organiza compromissos futuros, limites mensais e Caixinhas; valores previstos não são tratados como dinheiro pago ou recebido.

## Mapa da tela

```text
DESKTOP
┌────────┬────────────────────────────────────────────────────────────┐
│ Nexo   │ Perfil e controles compartilhados                          │
│ Início ├────────────────────────────────────────────────────────────┤
│ Histór.│ Faixa de demonstração, se aplicável                        │
│ Nexo   │ Planejar                                                  │
│ Objet. │ O que está por vir, sem misturar previsão com dinheiro pago.│
│ Planej.│ Próximas contas                         Adicionar           │
│        │ Data · descrição · valor                                   │
│        │ Ver movimentos previstos                                   │
│        ├────────────────────────────────────────────────────────────┤
│        │ Limites do mês                         Novo limite         │
│        │ Categoria · gasto pago · limite · barra · disponível       │
│        ├────────────────────────────────────────────────────────────┤
│        │ Caixinhas                                                  │
│        │ Nome · guardado/alvo · barra · falta · prazo · ações        │
│        │ Acompanhar caixinhas                                        │
│        ├────────────────────────────────────────────────────────────┤
│        │ Contas recorrentes                  Nova recorrência        │
│        │ Nome · valor · frequência · estado · data inicial · ações   │
└────────┴────────────────────────────────────────────────────────────┘

CELULAR (até 700 px)
┌─────────────────────────────────────────────┐
│ Perfil, saudação e controles compartilhados │
│ Aviso de demonstração, se aplicável         │
│ Planejar                                    │
│ O que está por vir...                       │
│ Próximas contas                  Adicionar  │
│ Data · descrição · valor                    │
│ Ver movimentos previstos                    │
│ Limites do mês                  Novo limite │
│ Categoria · gasto · limite · disponível     │
│ Caixinhas                                   │
│ Nome · progresso · prazo · ações             │
│ Contas recorrentes           Nova recorrência│
│ Nome · valor · frequência · ações            │
├─────────────────────────────────────────────┤
│ Início | Histórico | Nexo | Objetivos | Planejar│
└─────────────────────────────────────────────┘
```

## Moldura compartilhada

- **Desktop:** sidebar com cinco destinos — Início, Histórico, Nexo, Objetivos e Planejar — e acesso ao perfil. O conteúdo tem largura máxima de 820 px.
- **Celular (até 700 px):** a sidebar vira barra fixa inferior com os mesmos cinco destinos. O conteúdo rola verticalmente e a navegação permanece fixa.
- Quando a demonstração está ativa, aparece antes do conteúdo: “Você está experimentando com dados de exemplo. Criar minha conta”.
- A visibilidade dos valores financeiros segue o controle global de ocultar/mostrar valores.

## Cabeçalho

- Título: **Planejar**.
- Descrição: “O que está por vir, sem misturar previsão com dinheiro já pago.”
- A página é uma coluna de seções separadas por divisores; as linhas de planejamento usam conteúdo sem cards aninhados.

## Próximas contas

- O título é “Próximas contas”. O botão **Adicionar** abre o formulário de recorrência/conta a pagar.
- Lista somente movimentos do tipo gasto com situação pendente, data de hoje até 30 dias à frente, inclusive. Ordena por data crescente e mostra no máximo cinco.
- Cada linha mostra dia/mês, descrição e valor. A seção não afirma que a conta foi paga.
- Se não houver itens, mostra “Nenhuma conta prevista para os próximos 30 dias.”
- **Ver movimentos previstos** abre `/#/movimentos`.

## Limites do mês

- O título é “Limites do mês”. **Novo limite** abre o formulário de limite por categoria.
- Mostra somente limites cujo mês corresponde ao mês corrente no fuso horário do perfil.
- Para cada limite, soma gastos pagos da mesma categoria, dentro do mês e até hoje. Movimentos pendentes, entradas e categorias diferentes não entram nessa conta.
- A linha mostra categoria, valor gasto de valor limite, barra de progresso e valor disponível. Se o gasto ultrapassar o limite, mostra “Acima do limite” e a diferença excedida; a barra visual fica limitada a 100%.
- Sem limites, mostra “Sem limites definidos. Você pode planejar uma categoria quando fizer sentido.”

### Criar ou editar limite

O diálogo **Limite por categoria** contém:

- **Valor (R$)**;
- **Categoria**, escolhida entre as categorias disponíveis;
- **Mês**, em formato de mês/ano.

Ao salvar, um limite existente para a mesma categoria e mês é atualizado em vez de criar outro. Não há um campo de nome livre nem uma prévia de gastos futuros nesse formulário.

## Caixinhas

- A seção lista os objetivos já cadastrados; não cria uma Caixinha nova diretamente nessa página.
- Cada linha mostra nome, valor guardado de valor alvo, barra, valor restante e prazo ou “sem data final”. O progresso visual é limitado a 100%.
- **Acompanhar caixinhas** abre `/#/metas`, onde se cria e acompanha objetivos.
- Cada Caixinha tem ações para editar e excluir. A edição abre o formulário de Caixinha usado pela jornada: nome, motivo, alvo, valor atual, passo semanal opcional e prazo opcional.
- O formulário de edição avisa que alterações do valor guardado ficam registradas no histórico. Com prazo, apresenta estimativa mensal baseada nas anotações e na sobra atual; sem prazo, informa que não há cota mensal obrigatória.
- Sem objetivos, mostra “Nenhuma caixinha criada.”

## Contas recorrentes

- A seção lista as regras existentes. **Nova recorrência** abre o formulário de conta recorrente.
- A linha mostra descrição, valor, frequência (semanal, mensal ou anual), estado (ativa ou pausada) e data inicial. As ações permitem editar e excluir.
- Sem regras, mostra “Nenhuma recorrência cadastrada.”
- A lista não apresenta, na linha resumida, categoria, tipo gasto/renda, data final ou percentual de reajuste; esses campos pertencem ao formulário.

### Criar ou editar recorrência

O formulário contém:

- **Nome**, obrigatório, de 2 a 180 caracteres;
- **Valor (R$)**, positivo;
- **Categoria**;
- **Primeiro vencimento**, obrigatório;
- **Frequência:** semanal, mensal ou anual;
- **Gasto ou renda:** gasto previsto ou renda prevista;
- **Data final (opcional)**, não anterior ao primeiro vencimento;
- **Reajuste anual**, de 0 a 10.000 pontos-base, em que 100 pontos-base equivalem a 1%;
- **Recorrência ativa**, marcada por padrão em novas regras.

Os avisos explicam que vencimentos ficam pendentes, nunca pagos ou recebidos automaticamente, e que alterações valem para vencimentos futuros ainda não gerados. Ao editar uma regra existente, a frequência continua sendo semanal, mensal ou anual; a opção de conta única só aparece na criação.

### Conta única

Na criação de recorrência, **Única vez** muda o diálogo para **Conta a pagar**. O movimento é salvo uma vez como pendente, com nome, valor, categoria, data e tipo gasto/renda. Não cria uma regra recorrente nem realiza pagamento ou recebimento. O botão passa a ser **Anotar conta**.

# Planejamento: layout atual

Ficha factual da experiência Planejamento, iniciada na rota `/#/planejar`. A página resume contas previstas, limites mensais e Caixinhas; configurações completas ficam em áreas próprias. A tela não realiza pagamentos nem recebe dinheiro.

## Mapa da tela

```text
DESKTOP
┌────────┬────────────────────────────────────────────────────────────┐
│ Nexo   │ Perfil e controles compartilhados                    ⋯    │
│ Início ├────────────────────────────────────────────────────────────┤
│ Histór.│ Faixa de demonstração, se aplicável                        │
│ Nexo   │ Planejamento                                               │
│        │ Outubro                                                    │
│        │ Próximos 30 dias                                           │
│        │ R$ 1.091,90 em contas previstas                            │
│        │ 12 OUT  Internet                              R$ 119,90     │
│        │ 15 OUT  Faculdade                             R$ 580,00     │
│        │ Ver todas as contas                                       >│
│        ├────────────────────────────────────────────────────────────┤
│        │ Limites do mês                                            >│
│        │ Alimentação  R$ 620 de R$ 800  barra  R$ 180 livres        │
│        │ Transporte   R$ 210 de R$ 350  barra  R$ 140 livres        │
│        ├────────────────────────────────────────────────────────────┤
│        │ Caixinhas                                                  >│
│        │ R$ 8.450 guardados                                         │
│        │ Reserva       R$ 7.200 de R$ 10.200  barra 71%             │
│        │ Viagem        R$ 1.250 de R$ 5.000   barra 25%             │
│        │ Ver Caixinhas                                              >│
│        │                                                            │
│        │ + Adicionar planejamento                                   │
└────────┴────────────────────────────────────────────────────────────┘

CELULAR (até 700 px)
┌─────────────────────────────────────────────┐
│ Perfil, saudação e controles compartilhados │
│ Aviso de demonstração, se aplicável         │
│ Planejamento                             ⋯  │
│ Outubro                                     │
│ Próximos 30 dias                            │
│ R$ 1.091,90 em contas previstas             │
│ 12 OUT  Internet                 R$ 119,90  │
│ 15 OUT  Faculdade                R$ 580,00  │
│ Ver todas as contas                      > │
│ Limites do mês                           > │
│ Alimentação · R$620 de R$800                │
│ barra · R$180 livres                        │
│ Transporte · R$210 de R$350                 │
│ barra · R$140 livres                        │
│ Caixinhas                                > │
│ R$8.450 guardados                           │
│ Reserva · barra 71%                         │
│ Viagem · barra 25%                          │
│ Ver Caixinhas                            > │
│ + Adicionar planejamento                    │
├─────────────────────────────────────────────┤
│ Início | Histórico | Nexo                   │
└─────────────────────────────────────────────┘
```

## Moldura e cabeçalho

- O título é **Planejamento**. Não há descrição explicativa sob o título.
- O mês corrente aparece como contexto, sem seletor de mês na visão-resumo.
- O menu `⋯` oferece atalhos para Contas, Limites do mês e Caixinhas.
- A navegação fixa tem três destinos: Início, Histórico e Nexo. Planejamento é acessado pelo atalho na Home.
- Quando a demonstração está ativa, aparece antes da página a faixa “Você está experimentando com dados de exemplo. Criar minha conta”. A visibilidade dos valores segue o controle global.
- A coluna de conteúdo limita-se a 760 px; desktop conserva uma coluna, sem transformar o resumo em dashboard de três colunas.

## Próximos 30 dias

- É a primeira seção. O total soma movimentos pendentes do tipo gasto com data até 30 dias à frente; contas vencidas continuam incluídas até serem atualizadas em Anotações.
- Na visão-resumo aparecem até três movimentos, ordenados pela data e agrupados visualmente por dia. Vencimentos passados recebem texto discreto como “Venceu ontem” e cor terracota; os próximos mostram dia e mês.
- Cada linha apresenta descrição e valor. A seção não mostra status “Pago” nem sugere que o Nexo processa pagamentos.
- **Ver todas as contas** abre `/#/planejar/contas`.
- Sem movimentos, aparece “Nada previsto por enquanto.”

## Contas

A rota `/#/planejar/contas` separa **Próximas** e **Programadas**.

- **Próximas** reúne os movimentos pendentes do mesmo recorte usado no resumo e mostra o total. Uma conta única aparece aqui como movimento pendente.
- **Programadas** lista regras recorrentes com descrição, frequência, estado ativa/pausada e valor. Abrir uma regra leva a `/#/planejar/contas/:ruleId`.
- **Adicionar conta** inicia o fluxo de conta.
- Quando não há movimentos ou regras, a área correspondente mostra um estado vazio curto.

### Detalhe da conta programada

Mostra valor previsto, descrição, categoria, próxima ocorrência pendente encontrada e estado da regra. O menu `⋯` contém **Editar**, **Pausar/Retomar** e **Excluir**. Ao excluir, movimentos já gerados continuam em Anotações; nenhum pagamento é desfeito ou apagado.

## Limites do mês

- O resumo mostra no máximo dois limites, priorizados pelo maior percentual de uso, e oferece acesso à rota `/#/planejar/limites`.
- O cálculo considera gastos pagos da mesma categoria no mês corrente e até hoje. Entradas e movimentos pendentes não entram na soma.
- Cada linha mostra categoria, gasto de limite, barra e valor livre; quando ultrapassado, mostra a diferença acima. A barra visual se limita a 100%.
- Sem limites cadastrados para o mês, aparece “Nenhum limite definido para este mês.”

A rota `/#/planejar/limites` lista todos os limites do mês. Abrir um item leva a `/#/planejar/limites/:budgetId`, com gasto, teto, barra e saldo disponível/excedido. O menu `⋯` nessa tela contém **Editar limite** e **Excluir limite**.

## Caixinhas

- A Home de Planejamento mostra o total guardado em todas as Caixinhas e no máximo duas, cada uma com nome, valor guardado/alvo, barra e percentual.
- **Ver Caixinhas** abre `/#/metas`. Não há lápis ou lixeira na página de resumo.
- Sem objetivos, aparece “Guarde para algo que importa.”

## Adicionar planejamento

O único ponto de entrada é **Adicionar planejamento**, no fim do resumo. A rota `/#/planejar/adicionar` pergunta **O que quer planejar?** e apresenta Conta, Limite de gastos e Caixinha. Caixinha continua para o fluxo de criação existente em `/#/metas/nova`.

### Conta: fluxo progressivo

O wizard pede uma decisão por etapa: nome, valor, vencimento, frequência e revisão. Frequências: todo mês, toda semana, todo ano ou só desta vez. Ao final, o usuário confirma a conta.

- **Mais opções** reúne categoria (padrão “Outros”), tipo gasto/renda, data final e reajuste anual.
- Para recorrências, as contas geradas permanecem pendentes; o Nexo nunca paga ou recebe automaticamente. Pausar/retomar fica no detalhe da conta.
- **Só desta vez** anota um movimento pendente único, sem criar uma regra recorrente.
- A edição de uma regra abre o mesmo wizard preenchido com os dados atuais.
- Erros aparecem no fluxo e não são confirmados enquanto o salvamento falha.

### Limite: fluxo progressivo

O wizard pede categoria e valor máximo. O mês corrente é selecionado automaticamente; não há pergunta de mês na criação padrão. Uma categoria já limitada no mês é atualizada, em vez de duplicada. A tela completa permite abrir um limite, editar ou excluir.

## Responsividade e acessibilidade

- A ordem das seções é a mesma em desktop e celular: contas, limites, Caixinhas. Não há layout em colunas paralelas.
- Wizard ocupa a coluna de conteúdo e mostra etapa/progresso, voltar e continuar. No celular os controles ocupam a largura disponível; o resumo não deve gerar rolagem horizontal em 320 px.
- Links de seção e botões de ícone têm nomes acessíveis; barras expõem progresso como `progressbar`.
- Valores usam o controle global de privacidade. Datas, mês e valores usam controles nativos apropriados.

## Referências de implementação

- `src/features/PlanningExperience.tsx`: resumo, páginas de Contas/Limites, detalhes e wizards.
- `src/features/Shell.tsx`: navegação fixa e moldura compartilhada.
- `src/features/SimpleMoney.tsx`: atalho de Planejamento na Home.
- `shared/planning.ts`: cálculo dos limites e ocorrências recorrentes.
- `shared/domain.ts`: validação de limites, movimentos e regras recorrentes.
- `src/design-system/simple.css`: resumos, etapas e responsividade.
- `tests/e2e/app.spec.ts`: regressões de navegação, contas, limites e Caixinhas.
