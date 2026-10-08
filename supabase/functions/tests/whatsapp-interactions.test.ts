import { strict as assert } from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { handleWhatsAppAction } from '../_shared/whatsapp-interactions.ts';
import { sendText, hashToken, retryWhatsAppReply, prepareWhatsAppReply } from '../_shared/whatsapp.ts';
import { handleWhatsAppNavigation } from '../_shared/whatsapp-navigation.ts';
import { rootChoices, nextStepText } from '../../../shared/whatsapp-navigation.ts';
import { createGuide, guideQuestion } from '../../../shared/whatsapp-guide.ts';
import { proposalButtons } from '../../../shared/whatsapp-presentation.ts';
import {
  executeChatTool,
  chatWithWhatsApp,
  chatToolDefinitions,
} from '../_shared/whatsapp-chat.ts';
import { chatInstructions } from '../../../shared/whatsapp-chat.ts';
import {
  whatsappMoneySnapshot,
  whatsappMoneyReply,
  replyWithMoneySnapshot,
  whatsappBudgetOverages,
  budgetUntilDate,
  compareReportedMoney,
} from '../_shared/whatsapp-money.ts';

const proposal = '12345678-1234-4234-8234-123456789abc';
const context = {
  userId: 'user-1',
  phone: '5511999999999',
  messageId: 'click-1',
  today: '2026-10-07',
  onCommit: () => {},
};

