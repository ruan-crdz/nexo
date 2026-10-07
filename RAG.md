# Conhecimento com origem

Pergunta e turnos recentes → contexto do servidor/motor → recuperação verificada complementar → resposta estruturada → valores/fontes. Leituras dos registros do usuário não exigem fonte externa. Recomendações específicas sem evidência relevante comunicam a limitação, sem invalidar os cálculos dos próprios registros.

`knowledge/seed.json`: vinte registros, treze princípios autorais revisados e sete candidatos desativados. Cobertura inicial: reserva, fluxo, dívidas, bem-estar e riscos/custos de fundos. Fontes verificadas são CFPB e SEC/Investor.gov. Jurisdição US é explícita: conceitos gerais não sustentam regras fiscais ou trabalhistas brasileiras.

A curadoria brasileira e a biblioteca de pesquisas revisadas por pares ainda precisam ser ampliadas. Não há estudos inventados. Textos são sínteses curtas, não livros copiados. A licença do resumo não transfere a licença da fonte.

```sh
npm run rag:check
npm run rag:seed
```

Ingestão usa `.env.server`; upsert por URL/tópico e documento/ordinal permite reexecução. Cada princípio é um chunk semântico. Documentos longos exigem segmentação temática e revisão. Troca de modelo requer reindexar todos os embeddings de 1536 dimensões.

Níveis editoriais: A institucional, B revisado por pares, C livro técnico, D opinião educacional. A/B recebem preferência no ranking. Limiar 0,30; até cinco resultados por consulta padrão. Esses parâmetros precisam de avaliação com perguntas reais.

Evidência e histórico são dados não confiáveis, separados de instruções. Não há ferramentas de escrita no assistente do app. A resposta escolhe IDs permitidos de fontes/métricas e referências `{{chave}}`; o servidor substitui as referências pelos valores calculados. Dígitos, R$ e % literais na explicação do modelo, referências desconhecidas e fontes inexistentes são rejeitados. São exibidas no máximo seis métricas relevantes. Isso reduz risco numérico, mas não prova correção de afirmações qualitativas.

O contexto pessoal usa o mesmo `goalMonthlyBudget` da Home, com aportes registrados e despesas reservadas; contribuição desejada não vira dinheiro já separado. Histórico é enviado apenas como contexto recente de até seis mensagens; persistência continua dependente do opt-in existente. A busca complementar é limitada a oito segundos. Falha de RAG não bloqueia a conversa; falha de IA pode retornar uma leitura local identificada, sem fingir que foi gerada pelo modelo.

Fontes: [CFPB reserva](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/), [CFPB dívidas](https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/), [CFPB bem-estar](https://www.consumerfinance.gov/consumer-tools/educator-tools/financial-well-being-resources/), [SEC fundos](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-funds-etfs/mutual-funds), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

Não há busca web ao vivo no assistente. Avaliações semânticas, adversariais e de jurisdição são trabalho contínuo, ainda sem homologação externa.
