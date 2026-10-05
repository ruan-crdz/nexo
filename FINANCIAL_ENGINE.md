# Financial Engine

`shared/financial-engine.ts`, versão `1.0.0`. Não depende de rede, IA, navegador ou banco.

## Representação e datas

Inteiros de centavos limitados a ±9.000.000.000.000. Multiplicações por taxas e divisões monetárias usam BigInt; meio centavo arredonda para longe de zero. Somas validam overflow. Taxas em pontos-base: 100 = 1%, 3500 = 35%. `parseMoney` aceita formato brasileiro e rejeita separadores ambíguos.

Datas civis `YYYY-MM-DD` são separadas de instantes UTC. Timezone IANA é explícito. Deslocamento mensal usa o dia original ou o último possível; “ontem” é calculado pelo código.

| Função            | Regra                                                             |
| ----------------- | ----------------------------------------------------------------- |
| compound          | saldo anterior + juros arredondados + aporte ao fim do mês        |
| installments      | divisão inteira; centavos restantes nas primeiras parcelas        |
| amortization      | Price racional BigInt ou SAC; última parcela reconcilia principal |
| debtPayoff        | juros, mínimos e excedente por taxa ou saldo                      |
| goalPlan          | restante / meses; horizonte indefinido sem aporte                 |
| inflationAdjusted | nominal / (1 + inflação)^anos inteiros                            |
| runway            | caixa / consumo líquido; null sem consumo                         |
| breakEven         | fixos / margem de contribuição; null com margem nula              |
| employeeCost      | salário + encargos + benefícios + outros; anual = mensal × 12     |
| businessScenario  | caixa + resultado × meses; admite caixa futuro negativo           |
| unitEconomics     | CAC, ARPU, LTV aproximado, ARR e payback; null sem denominador    |
| canSpend          | caixa + entradas previstas − contas − reserva − aportes − compra  |

Até 600 meses em juros/amortização. Quitação interrompe se pagamento não cobre mínimos/juros. Não inclui IOF, multas ou tarifas. Inflação é hipótese informada, não índice atualizado.

## Dupla contagem

Patrimônio = saldos iniciais + movimentos pagos até hoje + bens externos − dívidas. Metas são alocações informativas; `saved` não soma patrimônio. Reserva compõe o saldo e é protegida no valor livre. Não cadastre investimento como conta e bem simultaneamente, nem dívida de cartão já refletida em saldo negativo.

DRE usa premissas, não soma movimentos reais novamente. Fixos excluem folha/pró-labore. Pagamentos de dívida e transferências não são reconciliados automaticamente: registre compromissos nos movimentos e atualize a dívida. “Livre” depende da completude dos registros.

## Score e jornada

Pesos: liquidez 15, dívida 15, comprometimento 10, reserva 20, consistência 5, evolução 10, poupança 15, metas 10. Valores limitados a 0–100; pesos conhecidos renormalizados. Cobertura mostra os dados disponíveis. Evolução não é pontuada na interface sem snapshot confiável. É heurística, não score de crédito nem escala validada.

Jornada prioriza dívida cara (regra explícita de produto: 3% a.m.), patrimônio negativo, colchão, reserva e patrimônio. Reserva contextual considera variabilidade, dependentes e proteção; as faixas não são universais.

`npm run test:coverage` verifica conservação de valores, arredondamento, limites, anos bissextos, timezone, renda zero, amortização negativa e cenários. Cobertura não substitui revisão financeira independente.
