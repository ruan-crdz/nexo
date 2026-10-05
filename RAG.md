# Conhecimento com origem

Pergunta → embedding → recuperação verificada → contexto do servidor → motor → resposta estruturada → métricas/fontes. Sem evidência suficiente, a Function comunica a limitação.

`knowledge/seed.json`: vinte registros, treze princípios autorais revisados e sete candidatos desativados. Cobertura inicial: reserva, fluxo, dívidas, bem-estar e riscos/custos de fundos. Fontes verificadas são CFPB e SEC/Investor.gov. Jurisdição US é explícita: conceitos gerais não sustentam regras fiscais ou trabalhistas brasileiras.

A curadoria brasileira e a biblioteca de pesquisas revisadas por pares ainda precisam ser ampliadas. Não há estudos inventados. Textos são sínteses curtas, não livros copiados. A licença do resumo não transfere a licença da fonte.

```sh
npm run rag:check
npm run rag:seed
```

Ingestão usa `.env.server`; upsert por URL/tópico e documento/ordinal permite reexecução. Cada princípio é um chunk semântico. Documentos longos exigem segmentação temática e revisão. Troca de modelo requer reindexar todos os embeddings de 1536 dimensões.

Níveis editoriais: A institucional, B revisado por pares, C livro técnico, D opinião educacional. A/B recebem preferência no ranking. Limiar 0,30; até cinco resultados por consulta padrão. Esses parâmetros precisam de avaliação com perguntas reais.

Evidência é dado não confiável, separado de instruções. Não há ferramentas de escrita no assistente. A resposta escolhe IDs permitidos de fontes/métricas; valores são anexados pelo código. Dígitos, R$ e % na explicação do modelo são rejeitados. Isso reduz risco numérico, mas não prova correção de afirmações qualitativas.

Fontes: [CFPB reserva](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/), [CFPB dívidas](https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/), [CFPB bem-estar](https://www.consumerfinance.gov/consumer-tools/educator-tools/financial-well-being-resources/), [SEC fundos](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-funds-etfs/mutual-funds), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

Não há busca web ao vivo no assistente. Avaliações semânticas, adversariais e de jurisdição são trabalho contínuo, ainda sem homologação externa.
