# Tela Nexo: layout atual

Descrição da tela Nexo/IA após a refatoração, rota `/#/nexo`. O conteúdo muda conforme conversa, demonstração, preferências e organização ativa. Voice captura/transcrição depende de navegador e conta real.

## Mapa da tela

```text
DESKTOP
┌────────┬────────────────────────────────────────────────────────────┐
│ Nexo   │ Nexo                                       Pessoal ▾   ⋮   │
│ Início ├────────────────────────────────────────────────────────────┤
│ Histór.│ Estado vazio:                 Conversa ativa:              │
│ Nexo   │ N + O que você quer saber?    mensagens                     │
│ Objet.│ [chips com perguntas]          resposta + número + ação      │
│ Planej.│                                 Por quê? / Dados / Fontes    │
│  R     │ Perguntas relacionadas         + pergunta      mic  enviar │
└────────┴────────────────────────────────────────────────────────────┘

CELULAR
┌────────────────────────────────────────────┐
│ Aviso de demonstração, se aplicável        │
│ Nexo                               ⋮        │
│ Pessoal ▾ (somente com empresa disponível) │
│ N + O que você quer saber?                 │
│ [chips que quebram/rolam]                   │
│                                            │
│ Conversa e respostas recolhíveis           │
│ Perguntas relacionadas                     │
│ + Pergunte sobre seu dinheiro… 🎙 ➜        │
├────────────────────────────────────────────┤
│ Início | Histórico | Nexo | Objetivos | Planejar│
└────────────────────────────────────────────┘
```

## Moldura e cabeçalho

- **Desktop:** a sidebar compartilhada tem 80 px, a marca Nexo e cinco destinos; o avatar fica no fim. Na rota Nexo, o cabeçalho global não aparece. O conteúdo central fica limitado a 760 px.
- **Celular (até 700 px):** a barra fixa inferior mantém cinco destinos. A saudação, avatar, olho e Proteção globais ficam ocultos nesta rota; o cabeçalho contextual mostra Nexo, seletor opcional Pessoal/empresa e menu `⋮`.
- Quando a demonstração está ativa, uma faixa aparece antes do conteúdo: “Você está experimentando com dados de exemplo. Criar minha conta”.
- O cabeçalho da página mostra somente “Nexo” e ações contextuais. Não há badge de modo, descrição permanente nem repetição do cabeçalho global.

## Estado inicial da conversa

Quando não há mensagens, o centro da conversa mostra a marca compacta Nexo e “O que você quer saber?”. Não há texto de instrução adicional.

Há três sugestões em chips secundários, formadas com o estado dos dados:

- “Como está meu mês?”
- “Posso gastar R$ 500?”
- “Qual dívida devo priorizar?” se houver dívidas; caso contrário, pergunta sobre quando atingir o alvo do objetivo em foco; sem objetivo, “Como está minha reserva?”.

Ao tocar num chip, a pergunta é enviada na própria conversa. Depois de uma resposta aparecem até três perguntas relacionadas. O item “Posso gastar?” não é mais um link isolado no estado vazio; a avaliação também pode ser iniciada pela conversa.

## Conversa

- A conversa tem papel acessível `log`, nome “Conversa com Nexo”, e mensagens em ordem cronológica. As etiquetas visíveis “Você” e “Nexo” não são repetidas em cada mensagem; a autoria permanece acessível a leitores de tela.
- Mensagens da pessoa aparecem em bubble Sand à direita. Respostas do Nexo ficam diretamente no canvas, sem card.
- A resposta começa com o primeiro parágrafo como conclusão direta. Em seguida, se houver métrica, mostra um único número principal escolhido conforme a pergunta e uma ação contextual, por exemplo “Ver meu mês”, “Ver objetivos” ou “Simular compra”.
- “Por quê?”, “Dados usados” e “Fontes” são disclosures independentes e recolhidos. Por quê contém o restante da resposta e a versão do motor; Dados usados lista as métricas retornadas; Fontes lista links sem exibir níveis internos de evidência.
- Quando há métricas, só a métrica principal aparece inicialmente. As demais ficam em “Dados usados”. A ocultação financeira global também mascara texto e métricas.
- Durante uma resposta, a marca Nexo acompanha três pontos animados, sem texto “Nexo está digitando”. O erro mostra uma mensagem curta, informa que a pergunta não foi perdida e oferece “Tentar novamente”; o input mantém a pergunta.

