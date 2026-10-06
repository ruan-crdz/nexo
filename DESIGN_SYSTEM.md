# Design system Nexo

Tokens em `src/design-system/tokens.css`; componentes em `components.tsx`; padrões responsivos em `styles.css`. Páginas usam esses componentes e a folha compartilhada. O projeto usa CSS próprio, sem Tailwind, para manter identidade e hierarquia centralizadas.

| Token | Cor / uso                                            |
| ----- | ---------------------------------------------------- |
| ink   | #192B25, texto e ação principal                      |
| cream | #F4F7F6, fundo                                       |
| sand  | #E7EEEA, superfícies secundárias                     |
| paper | #FFFFFF, cards                                       |
| terra | #A94729, versão de terracota ajustada para contraste |
| moss  | #24664F, entradas e progresso                        |
| lime  | #B8D56A, acento                                      |
| muted | #56645E, texto secundário ajustado após axe          |

Tipografia: Manrope local para interface, com fallback de sistema; Georgia para momentos editoriais legados. Não há dependência de fonte remota ou fonte paga. Numerais tabulares para dinheiro. Espaçamento em escala de quatro pixels, superfícies compactas e sombras discretas.

Shell autenticado: rail lateral discreto no desktop e três destinos no mobile (Início, Histórico, Você). O cabeçalho oferece avatar/saudação, ocultação de valores e Proteção. Anotar fica como ação primária na Home. Conteúdo principal é limitado em largura e a navegação preserva alvos de toque e labels completos.

Home: resultado registrado do mês → CTA WhatsApp → Anotar e Escanear recibo → no máximo um insight → uma meta → três movimentos. Não há gráficos, contas completas, avisos ou configuração na Home. Valores são formatados pelo Financial Engine e podem ser ocultados globalmente.

Planejar: seções verticais para próximas contas, limites, metas e recorrências. Movimentos possui busca, período, tipo, origem e status pendente. Anotar abre uma folha de ações no mobile e um diálogo no desktop; a entrada manual reusa `MoneyForm`. IA, recibo e importação mantêm confirmação/revisão existente.

Empresa, pontuação e projeções antigas continuam fora das rotas pessoais públicas. Rotas compatíveis não foram removidas durante a reorganização. O resumo mensal explicita que não é saldo bancário e exclui previsões e datas futuras.

Componentes: Button, Card, PageHeader, SectionTitle, Stat, Progress, Badge, Empty, Why, Dialog e MoneyValue. `FinancialVisibilityProvider` guarda a preferência local; `useMoneyDisplay` e `redactFinancialText` aplicam a máscara em valores e respostas textuais. Dialog usa elemento nativo modal, foco e Escape, limita campos à largura disponível e trava a rolagem do fundo; `.capture-sheet` usa apresentação inferior no mobile. Foco visível, skip link, labels, estado de erro/status e navegação móvel. Reduced motion respeitado.

Regras da experiência em `src/design-system/simple.css`: texto principal legível, apoio de 14–16 px, botões de pelo menos 44 px, labels persistentes, ações com verbos e navegação móvel de três itens. Onboarding pede nome, oferece conexão WhatsApp opcional e pergunta um objetivo; formulário de movimento esconde detalhes opcionais. Modo claro/escuro/sistema configurado em Você, com preferência persistida.

WCAG 2.2 AA é objetivo, não certificação. Axe verifica seis telas nos temas claro/escuro, em desktop/mobile, além do formulário. Testes cobrem nove larguras de 320 a 1920 px, texto ampliado, modais expandidos, foco inicial, cancelamento, persistência, correção, confirmação de exclusão e conservação dos totais por categoria. Revisão com leitores de tela e teste de uso com os pais do usuário continuam importantes; testes automáticos não substituem observação de uso. Screenshots em `docs/screenshots/`.

Tom: claro, respeitoso e sem julgamento. Não atribuir culpa, garantir retorno ou apresentar score como medida de valor pessoal. Empty states explicam a primeira ação possível.
