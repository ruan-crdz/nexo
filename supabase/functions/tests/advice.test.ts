import { strict as assert } from 'node:assert';
import { advise } from '../_shared/advice.ts';
import { admin } from '../_shared/http.ts';
import { emptyProfile } from '../../../shared/domain.ts';
import { civilDate } from '../../../shared/financial-engine.ts';

const owner = '00000000-0000-4000-8000-00000000000a';
const goalId = '00000000-0000-4000-8000-000000000001';
async function withAdvice(
  run: () => Promise<void>,
  explanation: string,
  failModel = false,
  failEvidence = false,
) {
  const names = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_EMBEDDING_MODEL',
  ];
  const previous = names.map((name) => Deno.env.get(name));
  const original = globalThis.fetch;
  try {
    ['https://advice.test', 'test-service-key', 'test-openai-key', 'test-model', 'test-embedding'].forEach(
      (value, index) => Deno.env.set(names[index], value),
    );
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const headers = { 'Content-Type': 'application/json' };
      if (url.hostname === 'api.openai.com') {
        if (url.pathname.endsWith('/embeddings'))
          return failEvidence
            ? new Response('{}', { status: 503, headers })
            : new Response(JSON.stringify({ data: [{ embedding: Array(1536).fill(0) }] }), { headers });
        if (failModel) return new Response('{}', { status: 503, headers });
        const body = JSON.parse(String(init?.body));
        const payload = JSON.parse(body.input);
        assert.equal(payload.verified_calculation.free.replace(/\s/g, ''), 'R$64,08');
        assert.equal(payload.verified_calculation.goal_next_contribution.replace(/\s/g, ''), 'R$64,08');
        assert.equal(payload.history[0].content, 'Quero construir minha reserva.');
        return new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      explanation,
                      metric_keys: ['free', 'recorded_surplus'],
                      source_ids: [],
                      basis: 'records',
                    }),
                  },
                ],
              },
            ],
          }),
          { headers },
        );
      }
      assert.equal(url.hostname, 'advice.test');
      if (url.pathname.endsWith('/match_knowledge')) return new Response('[]', { headers });
      assert.equal(
        url.searchParams.get(url.pathname.endsWith('/profiles') ? 'id' : 'user_id'),
        `eq.${owner}`,
      );
      const today = civilDate(new Date(), emptyProfile.timezone);
      if (url.pathname.endsWith('/profiles'))
        return new Response(
          JSON.stringify({ ...emptyProfile, id: owner, name: 'Pessoa de teste', active_goal_id: goalId }),
          { headers },
        );
      if (url.pathname.endsWith('/transactions'))
        return new Response(
          JSON.stringify([
            {
              id: goalId,
              description: 'Sobra fictícia',
              amount: 6408,
              type: 'income',
              category: 'Outros',
              date: today,
              status: 'paid',
              source: 'manual',
              account_id: null,
            },
          ]),
          { headers },
        );
      if (url.pathname.endsWith('/goals'))
        return new Response(
          JSON.stringify([
            {
              id: goalId,
              name: 'Juntar 500 reais',
              target: 50000,
              saved: 0,
              high_water: 0,
              monthly_contribution: 20000,
              weekly_amount: 0,
              priority: 'high',
              deadline: '2026-12-31',
            },
          ]),
          { headers },
        );
      return new Response('[]', { headers });
    };
    await run();
  } finally {
    globalThis.fetch = original;
    names.forEach((name, index) => {
      if (previous[index] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, previous[index]!);
    });
  }
}
const history = [{ role: 'user' as const, content: 'Quero construir minha reserva.' }];
Deno.test('chat do app usa meta e sobra reais sem bloquear por ausência de fonte externa', async () => {
  await withAdvice(async () => {
    const reply = await advise(admin(), owner, 'Qual meu próximo passo?', undefined, history);
    assert.equal(reply.evidence_status, 'records');
    assert.equal(reply.sources.length, 0);
    assert.match(reply.answer, /R\$\s64,08/);
    assert.match(reply.answer, /Juntar 500 reais/);
    assert.ok(!reply.answer.includes('não sustenta'));
    assert.ok(!reply.answer.includes('{{'));
    assert.equal(reply.metrics.free?.replace(/\s/g, ''), 'R$64,08');
  }, 'Na meta {{goal_name}}, cabe {{goal_next_contribution}} agora. Antes de separar, confira suas necessidades até o próximo recebimento.');
});
Deno.test('chat rejeita valor inventado ou referência de cálculo inexistente', async () => {
  for (const explanation of ['Você pode gastar R$ 999,00.', 'O valor é {{saldo_inventado}}.']) {
    await withAdvice(async () => {
      await assert.rejects(
        () => advise(admin(), owner, 'Qual meu próximo passo?', undefined, history),
        /validação financeira/,
      );
    }, explanation);
  }
});
Deno.test('falha de IA mantém uma leitura local útil e identifica o fallback', async () => {
  await withAdvice(
    async () => {
      const reply = await advise(admin(), owner, 'Qual meu próximo passo?', undefined, history);
      assert.match(reply.answer, /Juntar 500 reais/);
      assert.match(reply.answer, /R\$\s64,08/);
      assert.match(reply.answer, /IA está indisponível/);
      assert.equal(reply.evidence_status, 'records');
    },
    '',
    true,
  );
});
Deno.test('busca RAG indisponível não bloqueia conversa sobre os próprios registros', async () => {
  await withAdvice(
    async () => {
      const reply = await advise(admin(), owner, 'Qual meu próximo passo?', undefined, history);
      assert.equal(reply.evidence_status, 'records');
      assert.match(reply.answer, /R\$\s64,08/);
      assert.equal(reply.sources.length, 0);
    },
    'Para {{goal_name}}, cabe {{goal_next_contribution}} sem antecipar renda.',
    false,
    true,
  );
});