async function mocked(
  run: (requests: { url: URL; body: Record<string, unknown> }[]) => Promise<void>,
  respond: (url: URL, body: Record<string, unknown>) => unknown,
) {
  const original = globalThis.fetch;
  const values = {
    SUPABASE_URL: 'https://buttons.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only',
    WHATSAPP_GRAPH_VERSION: 'v25.0',
    WHATSAPP_ACCESS_TOKEN: 'test-only',
    WHATSAPP_PHONE_NUMBER_ID: '12345',
    OPENAI_API_KEY: 'test-only',
    OPENAI_CHAT_MODEL: 'test-model',
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, Deno.env.get(key)]));
  const requests: { url: URL; body: Record<string, unknown> }[] = [];
  try {
    for (const [key, value] of Object.entries(values)) Deno.env.set(key, value);
    globalThis.fetch = (input, init) => {
      const url = new URL(String(input));
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      requests.push({ url, body });
      return Promise.resolve(
        new Response(JSON.stringify(respond(url, body)), { headers: { 'Content-Type': 'application/json' } }),
      );
    };
    await run(requests);
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test('menu é nativo e não chama IA; texto livre continua disponível', async () => {
  await mocked(
    async (requests) => {
      const result = await handleWhatsAppNavigation({ text: 'menu' }, context);
      assert.equal(result?.buttons?.length, 10);
      await sendText(context.phone, result!.reply!, result!.buttons);
      const sent = requests.find((request) => request.url.hostname === 'graph.facebook.com')!;
      assert.equal((sent.body.interactive as { type: string }).type, 'list');
      assert.equal(await handleWhatsAppNavigation({ text: 'Paguei 50 reais no mercado' }, context), null);
      assert.ok(!requests.some((request) => request.url.hostname === 'api.openai.com'));
    },
    (url) => (url.hostname === 'graph.facebook.com' ? { messages: [{ id: 'menu-sent' }] } : null),
  );
});

Deno.test('gasto relatado como ocorrido é pago por padrão sem perguntar situação', () => {
  assert.match(chatInstructions, /gastei.*registre como pago sem perguntar/i);
  assert.match(chatInstructions, /nunca pergunte "já pagou\?"/i);
});

Deno.test('resumo mensal do menu consulta os dois lados e envia imagem sem chamar IA', async () => {
  const rows = [
    {
      id: proposal,
      description: 'Salário',
      amount: 20000,
      type: 'income',
      category: 'Salário',
      date: context.today,
      status: 'paid',
      source: 'manual',
      account_id: null,
    },
    {
      id: '12345678-1234-4234-8234-123456789ab1',
      description: 'Farmácia',
      amount: 10000,
      type: 'expense',
      category: 'Saúde',
      date: context.today,
      status: 'paid',
      source: 'manual',
      account_id: null,
    },
    {
      id: '12345678-1234-4234-8234-123456789ab2',
      description: 'Aluguel futuro',
      amount: 50000,
      type: 'expense',
      category: 'Moradia',
      date: '2026-10-20',
      status: 'planned',
      source: 'manual',
      account_id: null,
    },
  ];
  let image: Uint8Array | undefined;
  await mocked(
    async (requests) => {
      const navigation = await handleWhatsAppNavigation({ id: 'nexo:nav:summary' }, context);
      assert.ok(navigation?.text);
      const reply = await chatWithWhatsApp(navigation.text, {
        ...context,
        onImage: (value) => {
          image = value;
        },
      });
      assert.match(reply, /Resumo do mês/);
      assert.match(reply, /entraram R\$\s*200,00, saíram R\$\s*100,00/);
      assert.ok(image);
      assert.deepEqual([...image!.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(requests.some((request) => request.url.hostname === 'api.openai.com'), false);
    },
    (url) => {
      if (url.pathname.endsWith('transactions')) return rows;
      if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
      return [];
    },
  );
});

Deno.test('tocar em anotar gasto não envia instrução nem cria sessão de formulário', async () => {
  await mocked(
    async (requests) => {
      const prompt = await handleWhatsAppNavigation({ id: 'nexo:nav:expense' }, context);
      assert.equal(prompt?.silent, true);
      assert.equal(prompt?.reply, undefined);
      assert.equal(requests.filter((request) => request.url.pathname.endsWith('whatsapp_chat_sessions')).length, 0);
      assert.equal(requests.filter((request) => request.url.pathname.endsWith('advance_whatsapp_guide')).length, 0);
      assert.equal(await handleWhatsAppNavigation({ text: 'Gastei 25 reais na farmácia hoje' }, context), null);
      assert.equal(requests.filter((request) => request.url.pathname.endsWith('advance_whatsapp_guide')).length, 0);
    },
    () => null,
  );
});

Deno.test('entrada, meta e conta fixa também começam com uma frase', async () => {
  const options = [
    ['nexo:nav:income', /Recebi 2\.000 reais de salário hoje/],
    ['nexo:nav:goal', /Quero juntar 5 mil reais para uma viagem/],
    ['nexo:nav:recurring', /120 reais por mês/],
  ] as const;
  await mocked(
    async (requests) => {
      for (const [id, example] of options) {
        const result = await handleWhatsAppNavigation({ id }, context);
        assert.match(result!.reply!, example);
      }
      assert.equal(requests.filter((request) => request.url.pathname.endsWith('advance_whatsapp_guide')).length, 0);
    },
    () => null,
  );
});

Deno.test('frases completas retomam o chat e encerram sessões guiadas antigas', async () => {
  const cases = [
    { kind: 'expense' as const, text: 'Gastei 25 reais na farmácia hoje' },
    { kind: 'income' as const, text: 'Recebi 2.000 reais de salário hoje' },
    { kind: 'goal' as const, text: 'Quero juntar 5 mil reais para uma viagem' },
    { kind: 'recurring' as const, text: 'A internet custa 120 reais por mês' },
  ];
  let state = createGuide(cases[0].kind, context.today);
  await mocked(
    async (requests) => {
      for (const item of cases) {
        state = createGuide(item.kind, context.today);
        const before = requests.length;
        const result = await handleWhatsAppNavigation({ text: item.text }, context);
        assert.equal(result, null, `${item.kind} deve retomar o chat`);
        assert.equal(requests.slice(before).filter((request) => request.url.pathname.endsWith('whatsapp_guided_sessions')).length, 2);
      }
      assert.equal(requests.filter((request) => request.url.pathname.endsWith('advance_whatsapp_guide')).length, 0);
    },
    (url) => (url.pathname.endsWith('whatsapp_guided_sessions') ? { state } : null),
  );
});

Deno.test('botão antigo não avança nem grava; o atual usa versão e proprietário', async () => {
  const state = {
    ...createGuide('expense', context.today),
    step: 4,
    version: 4,
    answers: { description: 'Farmácia', amount: 3590, date: context.today, category: 'Saúde' },
  };
  await mocked(
    async (requests) => {
      const stale = await handleWhatsAppNavigation({ id: `nexo:guide:${state.id}:3:0` }, context);
      assert.match(stale!.reply!, /anterior/);
      assert.ok(!requests.some((request) => request.url.pathname.includes('/rpc/')));
      const result = await handleWhatsAppNavigation({ id: guideQuestion(state).buttons[0].id }, context);
      assert.ok(result!.reply!.includes(nextStepText));
      const write = requests.find((request) => request.url.pathname.endsWith('advance_whatsapp_guide'))!.body;
      assert.equal(write.owner, context.userId);
      assert.equal(write.expected_version, 4);
      assert.equal(write.next_state, null);
      assert.equal((write.changes as { payload: { amount: number } }[])[0].payload.amount, 3590);
      assert.ok(!requests.some((request) => request.url.hostname === 'api.openai.com'));
    },
    (url, body) =>
      url.pathname.endsWith('whatsapp_guided_sessions')
        ? { state }
        : { status: 'applied', reply: body.response_text },
  );
});

Deno.test('pergunta do menu guarda contexto para uma resposta curta', async () => {
  await mocked(
    async (requests) => {
      const result = await handleWhatsAppNavigation({ id: 'nexo:nav:saving-help' }, context);
      assert.match(result!.reply!, /qual meta/);
      const saved = requests.find((request) => Array.isArray(request.body.history))!;
      assert.equal(saved.body.user_id, context.userId);
      assert.match(JSON.stringify(saved.body.history), /Anotar valor guardado/);
    },
    () => null,
  );
});

Deno.test('correção lista registros do dono e permite descrições iguais com datas distintas', async () => {
  await mocked(
    async (requests) => {
      const result = await handleWhatsAppNavigation({ id: 'nexo:nav:edit-help' }, context);
      assert.equal(result!.buttons!.length, 3);
      await sendText(context.phone, result!.reply!, result!.buttons);
      const read = requests.find((request) => request.url.pathname.endsWith('transactions'))!;
      assert.equal(read.url.searchParams.get('user_id'), `eq.${context.userId}`);
      const sent = requests.find((request) => request.url.hostname === 'graph.facebook.com')!;
      assert.equal((sent.body.interactive as { type: string }).type, 'list');
    },
    (url) => {
      if (url.pathname.endsWith('transactions'))
        return [
          {
            id: proposal,
            description: 'Mercado da vizinhança',
            amount: 2500,
            date: '2026-10-07',
            status: 'paid',
          },
          {
            id: '12345678-1234-4234-8234-123456789ab1',
            description: 'Mercado da vizinhança',
            amount: 2500,
            date: '2026-10-08',
            status: 'paid',
          },
        ];
      return url.hostname === 'graph.facebook.com' ? { messages: [{ id: 'records-sent' }] } : null;
    },
  );
});

Deno.test('resposta longa guarda todo o conteúdo e menu antes de enviar', async () => {
  await mocked(
    async (requests) => {
      const text = 'Registro de exemplo. '.repeat(130) + nextStepText;
      const prepared = await prepareWhatsAppReply('long-answer', context.userId, text, rootChoices);
      assert.ok(prepared.followup_key);
      const tails = requests
        .map((request) => request.body)
        .sort((a, b) => String(a.message_id).localeCompare(String(b.message_id)));
      const joined = [prepared.reply, ...tails.map((tail) => tail.reply)].join(' ');
      assert.equal(joined.replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
      assert.equal((tails.at(-1)!.reply_buttons as unknown[]).length, 10);
      assert.ok(requests.every((request) => request.url.hostname !== 'graph.facebook.com'));
    },
    () => null,
  );
});

Deno.test('retry de resposta já enviada entrega só o menu pendente, sem repetir ação', async () => {
  await mocked(
    async (requests) => {
      await retryWhatsAppReply('sent-parent', context.phone);
      const deliveries = requests.filter((request) => request.url.hostname === 'graph.facebook.com');
      assert.equal(deliveries.length, 1);
      assert.equal((deliveries[0].body.interactive as { type: string }).type, 'list');
      assert.ok(!requests.some((request) => /save_whatsapp|advance_whatsapp/.test(request.url.pathname)));
    },
    (url) => {
      if (url.pathname.endsWith('whatsapp_connections')) return { consent_at: '2026-10-08' };
      if (url.pathname.endsWith('claim_whatsapp_reply')) return true;
      if (url.hostname === 'graph.facebook.com') return { messages: [{ id: 'tail-sent' }] };
      return url.searchParams.get('message_id') === 'eq.sent-parent'
        ? {
            state: 'complete',
            user_id: context.userId,
            reply: 'Concluído',
            sent_at: '2026-10-08',
            delivery_status: 'accepted',
            followup_key: 'pending-menu',
          }
        : { state: 'complete', user_id: context.userId, reply: nextStepText, reply_buttons: rootChoices };
    },
  );
});

Deno.test('entrega ambígua não dispara menu nem repete mensagem', async () => {
  await mocked(
    async (requests) => {
      assert.equal(await retryWhatsAppReply('uncertain', context.phone), false);
      assert.equal(requests.length, 1);
    },
    () => ({
      state: 'complete',
      reply: 'Resultado',
      delivery_status: 'reconcile',
      followup_key: 'pending-menu',
    }),
  );
});

Deno.test(
  'excluir pela lista respeita a versão exibida e um clique repetido não exclui novamente',
  async () => {
    let row: Record<string, unknown> | null = {
      id: proposal,
      user_id: context.userId,
      description: 'Farmácia',
      amount: 3590,
      date: context.today,
      status: 'paid',
      category: 'Saúde',
      type: 'expense',
      account_id: null,
    };
    await mocked(
      async (requests) => {
        const list = await handleWhatsAppNavigation({ id: 'nexo:nav:delete-help' }, context);
        const button = list!.buttons![0].id;
        row!.amount = 5000;
        assert.match((await handleWhatsAppNavigation({ id: button }, context))!.reply!, /registro mudou/);
        assert.ok(!requests.some((request) => request.url.pathname.includes('/rpc/')));
        row!.amount = 3590;
        const result = await handleWhatsAppNavigation({ id: button }, context);
        assert.match(result!.reply!, /Registro excluído/);
        row = null;
        assert.match(
          (await handleWhatsAppNavigation({ id: button }, context))!.reply!,
          /não está mais disponível/,
        );
        const writes = requests.filter((request) => request.url.pathname.endsWith('save_whatsapp_batch'));
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.owner, context.userId);
        assert.equal((writes[0].body.changes as { expected: { amount: number } }[])[0].expected.amount, 3590);
      },
      (url) => {
        if (url.pathname.endsWith('transactions')) return url.searchParams.has('id') ? row : [row];
        if (url.pathname.endsWith('save_whatsapp_batch')) return { status: 'applied', saved: 1 };
        return null;
      },
    );
  },
);

Deno.test('imagem guarda legenda curta e texto completo seguido do menu', async () => {
  await mocked(
    async (requests) => {
      const text = 'Detalhes do gráfico e próximos passos.';
      const prepared = await prepareWhatsAppReply('image-answer', context.userId, text, rootChoices, true);
      assert.ok(prepared.reply.length < 1024);
      assert.ok(prepared.followup_key);
      assert.equal(requests[0].body.reply, text);
      assert.equal((requests[0].body.reply_buttons as unknown[]).length, 10);
    },
    () => null,
  );
});

Deno.test('recibo salvo antes de falha da IA recupera menu sem repetir gravação', async () => {
  await mocked(
    async (requests) => {
      await retryWhatsAppReply('committed-before-failure', context.phone);
      const delivered = requests.find((request) => request.url.hostname === 'graph.facebook.com')!;
      assert.equal((delivered.body.interactive as { type: string }).type, 'list');
      assert.ok(!requests.some((request) => request.url.pathname.endsWith('save_whatsapp_batch')));
    },
    (url) => {
      if (url.pathname.endsWith('whatsapp_connections')) return { consent_at: '2026-10-08' };
      if (url.pathname.endsWith('claim_whatsapp_reply')) return true;
      if (url.hostname === 'graph.facebook.com') return { messages: [{ id: 'recovered' }] };
      return { user_id: context.userId, state: 'complete', reply: 'Uma alteração concluída.' };
    },
  );
});

Deno.test('resumo do app existe sem conta cadastrada e gasto reduz sobra de 69,33 para 64,08', async () => {
  const row = {
    id: proposal,
    description: 'Recebimento',
    amount: 731300,
    type: 'income',
    category: 'Outros',
    date: '2026-10-07',
    status: 'paid',
    source: 'whatsapp',
    account_id: null,
  };
  const rows = [
    row,
    {
      ...row,
      id: '12345678-1234-4234-8234-123456789ab1',
      description: 'Gastos anteriores',
      type: 'expense',
      amount: 724367,
    },
    {
      ...row,
      id: '12345678-1234-4234-8234-123456789ab2',
      description: 'Ajuste autorizado',
      type: 'expense',
      amount: 525,
    },
    {
      ...row,
      id: '12345678-1234-4234-8234-123456789ab3',
      description: 'Pagamento previsto',
      type: 'expense',
      amount: 50140,
      date: '2026-11-07',
      status: 'planned',
    },
  ];
  await mocked(
    async (requests) => {
      const summary = await whatsappMoneySnapshot(context.userId, context.today);
      assert.equal(summary.recorded_surplus, 6408);
      assert.equal(summary.free_to_plan, 6408);
      assert.match(whatsappMoneyReply(summary), /Sobrou nos movimentos deste mês: R\$\s64,08/);
      assert.equal(summary.bank_balance_confirmed, false);
      assert.equal(compareReportedMoney(summary, 6933).difference_from_recorded_surplus, -525);
      assert.ok(!requests.some((request) => request.url.pathname.endsWith('financial_accounts')));
      assert.ok(
        requests.every(
          (request) =>
            request.url.searchParams.get(request.url.pathname.endsWith('profiles') ? 'id' : 'user_id') ===
            'eq.user-1',
        ),
      );
    },
    (url) => {
      if (url.pathname.endsWith('transactions')) return rows;
      if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
      return [];
    },
  );
});

Deno.test('resumo distingue sobra dos movimentos de dinheiro protegido em metas', async () => {
  await mocked(
    async () => {
      const summary = await whatsappMoneySnapshot(context.userId, context.today);
      assert.equal(summary.recorded_surplus, 6408);
      assert.equal(summary.protected_goals, 1000);
      assert.equal(summary.free_to_plan, 5408);
      assert.match(whatsappMoneyReply(summary), /Livre para planejar: R\$\s54,08/);
    },
    (url) => {
      if (url.pathname.endsWith('transactions'))
        return [
          {
            id: proposal,
            description: 'Recebimento',
            amount: 6408,
            type: 'income',
            category: 'Outros',
            date: '2026-10-07',
            status: 'paid',
            source: 'whatsapp',
            account_id: null,
          },
        ];
      if (url.pathname.endsWith('goals'))
        return [
          {
            id: proposal,
            name: 'Reserva',
            target: 50000,
            saved: 1000,
            deadline: '2026-12-31',
            priority: 'high',
            monthly_contribution: 0,
            weekly_amount: 0,
            high_water: 1000,
          },
        ];
      if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
      return [];
    },
  );
});

Deno.test('gasto salvo avisa automaticamente quando ultrapassa o limite da categoria', async () => {
  let saved = false;
  let modelCalls = 0;
  let committed = false;
  const initial = {
    id: proposal,
    description: 'Sobra inicial',
    amount: 20000,
    type: 'income',
    category: 'Outros',
    date: '2026-10-07',
    status: 'paid',
    source: 'whatsapp',
    account_id: null,
  };
  const expense = {
    description: 'Remédio',
    amount: 10000,
    type: 'expense',
    category: 'Saúde',
    date: '2026-10-07',
    status: 'paid',
    account_id: null,
  };
  await mocked(
    async (requests) => {
      const reply = await chatWithWhatsApp('Gastei 100 reais no remédio hoje', {
        ...context,
        onCommit: () => {
          committed = true;
        },
      });
      assert.ok(committed);
      assert.match(reply, /Gasto registrado/);
      assert.match(reply, /limite de Saúde: era R\$\s*10,00/i);
      assert.match(reply, /anotou R\$\s*100,00 neste mês e passou R\$\s*90,00/i);
      const delivered = await replyWithMoneySnapshot(reply, context.userId, context.today);
      assert.match(delivered, /Sobrou nos movimentos deste mês: R\$\s100,00/);
      assert.match(delivered, /Gasto registrado/);
      assert.equal(
        requests.filter((request) => request.url.pathname.endsWith('save_whatsapp_batch')).length,
        1,
      );
    },
    (url, body) => {
      if (url.hostname === 'api.openai.com') {
        if (++modelCalls === 1) {
          assert.ok(String(body.instructions).includes('"recorded_surplus":20000'));
          return {
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'expense',
                name: 'save_records',
                arguments: JSON.stringify({
                  changes: [{ entity: 'transactions', values: JSON.stringify(expense) }],
                }),
              },
            ],
          };
        }
        const result = (body.input as { type: string; output: string }[]).find(
          (item) => item.type === 'function_call_output',
        )!;
        assert.equal(JSON.parse(result.output).money_snapshot_after_save.recorded_surplus, 10000);
        assert.deepEqual(JSON.parse(result.output).budget_overages_after_save, [
          { category: 'Saúde', limit: 1000, spent: 10000, overage: 9000 },
        ]);
        return {
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'Gasto registrado.' }] }],
        };
      }
      if (url.pathname.endsWith('save_whatsapp_batch')) {
        saved = true;
        return { status: 'applied', saved: 1, already_exists: 0 };
      }
      if (url.pathname.endsWith('transactions'))
        return saved
          ? [initial, { ...expense, id: '12345678-1234-4234-8234-123456789ab1', source: 'whatsapp' }]
          : [initial];
      if (url.pathname.endsWith('budgets'))
        return [{ id: '12345678-1234-4234-8234-123456789ab2', category: 'Saúde', limit_amount: 1000, month: '2026-10' }];
      if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
      if (url.pathname.endsWith('whatsapp_chat_sessions')) return body.history ? {} : null;
      return [];
    },
  );
});