Métricas possíveis incluem saldo estimado, resultado dos movimentos, objetivos, entradas, saídas, livre para planejar, reserva, dívidas e patrimônio; no contexto empresarial podem incluir caixa, receita, custos, folha e ponto de equilíbrio. A seleção do número principal depende da pergunta e dos campos retornados. Os rótulos internos são convertidos para português.

## Compositor e preferências

- O compositor é uma única superfície próxima ao rodapé: botão `+`, input “Sua pergunta para o Nexo”, microfone e envio por ícone. O campo aceita até 2.000 caracteres; enviar fica desabilitado vazio ou enquanto há resposta pendente.
- `+` abre ações para fotografar/enviar recibo ou importar extrato. Elas levam às telas correspondentes.
- Microfone abre Nexo Voz em tela cheia. Em conta real, grava áudio, envia para transcrição, publica a pergunta textual na conversa e mantém o overlay aberto enquanto o Nexo responde em voz alta via `speechSynthesis`. O overlay fecha quando a fala termina. “Usar teclado” sai do modo voz; “Encerrar” termina a gravação e inicia a transcrição. Na demonstração, mostra o requisito de conta real e mantém a alternativa textual.
- O botão `+` abre dois atalhos: “Fotografar recibo ou enviar imagem” abre a tela de recibos; “Enviar extrato” abre a tela de importação. Esses fluxos acontecem nas páginas próprias, não como anexos inline no chat.
- O menu `⋮` contém “Nova conversa”, “Privacidade da conversa” e “Sobre as respostas”. Nova conversa limpa o estado visível sem apagar históricos já salvos no servidor.
- A preferência “Salvar minhas conversas” fica em Privacidade da conversa, desativada por padrão e persistida localmente. Quando ligada, o backend salva pergunta e resposta; as últimas seis mensagens também podem ser enviadas como contexto.
- Quando existe organização e a pessoa está numa conta real, “Pessoal ▾” abre “Minha vida financeira” e as organizações disponíveis. Sem organizações, o seletor não aparece. A escolha muda o contexto consultado.
- O aviso educacional saiu do rodapé permanente e agora aparece em “Sobre as respostas” ou junto a respostas/simulações quando relevante.
- O controle global de ocultar valores mascara o texto financeiro das mensagens e métricas, não apenas os valores renderizados como campos separados.

## Diferença entre demonstração e conta real

- **Demonstração:** perguntas são respondidas localmente, sem chamada à IA. “Como está meu mês?” usa `monthlyFlow` e apresenta entradas, saídas, resultado e valor livre; perguntas de Caixinha usam o plano local. A resposta informa que são dados de exemplo e que não representam saldo bancário confirmado. Fontes externas/RAG não são usadas.
- **Conta real:** pergunta vai para `ai-chat`. A resposta pode incluir métricas determinísticas, evidências e fontes. A transcrição de áudio e a gravação opcional de conversa também dependem de conta real e serviços configurados.

## Responsividade observada

- Em 1280×800, o conteúdo principal mede aproximadamente 724 px, dentro do máximo de 760 px. A conversa rola internamente e o compositor permanece no rodapé.
- Em 390×844, a largura do documento é 390 px; o conteúdo tem margens laterais de 16 px. O compositor de 358 px mantém `+`, input, microfone e envio na mesma fileira.
- Nexo Voz ocupa a viewport inteira; no celular o conteúdo respeita o safe area inferior. A navegação compartilhada continua fixa na parte inferior fora da tela de voz.

Referências de implementação: `src/features/Assistant.tsx`, `src/features/Shell.tsx`, `src/design-system/styles.css` e `src/design-system/simple.css`.
