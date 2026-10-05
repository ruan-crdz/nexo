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

Home: saudação → dinheiro atual → marco/plano → fluxo → movimentos. Pessoal e Empresas compartilham padrões, preservando contexto separado. Não há gradiente de IA ou visual cripto.

Componentes: Button, Card, PageHeader, SectionTitle, Stat, Progress, Badge, Empty, Why, Dialog. Dialog usa elemento nativo modal, foco e Escape. Foco visível, skip link, labels, estado de erro/status, navegação móvel e menu de todas as áreas. Reduced motion respeitado.

WCAG 2.2 AA é objetivo, não certificação. Axe verifica a home em desktop/mobile; fluxos também verificam ausência de overflow. Revisão com leitor de tela e pessoas com baixa literacia ainda é necessária. Screenshots gerados pelo Playwright em `docs/screenshots/`.

Tom: claro, respeitoso e sem julgamento. Não atribuir culpa, garantir retorno ou apresentar score como medida de valor pessoal. Empty states explicam a primeira ação possível.