Deno.test('plano até dia 19 usa dinheiro declarado, dias inclusivos e contas pendentes', () => {
  const input = {
    cash: 6408,
    today: '2026-10-07',
    until: '2026-10-19',
    emergency_reserve: 0,
    essentials_covered: true,
  };
  assert.deepEqual(budgetUntilDate(input, []).days_including_today, 13);
  assert.equal(budgetUntilDate(input, []).daily_ceiling, 492);
  assert.equal(budgetUntilDate(input, []).essentials_covered, true);
  const bill = {
    id: proposal,
    description: 'Conta',
    amount: 2000,
    type: 'expense' as const,
    category: 'Outros',
    date: '2026-10-19',
    status: 'planned' as const,
    source: 'manual' as const,
    account_id: null,
  };
  const plan = budgetUntilDate(input, [bill, { ...bill, date: '2026-10-20' }]);
  assert.equal(plan.reserved_bills, 2000);
  assert.equal(plan.available, 4408);
  assert.equal(plan.daily_ceiling, 339);
  assert.equal(budgetUntilDate(input, [{ ...bill, amount: 10000 }]).shortfall, 3592);
  assert.throws(() => budgetUntilDate({ ...input, until: '2026-10-06' }, []));
});

Deno.test('falha ao consultar sobra não apaga confirmação nem inventa zero', async () => {
  await mocked(
    async () => {
      const reply = await replyWithMoneySnapshot('Registro salvo.', context.userId, context.today);
      assert.match(reply, /Registro salvo/);
      assert.match(reply, /não consegui consultar quanto sobrou/);
      assert.ok(!reply.includes('R$'));
    },
    (url) => (url.pathname.endsWith('profiles') ? null : []),
  );
});

