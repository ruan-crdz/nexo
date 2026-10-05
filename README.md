# Nexo

**Seu dinheiro, sem complicação.**

Aplicativo de finanças pessoais pensado para pessoas com pouca familiaridade com tecnologia, incluindo idosos. WhatsApp para anotar por texto ou áudio; app para conferir o mês e corrigir anotações.

![Nexo Pessoal — demonstração desktop](docs/screenshots/home-desktop.png)

## Executar agora

Requisito: Node.js 24 LTS e npm. A demonstração funciona sem cadastro, Supabase ou chave de IA.

```sh
npm install
npm run dev
```

Abra `http://localhost:5173` e escolha **Experimentar sem cadastro**. Dados fictícios e alterações ficam neste navegador. No PowerShell com restrição a scripts, use `npm.cmd` e `npx.cmd`, sem mudar a política de execução do Windows.

## Implementado

- Quatro destinos: Início, Anotações, WhatsApp e Ajustes; textos grandes, ações escritas e modo noturno.
- Resumo mensal de entradas, gastos e diferença; não representa saldo bancário. Previsões e datas futuras não entram no resumo até acontecerem.
- Anotação manual com valor, descrição e data; detalhes opcionais. Correção preserva origem, categoria e conta de registros anteriores.
- WhatsApp com mensagem pronta para conexão, confirmação, texto/áudio, “resumo”, “ajuda” e “desfazer”; gravação idempotente.
- Cadastro inicial pede só nome. Login/recuperação, MFA existente e isolamento RLS preservados.
- Privacidade: exportação, exclusão de conta e desconexão do WhatsApp.
- Demonstração local e persistência real em Supabase, com atualização após mensagens recebidas.
- CI de qualidade e publicação manual no GitHub Pages.

**Escopo simplificado em outubro de 2026.** Empresa, score, simuladores e análises avançadas saíram da navegação e das rotas públicas. Dados antigos e migrações foram preservados, sem exclusão de registros. Documentos de planejamento anteriores podem descrever o escopo original. O WhatsApp aguarda liberação da conta pela Meta; a interface informa essa limitação, sem simular entregas bem-sucedidas.

## Produto e arquitetura

O núcleo é **dados → cálculo determinístico → evidência → explicação**. O [benchmark](docs/BENCHMARK.md) registra fontes e limitações: IA, PF/PJ e Open Finance já aparecem em outros produtos; não afirmamos exclusividade.

```mermaid
flowchart TD
  Pages[GitHub Pages / React + TypeScript] --> Auth[Supabase Auth + MFA]
  Pages --> DB[Postgres / RLS / RBAC]
  Pages --> Edge[Edge Functions]
  WhatsApp[Meta Cloud API] --> Signed[Webhook HMAC + idempotência]
  Signed --> Edge
  Edge --> Engine[Financial Engine / centavos + BigInt]
  Edge --> RAG[pgvector / conhecimento verificado]
  Edge --> OpenAI[OpenAI / Responses + áudio]
  Edge --> DB
```

O navegador recebe somente URL e chave pública do Supabase. Secrets permanecem no servidor. O motor é compartilhado entre frontend e Functions; o LLM não define valores monetários calculados.

## Stack e comandos

React, TypeScript estrito, Vite, React Router, TanStack Query, Zod, Supabase JS, Recharts e Lucide. CSS com tokens próprios e formulários controlados com validação Zod. Vitest, Playwright, axe e PostgreSQL via PGlite verificam comportamento, matemática e autorização. Deno verifica as Functions.

| Comando                             | Finalidade                              |
| ----------------------------------- | --------------------------------------- |
| `npm run dev`                       | Servidor local                          |
| `npm run check`                     | Lint, TypeScript, testes e build        |
| `npm run test:coverage`             | Cobertura financeira                    |
| `npm run typecheck:edge`            | TypeScript das Functions                |
| `npm run test:edge`                 | Segurança do backend, sem rede          |
| `npx playwright install chromium`   | Navegador de testes                     |
| `npm run test:e2e`                  | Desktop/mobile e axe                    |
| `npm run rag:check`                 | Valida seed sem serviços                |
| `npm run rag:seed`                  | Indexa conhecimento; consome embeddings |
| `npm run build` / `npm run preview` | Gera e inspeciona frontend estático     |

O Nexo Score é uma heurística educacional, não score de crédito ou escala validada. Projeções não garantem retorno. Encargos são editáveis; DRE é gerencial, não contábil. Operação comercial requer revisão jurídica e financeira independente.

Fontes técnicas: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [modelos OpenAI](https://developers.openai.com/api/docs/models), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp).

## Documentação

[Arquitetura](ARCHITECTURE.md) · [Banco](DATABASE.md) · [Motor](FINANCIAL_ENGINE.md) · [Design](DESIGN_SYSTEM.md) · [RAG](RAG.md) · [WhatsApp](WHATSAPP.md) · [Segurança](SECURITY.md) · [Privacidade](PRIVACY.md) · [Contribuição](CONTRIBUTING.md) · [Roadmap](docs/ROADMAP.md) · [Árvore](docs/PROJECT_TREE.md)

## RUAN, PARA COLOCAR O NEXO NO AR, FAÇA ISSO.

1. Rode `npm install` e `npm run dev` para conferir a demonstração.
2. Crie um projeto Supabase e preencha `.env` a partir do exemplo com URL e chave publishable.
3. Aplique todas as migrations em ordem e publique as Edge Functions.
4. Preencha `.env.server`, prepare os secrets e configure OpenAI/Meta no servidor.
5. Rode `npm run rag:seed` para indexar os resumos revisados.
6. Configure o webhook Meta e vincule sua conta pelo app.
7. Cadastre as duas variáveis públicas no GitHub, selecione Pages → GitHub Actions e execute **Publish GitHub Pages**.
8. Homologue cadastro, e-mail, isolamento, MFA, IA, fontes, WhatsApp e exclusão antes de usar dados reais.

O [guia de publicação](DEPLOYMENT.md) contém os comandos de instalação em outro ambiente. Instância do projeto: https://ruan-crdz.github.io/nexo/.
