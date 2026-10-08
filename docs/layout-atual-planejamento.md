# Planejamento: layout atual

Ficha factual da experiência Planejamento, iniciada em `/#/planejar`. O resumo mostra compromissos previstos e limites; áreas próprias concentram edição e gerenciamento. O Nexo não realiza pagamentos nem recebe dinheiro.

## Mapa da tela

```text
DESKTOP
┌────────┬────────────────────────────────────────────────────────────┐
│ Nexo   │ Perfil e controles compartilhados                    ⋯    │
│ Início ├────────────────────────────────────────────────────────────┤
│ Histór.│ Faixa de demonstração, se aplicável                        │
│ Nexo   │ Planejamento                                               │
│ Objet. │ Outubro                                                    │
│ Planej.│ Próximos 30 dias                                           │
│        │ R$ 1.091,90 em contas previstas                            │
│        │ 12 OUT  Internet                              R$ 119,90     │
│        │ 15 OUT  Faculdade                             R$ 580,00     │
│        │ Ver todas as contas                                       >│
│        ├────────────────────────────────────────────────────────────┤
│        │ Limites do mês                                            >│
│        │ Alimentação  R$ 620 de R$ 800  barra  R$ 180 livres        │
│        │ Transporte   R$ 210 de R$ 350  barra  R$ 140 livres        │
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
│ + Adicionar planejamento                    │
├─────────────────────────────────────────────┤
│ Início | Histórico | Nexo | Objetivos | Planejar│
└─────────────────────────────────────────────┘
```

## Cabeçalho e navegação

- O título é **Planejamento**; não há frase explicativa sob ele.
- O mês corrente aparece como contexto, sem seletor de mês no resumo.
- O menu `⋯` dá acesso a Contas e Limites do mês.
- A navegação fixa tem cinco destinos: Início, Histórico, Nexo, Objetivos e Planejar. O link Objetivos abre a gestão de Caixinhas fora desta tela.
- A coluna de conteúdo tem largura máxima de 760 px. Desktop mantém uma única coluna.
- A faixa de demonstração e o controle de ocultar valores vêm da moldura compartilhada.

## Próximos 30 dias

- É a primeira seção e mostra a soma das contas pendentes do tipo gasto com data até 30 dias à frente. Contas vencidas também permanecem no total até serem atualizadas em Anotações.
- O resumo lista até três movimentos, em ordem de data e agrupados por dia. Cada item mostra descrição e valor; datas passadas recebem indicação discreta de atraso e tom terracota.
- A tela não mostra status “Pago” nem afirma que o Nexo processa pagamentos.
- **Ver todas as contas** abre `/#/planejar/contas`.
- Sem movimentos, mostra “Nada previsto por enquanto.”

## Contas

A rota `/#/planejar/contas` reúne duas listas:

- **Próximas:** movimentos pendentes no recorte de 30 dias e seu total. Contas de ocorrência única aparecem aqui como movimentos pendentes.
- **Programadas:** regras recorrentes com descrição, frequência, estado ativa/pausada e valor. Abrir uma regra leva a `/#/planejar/contas/:ruleId`.
- **Adicionar conta** abre o fluxo progressivo de criação.

O detalhe de uma regra mostra valor, descrição, categoria, próxima ocorrência pendente e estado. O menu `⋯` oferece **Editar**, **Pausar/Retomar** e **Excluir**. Ao excluir uma regra, vencimentos já anotados continuam em Anotações. Nenhum pagamento é executado ou desfeito.

### Criar conta

O fluxo pede nome, valor, vencimento, frequência e revisão, uma etapa por vez. As frequências são mensal, semanal, anual ou **Só desta vez**. O botão final é **Confirmar conta** para regras recorrentes e **Anotar conta** para ocorrência única.

- **Mais opções** reúne categoria (padrão “Outros”), tipo gasto/renda, data final e reajuste anual.
- Regras recorrentes ativas podem gerar movimentos previstos pendentes; não são pagas ou recebidas automaticamente.
- **Só desta vez** cria apenas um movimento pendente, sem regra recorrente.
- Editar uma regra abre o mesmo fluxo com os dados existentes. Pausar/retomar fica no menu do detalhe.

## Limites do mês

- O resumo mostra no máximo dois limites, priorizados pelo maior percentual de uso, e leva à rota `/#/planejar/limites`.
- O cálculo considera gastos pagos da mesma categoria no mês corrente e até hoje; entradas e movimentos pendentes ficam de fora.
- Cada linha apresenta categoria, valor gasto de limite, barra e valor livre. Quando ultrapassado, mostra o excedente; a barra visual é limitada a 100%.
- Sem limites, mostra “Nenhum limite definido para este mês.”
- A página completa lista todos os limites do mês. Abrir um item leva a `/#/planejar/limites/:budgetId`; o menu `⋯` permite **Editar limite** ou **Excluir limite**.

### Criar limite

O fluxo pede a categoria e o valor máximo. O mês corrente é automático; a criação padrão não pergunta mês. Um limite existente para a mesma categoria e mês é atualizado, não duplicado.

## Adicionar planejamento

O resumo tem um único CTA, **Adicionar planejamento**, que abre “O que quer planejar?” com duas opções: **Conta** e **Limite de gastos**. Caixinhas não aparecem aqui; sua criação e gestão ficam em Objetivos.

## Botões e responsividade

- Os botões de ação do design system usam altura uniforme de 48 px, inclusive quando classes locais definem dimensões maiores.
- Opções de frequência/categoria são controles de seleção; linhas de lista e links de navegação não são botões de ação.
- O resumo mantém a ordem Próximos 30 dias → Limites do mês em celular e desktop e não deve gerar rolagem horizontal em 320 px.
- Wizards mostram progresso, voltar e continuar. Links, botões e barras têm rótulos acessíveis; barras expõem `progressbar`.

## Referências de implementação

- `src/features/PlanningExperience.tsx`: resumo, Contas, Limites, detalhes e wizards.
- `src/features/Shell.tsx`: moldura e cinco destinos de navegação.
- `src/features/SimpleMoney.tsx`: atalho para Planejamento na Home.
- `shared/planning.ts` e `shared/domain.ts`: cálculos e validação.
- `src/design-system/simple.css`: layout e altura uniforme dos botões.
- `tests/e2e/app.spec.ts`: navegação, resumo, fluxos progressivos e altura dos botões.