Deno.test('guardei 10 aumenta a meta e deixa 54,08 livres sem registrar despesa', async () => {
  let saved = false,
    modelCalls = 0,
    committed = false;
  const goal = {
    id: proposal,
    name: 'Reserva',
    target: 50000,
    saved: 0,
    high_water: 0,
    monthly_contribution: 0,
    weekly_amount: 0,
    deadline: '2026-12-31',
    priority: 'high',
  };
  await mocked(
    async (requests) => {
      const reply = await chatWithWhatsApp('Guardei 10 reais', {
        ...context,
        onCommit: () => {
          committed = true;
        },
      });
      assert.ok(committed);
      assert.match(reply, /10,00 na meta/);
      const delivered = await replyWithMoneySnapshot(reply, context.userId, context.today);
      assert.match(delivered, /Sobrou nos movimentos deste mês: R\$\s64,08/);
      assert.match(delivered, /Livre para planejar: R\$\s54,08/);
      const writes = requests.filter((request) => request.url.pathname.includes('/rpc/'));
      assert.equal(writes.length, 1);
      assert.ok(writes[0].url.pathname.endsWith('save_whatsapp_goal_progress'));
      assert.equal(writes[0].body.amount_delta, 1000);
      assert.equal(writes[0].body.selected_goal, null);
      assert.equal(writes[0].body.event_reason, 'saving');
    },
    (url, body) => {
      if (url.hostname === 'api.openai.com') {
        if (++modelCalls === 1)
          return {
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'saving',
                name: 'goal_progress',
                arguments: '{"goal_id":null,"amount":1000,"reason":"saving"}',
              },
            ],
          };
        const output = (body.input as { type: string; output: string }[]).find(
          (item) => item.type === 'function_call_output',
        )!;
        const result = JSON.parse(output.output);
        assert.equal(result.goal_saved, 1000);
        assert.equal(result.money_snapshot_after_save.free_to_plan, 5408);
        return {
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Registrei R$ 10,00 na meta Reserva. Total guardado: R$ 10,00.',
                },
              ],
            },
          ],
        };
      }
      if (url.pathname.endsWith('save_whatsapp_goal_progress')) {
        saved = true;
        return {
          status: 'applied',
          kind: 'goal_progress',
          goal_id: proposal,
          goal_name: 'Reserva',
          goal_saved: 1000,
          no_transaction_created: true,
        };
      }
      if (url.pathname.endsWith('transactions'))
        return [
          {
            id: proposal,
            description: 'Recebimento',
            amount: 6408,
            type: 'income',
            category: 'Outros',
            date: '2026-10-07',
            status: 'paid',
            source: 'manual',
            account_id: null,
          },
        ];
      if (url.pathname.endsWith('goals'))
        return [{ ...goal, saved: saved ? 1000 : 0, high_water: saved ? 1000 : 0 }];
      if (url.pathname.endsWith('goal_events'))
        return saved
          ? [
              {
                id: proposal,
                goal_id: proposal,
                delta: 1000,
                reason: 'saving',
                balance_after: 1000,
                created_at: '2026-10-07T12:00:00Z',
              },
            ]
          : [];
      if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
      if (url.pathname.endsWith('whatsapp_chat_sessions')) return body.history ? {} : null;
      return [];
    },
  );
});

