# Design system Nexo

Tokens em `src/design-system/tokens.css`; componentes em `components.tsx`; padrões responsivos em `styles.css`. Páginas usam esses componentes e a folha compartilhada. O projeto usa CSS próprio, sem Tailwind, para manter identidade e hierarquia centralizadas.

| Token | Cor / uso                                            |
| ----- | ---------------------------------------------------- |
| ink   | #252521, texto e ação principal                      |
| cream | #F7F3E8, fundo                                       |
| sand  | #E8E0CD, superfícies secundárias                     |
| paper | #FFFDF8, cards                                       |
| terra | #A94729, versão de terracota ajustada para contraste |
| moss  | #56634C, texto de progresso                          |
| lime  | #B8D56A, acento                                      |
| muted | #625F55, texto secundário ajustado após axe          |

Tipografia: Segoe UI/sans-serif de sistema para interface; Georgia para momentos editoriais. Não há dependência de fonte remota ou fonte paga. Numerais tabulares para dinheiro. Espaçamento em escala de quatro pixels, raios 8/16/24, movimentos curtos, sombras discretas.

Experiência atual: saudação → WhatsApp → entrou/saiu/sobrou no mês → anotar manualmente → últimas anotações. Navegação restrita a Início, Anotações, WhatsApp e Ajustes. Empresa, pontuação e projeções não fazem parte da experiência pública. O resumo mensal explicita que não é saldo bancário.

Componentes: Button, Card, PageHeader, SectionTitle, Stat, Progress, Badge, Empty, Why, Dialog. Dialog usa elemento nativo modal, foco e Escape. Foco visível, skip link, labels, estado de erro/status, navegação móvel e menu de todas as áreas. Reduced motion respeitado.

Regras da experiência simples em `src/design-system/simple.css`: texto principal de 18 px, apoio de 16 px, botões de 56 px, labels persistentes, ações com verbos e navegação móvel de quatro itens. Cadastro inicial pede só nome; formulário de anotação pede valor/descrição/data e esconde detalhes opcionais. Modo claro/escuro/sistema configurado em Ajustes, com preferência persistida.

WCAG 2.2 AA é objetivo, não certificação. Axe verifica seis telas nos temas claro/escuro, em desktop/mobile, além do formulário. Testes cobrem 320/390/768 px, foco inicial, cancelamento, persistência, correção e confirmação de exclusão. Revisão com leitores de tela e teste de uso com os pais do usuário continuam importantes; testes automáticos não substituem observação de uso. Screenshots em `docs/screenshots/`.

Tom: claro, respeitoso e sem julgamento. Não atribuir culpa, garantir retorno ou apresentar score como medida de valor pessoal. Empty states explicam a primeira ação possível.
