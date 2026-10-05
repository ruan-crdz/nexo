# Árvore do projeto

Gerada por `node scripts/project-tree.mjs`. Dependências, builds, secrets e relatórios temporários omitidos.

```text
nexo/
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── quality.yml
├── docs/
│   ├── screenshots/
│   │   ├── home-desktop.png
│   │   └── home-mobile.png
│   ├── BENCHMARK.md
│   ├── PROJECT_TREE.md
│   ├── ROADMAP.md
│   ├── STATUS.md
│   └── VALIDATION.md
├── knowledge/
│   └── seed.json
├── public/
│   └── nexo.svg
├── scripts/
│   ├── check-pages.mjs
│   ├── prepare-secrets.mjs
│   ├── project-tree.mjs
│   └── seed-knowledge.mjs
├── shared/
│   ├── domain.ts
│   ├── extraction.ts
│   ├── financial-engine.ts
│   └── insights.ts
├── src/
│   ├── data/
│   │   ├── client.ts
│   │   ├── context.tsx
│   │   ├── demo.ts
│   │   └── repository.ts
│   ├── design-system/
│   │   ├── components.tsx
│   │   ├── styles.css
│   │   └── tokens.css
│   ├── features/
│   │   ├── Assistant.tsx
│   │   ├── Auth.tsx
│   │   ├── Business.tsx
│   │   ├── Editor.tsx
│   │   ├── Home.tsx
│   │   ├── Mfa.tsx
│   │   ├── Planning.tsx
│   │   ├── Resources.tsx
│   │   ├── Settings.tsx
│   │   └── Shell.tsx
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── advice.ts
│   │   │   ├── financial-context.ts
│   │   │   ├── http.ts
│   │   │   ├── openai.ts
│   │   │   └── whatsapp.ts
│   │   ├── account-delete/
│   │   │   └── index.ts
│   │   ├── account-export/
│   │   │   └── index.ts
│   │   ├── ai-chat/
│   │   │   └── index.ts
│   │   ├── ai-financial-analysis/
│   │   │   └── index.ts
│   │   ├── ai-transaction-parser/
│   │   │   └── index.ts
│   │   ├── ai-transcribe/
│   │   │   └── index.ts
│   │   ├── business-analysis/
│   │   │   └── index.ts
│   │   ├── generate-weekly-plan/
│   │   │   └── index.ts
│   │   ├── rag-search/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   └── security_test.ts
│   │   ├── whatsapp-link/
│   │   │   └── index.ts
│   │   ├── whatsapp-send/
│   │   │   └── index.ts
│   │   ├── whatsapp-webhook/
│   │   │   └── index.ts
│   │   ├── deno.json
│   │   └── deno.lock
│   ├── migrations/
│   │   ├── 202610040001_core.sql
│   │   ├── 202610040002_ai_whatsapp.sql
│   │   ├── 202610040003_operations.sql
│   │   └── 202610040004_mfa.sql
│   └── config.toml
├── tests/
│   ├── e2e/
│   │   └── app.spec.ts
│   └── unit/
│       ├── database.test.ts
│       ├── extraction.test.ts
│       └── financial-engine.test.ts
├── .env.example
├── .env.server.example
├── .gitignore
├── .npmrc
├── .prettierignore
├── .prettierrc.json
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── DATABASE.md
├── DEPLOYMENT.md
├── DESIGN_SYSTEM.md
├── eslint.config.js
├── FINANCIAL_ENGINE.md
├── index.html
├── LICENSE
├── package-lock.json
├── package.json
├── playwright.config.ts
├── PRIVACY.md
├── RAG.md
├── README.md
├── SECURITY.md
├── tsconfig.json
├── vite.config.ts
└── WHATSAPP.md
```