Deno.test('aporte com meta ambígua não declara gravação e valida valores antes do banco', async () => {
  let committed = false;
  await mocked(
    async (requests) => {
      await assert.rejects(() =>
        executeChatTool('goal_progress', { goal_id: null, amount: 0, reason: 'saving' }, context),
      );
      assert.equal(requests.length, 0);
      const result = (await executeChatTool(
        'goal_progress',
        { goal_id: null, amount: 1000, reason: 'saving' },
        {
          ...context,
          onCommit: () => {
            committed = true;
          },
        },
      )) as { status: string };
      assert.equal(result.status, 'needs_goal');
      assert.equal(committed, false);
    },
    () => ({ status: 'needs_goal', message: 'Qual meta?' }),
  );
});

Deno.test('conciliação identifica a recorrência e não grava outro gasto', async () => {
  const paid = '12345678-1234-4234-8234-123456789ab1';
  const due = '2026-10-20';
  let committed = false;
  await mocked(
    async (requests) => {
      const records = (await executeChatTool(
        'read_records',
        { entity: 'transactions', start: null, end: null, search: 'DAS' },
        context,
      )) as { records: { recurring_rule_id: string; recurring_due_date: string }[] };
      assert.equal(records.records[0].recurring_rule_id, proposal);
      assert.equal(records.records[0].recurring_due_date, due);
      const result = (await executeChatTool(
        'reconcile_recurring_payment',
        { rule_id: proposal, due_date: due, paid_id: paid },
        {
          ...context,
          onCommit: () => {
            committed = true;
          },
        },
      )) as { no_new_expense: boolean };
      assert.ok(committed);
      assert.equal(result.no_new_expense, true);
      const writes = requests.filter((request) => request.url.pathname.includes('/rpc/'));
      assert.equal(writes.length, 1);
      assert.ok(writes[0].url.pathname.endsWith('reconcile_recurring_payment_for'));
      assert.equal(writes[0].body.owner, 'user-1');
    },
    (url) =>
      url.pathname.endsWith('transactions')
        ? [
            {
              id: paid,
              description: 'DAS',
              amount: 8605,
              type: 'expense',
              category: 'Serviços',
              date: due,
              status: 'planned',
              source: 'manual',
              account_id: null,
              external_id: `recurring:${proposal}:${due}`,
            },
          ]
        : { status: 'applied', paid_id: paid, no_transaction_created: true },
  );
});

