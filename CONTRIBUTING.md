# Contribuindo

1. Use Node 24, `npm ci` e dados sintéticos.
2. Preserve o contrato de centavos inteiros e taxas em pontos-base.
3. Alterações financeiras precisam de exemplos independentes e testes de conservação/limites.
4. Mudanças de schema exigem migration nova, RLS e teste cruzado entre duas contas/empresas.
5. Não exponha tokens em `VITE_`, logs, screenshots, fixtures ou commits.
6. Mantenha demo e conta real separadas. Não substitua integração ausente por um falso sucesso.
7. Use tokens/componentes existentes e preserve labels, teclado e estados de carregamento/erro.

Antes de revisão:

```sh
npm run format
npm run check
npm run test:coverage
npm run typecheck:edge
npm run test:edge
npm run rag:check
npx playwright install chromium
npm run test:e2e
```

Não rode o seed contra produção por padrão. Para homologação local completa do Supabase, instale Docker e Supabase CLI separadamente; os testes SQL PGlite não exigem Docker.

PRs devem explicar problema, comportamento final, impacto em dados/permissões e evidência de validação. Não declare uma integração homologada sem executar o fluxo com o serviço real.
