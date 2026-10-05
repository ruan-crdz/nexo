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

Experiência atual: saudação e seleção de mês → entrou/saiu/sobrou → evolução de seis meses e categorias → últimas anotações e ações rápidas → WhatsApp. No celular, ações rápidas precedem a evolução. O PC distribui os blocos em duas colunas. Navegação restrita a Início, Anotações, WhatsApp e Ajustes. Empresa, pontuação e projeções não fazem parte da experiência pública. O resumo mensal explicita que não é saldo bancário e exclui previsões e datas futuras. Categorias adicionais são agrupadas sem alterar o total.

Componentes: Button, Card, PageHeader, SectionTitle, Stat, Progress, Badge, Empty, Why, Dialog. Dialog usa elemento nativo modal, foco e Escape, limita campos à largura disponível e trava a rolagem do fundo. Foco visível, skip link, labels, estado de erro/status e navegação móvel. Reduced motion respeitado.

Regras da experiência em `src/design-system/simple.css`: texto principal de 18 px, apoio de 14–16 px, botões de pelo menos 44 px, labels persistentes, ações com verbos e navegação móvel de quatro itens. Cadastro inicial pede só nome; formulário de anotação pede valor/descrição/data e esconde detalhes opcionais. Modo claro/escuro/sistema configurado em Ajustes, com preferência persistida e acesso rápido no cabeçalho.

WCAG 2.2 AA é objetivo, não certificação. Axe verifica seis telas nos temas claro/escuro, em desktop/mobile, além do formulário. Testes cobrem nove larguras de 320 a 1920 px, texto ampliado, modais expandidos, foco inicial, cancelamento, persistência, correção, confirmação de exclusão e conservação dos totais por categoria. Revisão com leitores de tela e teste de uso com os pais do usuário continuam importantes; testes automáticos não substituem observação de uso. Screenshots em `docs/screenshots/`.

Tom: claro, respeitoso e sem julgamento. Não atribuir culpa, garantir retorno ou apresentar score como medida de valor pessoal. Empty states explicam a primeira ação possível.