Deno.test('botão confirma apenas proposta vigente da pessoa e não chama IA', async () => {
  let committed = false;
  await mocked(
    async (requests) => {
      const result = await handleWhatsAppAction(`nexo:confirm:${proposal}`, {
        ...context,
        onCommit: () => {
          committed = true;
        },
      });
      assert.match(result.reply!, /salva/);
      assert.ok(committed);
      assert.equal(requests.length, 2);
      assert.equal(requests[0].url.searchParams.get('user_id'), 'eq.user-1');
      assert.equal(requests[0].url.searchParams.get('state'), 'eq.pending');
      assert.ok(requests[0].url.searchParams.get('expires_at')?.startsWith('gt.'));
      assert.equal(requests[1].body.proposal, proposal);
      assert.equal(requests[1].body.message_key, 'click-1');
    },
    (url) => (url.pathname.includes('/rpc/') ? { status: 'applied' } : { id: proposal }),
  );
});

Deno.test('lote valida todos os itens antes de gravar e evita proposta por lançamento', async () => {
  const income = {
    description: 'Salário',
    amount: 700000,
    type: 'income',
    category: 'Salário',
    date: '2026-10-07',
    status: 'paid',
    account_id: null,
  };
  await mocked(
    async (requests) => {
      await assert.rejects(() =>
        executeChatTool(
          'save_records',
          {
            changes: [
              { entity: 'transactions', values: JSON.stringify(income) },
              { entity: 'transactions', values: JSON.stringify({ ...income, amount: -1 }) },
            ],
          },
          context,
        ),
      );
      assert.equal(requests.length, 0);
      const proposal = (await executeChatTool(
        'prepare_change',
        { entity: 'transactions', action: 'create', id: null, values: JSON.stringify(income) },
        context,
      )) as { error: string };
      assert.match(proposal.error, /save_records/);
      assert.equal(requests.length, 0);
    },
    () => null,
  );
});

