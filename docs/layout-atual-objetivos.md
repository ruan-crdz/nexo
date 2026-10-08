# Objetivos: layout atual

Ficha factual da experiência de Caixinhas, acessível pela rota `/#/metas`. A lista reúne todos os objetivos; criação e detalhe são telas separadas. O progresso é registrado pelo Nexo e não representa saldo bancário sincronizado nem movimenta dinheiro.

## Lista de Caixinhas

- O cabeçalho é “Caixinhas” e oferece um atalho de criação.
- Quando existem objetivos, um total resume o valor guardado em todas as Caixinhas.
- Cada item mostra nome, valor guardado, alvo, barra e percentual. Tocar no item abre seu detalhe.
- Sem objetivos, a tela explica como começar e oferece a criação.
- A navegação fixa tem três destinos: Início, Histórico e Nexo. Objetivos permanece acessível por links contextuais, incluindo Home, Perfil e Planejar.

## Criar Caixinha

A rota `/#/metas/nova` apresenta um wizard de seis etapas, com progresso visível e navegação para voltar:

1. Escolher a categoria do objetivo.
2. Definir o nome da Caixinha.
3. Informar o valor alvo.
4. Informar quanto já está guardado, podendo começar em zero.
5. Escolher se quer definir um prazo; sem prazo, a data é armazenada como `null`.
6. Revisar os dados e confirmar a criação.

Após salvar, o Nexo abre o detalhe da Caixinha criada. O envio bloqueia ações repetidas e erros aparecem na própria etapa.

## Detalhe

A rota `/#/metas/:goalId` exibe uma Caixinha por vez, com valor guardado, alvo, percentual, barra e valor restante. Ações principais:

- **Registrar valor guardado:** adiciona um valor já separado e registra uma movimentação, sem criar uma despesa duplicada.
- **Retirar:** reduz o valor guardado. O motivo é opcional e pode indicar emergência ou uso no objetivo. Uma emergência não apaga o pico histórico nem movimentações anteriores.

Informações secundárias permitem editar alvo, prazo, nome/categoria e consultar o histórico. Metas sem prazo continuam sem cota mensal obrigatória. IDs inexistentes mostram uma saída para voltar à lista.

## Interface e limites

- Check-ins, hábitos, pontos, níveis, conquistas e personalização não fazem parte da experiência de Caixinhas.
- Os valores registrados são informativos. O Nexo não movimenta dinheiro nem confirma um saldo bancário.
- Lista, detalhe e wizard se adaptam a telas menores; os cartões representam objetivos individuais e não agrupam painéis adicionais.

Referências de implementação: `src/features/GoalsPage.tsx`, `src/features/ObjectivesExperience.tsx`, `src/features/Shell.tsx` e `src/design-system/simple.css`.