Deno.test('modo app salva movimentos como manuais pelo RPC autenticado', async () => {
  const appSaveTool = chatToolDefinitions(true).find((tool) => tool.name === 'save_records');
  const whatsappSaveTool = chatToolDefinitions(false).find((tool) => tool.name === 'save_records');
  assert.match(appSaveTool!.description, /source=manual/);
  assert.match(whatsappSaveTool!.description, /source=whatsapp/);
  const income = {
    description: 'Salário',
    amount: 700000,
    type: 'income',
    category: 'Salário',
    date: '2026-10-07',
    status: 'paid',
    account_id: null,
  };
  await mocked(
    async (requests) => {
      await executeChatTool(
        'save_records',
        { changes: [{ entity: 'transactions', values: JSON.stringify(income) }] },
        {
          ...context,
          db: createClient('https://buttons.test', 'user-scoped-test-key'),
          appMode: true,
          requestId: proposal,
        },
      );
      await executeChatTool(
        'save_records',
        { changes: [{ entity: 'transactions', values: JSON.stringify(income) }] },
        {
          ...context,
          db: createClient('https://buttons.test', 'user-scoped-test-key'),
          appMode: true,
          requestId: proposal,
        },
      );
      const write = requests.find((request) => request.url.pathname.endsWith('/rpc/save_ai_chat_batch'));
      assert.ok(write);
      const changes = write.body.changes as { payload: Record<string, unknown>; action: string }[];
      assert.equal(changes[0].payload.source, 'manual');
      assert.equal(changes[0].action, 'create');
      assert.match(write.body.request as string, /^[0-9a-f-]{36}$/);
      assert.equal(requests[1].body.request, write.body.request);
    },
    (url) => (url.pathname.endsWith('/rpc/save_ai_chat_batch') ? { status: 'applied', saved: 1 } : null),
  );
});

Deno.test('edição direta consulta o registro e envia apenas os campos pedidos sem confirmação', async () => {
  const row = {
    id: proposal,
    description: 'Mercado',
    amount: 10000,
    type: 'expense',
    category: 'Alimentação',
    date: '2026-10-07',
    status: 'paid',
    source: 'whatsapp',
    account_id: null,
  };
  let committed = false;
  await mocked(
    async (requests) => {
      await executeChatTool(
        'apply_changes',
        { changes: [{ entity: 'transactions', action: 'update', id: proposal, values: '{"amount":12000}' }] },
        {
          ...context,
          onCommit: () => {
            committed = true;
          },
        },
      );
      assert.ok(committed);
      const read = requests.find((request) => request.url.pathname.endsWith('transactions'))!;
      const write = requests.find((request) => request.url.pathname.endsWith('save_whatsapp_batch'))!;
      assert.equal(read.url.searchParams.get('user_id'), 'eq.user-1');
      const changes = write.body.changes as { payload: unknown; expected: unknown; action: string }[];
      assert.deepEqual(changes[0].payload, { amount: 12000 });
      assert.deepEqual(changes[0].expected, row);
      assert.equal(changes[0].action, 'update');
    },
    (url) => (url.pathname.endsWith('transactions') ? row : { status: 'applied', saved: 1 }),
  );
});

Deno.test(
  'pedido múltiplo salva em uma chamada e continuar recebe estado real do clique anterior',
  async () => {
    const changes = [
      {
        entity: 'transactions',
        values: JSON.stringify({
          description: 'Fatura PJ',
          amount: 202403,
          type: 'expense',
          category: 'Outros',
          date: '2026-10-07',
          status: 'paid',
          account_id: null,
        }),
      },
      {
        entity: 'recurring_rules',
        values: JSON.stringify({
          description: 'Faculdade',
          amount: 50000,
          type: 'expense',
          category: 'Educação',
          start_date: '2026-11-20',
          frequency: 'monthly',
          active: true,
        }),
      },
    ];
    let calls = 0;
    let committed = false;
    await mocked(
      async (requests) => {
        const reply = await chatWithWhatsApp('Continue com os demais registros', {
          ...context,
          onCommit: () => {
            committed = true;
          },
        });
        assert.equal(reply, 'Pronto! Salvei a fatura e a faculdade recorrente. Confira no app.');
        assert.ok(committed);
        const writes = requests.filter((request) => request.url.pathname.endsWith('save_whatsapp_batch'));
        assert.equal(writes.length, 1);
        assert.equal((writes[0].body.changes as unknown[]).length, 2);
        assert.ok(!requests.some((request) => request.url.pathname.endsWith('confirm_whatsapp_chat')));
      },
      (url, body) => {
        if (url.hostname === 'api.openai.com') {
          assert.match(String(body.instructions), /applied/);
          assert.match(String(body.instructions), /Salário/);
          assert.match(String(body.instructions), /inclusive pelo botão/);
          if (++calls === 1)
            return {
              status: 'completed',
              output: [
                {
                  type: 'function_call',
                  call_id: 'save-all',
                  name: 'save_records',
                  arguments: JSON.stringify({ changes }),
                },
              ],
            };
          return {
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'Pronto! Salvei a fatura e a faculdade recorrente. Confira no app.',
                  },
                ],
              },
            ],
          };
        }
        if (url.pathname.endsWith('whatsapp_chat_sessions'))
          return body.history
            ? {}
            : { history: [{ role: 'assistant', content: 'Salário ainda não salvo. Confirme.' }] };
        if (url.pathname.endsWith('whatsapp_chat_requests'))
          return [
            {
              state: 'applied',
              payload: { description: 'Salário', amount: 700000 },
              result: { status: 'applied' },
            },
          ];
        if (url.pathname.endsWith('save_whatsapp_batch'))
          return { status: 'applied', saved: 2, already_exists: 0 };
        if (url.pathname.endsWith('whatsapp_messages_metadata')) return [];
        if (['transactions', 'goals', 'goal_events'].some((entity) => url.pathname.endsWith(entity)))
          return [];
        if (url.pathname.endsWith('profiles')) return { fixed_expenses: 0, timezone: 'America/Sao_Paulo' };
        throw new Error(`Unexpected ${url.pathname}`);
      },
    );
  },
);

Deno.test('botão antigo ou de outro usuário não executa confirmação', async () => {
  await mocked(
    async (requests) => {
      const result = await handleWhatsAppAction(`nexo:confirm:${proposal}`, context);
      assert.match(result.reply!, /expirou/);
      assert.equal(requests.length, 1);
    },
    () => null,
  );
});

Deno.test('corrigir não salva e cancelar usa somente a proposta indicada', async () => {
  await mocked(
    async (requests) => {
      assert.match((await handleWhatsAppAction(`nexo:edit:${proposal}`, context)).reply!, /corrigir/);
      assert.equal(requests.length, 1);
      assert.match((await handleWhatsAppAction(`nexo:cancel:${proposal}`, context)).reply!, /cancelado/);
      assert.equal(requests[2].body.state, 'cancelled');
      assert.equal(requests[2].url.searchParams.get('id'), `eq.${proposal}`);
      assert.equal(requests[2].url.searchParams.get('user_id'), 'eq.user-1');
    },
    (_url, body) => (body.state ? [{ id: proposal }] : { id: proposal }),
  );
});

Deno.test('botão do recibo não confirma outro recibo mais recente', async () => {
  const token = await hashToken('receipt-old');
  await mocked(
    async (requests) => {
      assert.match((await handleWhatsAppAction(`nexo:receipt-confirm:${token}`, context)).reply!, /salvo/);
      assert.equal(requests[1].body.message_key, 'receipt-old');
    },
    (url) =>
      url.pathname.includes('/rpc/')
        ? ['saved-id']
        : [
            { message_id: 'receipt-new', pending_payload: [{ description: 'novo' }] },
            { message_id: 'receipt-old', pending_payload: [{ description: 'antigo' }] },
          ],
  );
});

Deno.test('envio usa payload nativo e normaliza o negrito', async () => {
  await mocked(
    async (requests) => {
      await sendText(context.phone, 'Seu nome é **Ruan**.', proposalButtons(proposal));
      assert.equal(requests[0].body.type, 'interactive');
      const interactive = requests[0].body.interactive as { body: { text: string } };
      assert.equal(interactive.body.text, 'Seu nome é *Ruan*.');
    },
    () => ({ messages: [{ id: 'sent-1' }] }),
  );
});

Deno.test('reenvio mantém os mesmos botões sem executar a proposta', async () => {
  await mocked(
    async (requests) => {
      await retryWhatsAppReply('original-message', context.phone);
      const sent = requests.find((request) => request.url.hostname === 'graph.facebook.com')!;
      assert.equal(sent.body.type, 'interactive');
      assert.ok(!requests.some((request) => request.url.pathname.includes('confirm_whatsapp_chat')));
    },
    (url) => {
      if (url.pathname.endsWith('/claim_whatsapp_reply')) return true;
      if (url.hostname === 'graph.facebook.com') return { messages: [{ id: 'sent-2' }] };
      return {
        state: 'complete',
        reply: 'Posso salvar?',
        reply_kind: 'text',
        reply_buttons: proposalButtons(proposal),
      };
    },
  );
});
