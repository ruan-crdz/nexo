import { strict as assert } from 'node:assert';
import { handleWhatsAppAction } from '../_shared/whatsapp-interactions.ts';
import { sendText, hashToken, retryWhatsAppReply } from '../_shared/whatsapp.ts';
import { proposalButtons } from '../../../shared/whatsapp-presentation.ts';
import { executeChatTool, chatWithWhatsApp } from '../_shared/whatsapp-chat.ts';
import {
  whatsappMoneySnapshot,
  whatsappMoneyReply,
  replyWithMoneySnapshot,
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

Deno.test('gasto salvo recebe sobra atualizada mesmo se o modelo omitir o saldo', async () => {
  let saved = false;
  let modelCalls = 0;
  let committed = false;
  const initial = {
    id: proposal,
    description: 'Sobra inicial',
    amount: 6933,
    type: 'income',
    category: 'Outros',
    date: '2026-10-07',
    status: 'paid',
    source: 'whatsapp',
    account_id: null,
  };
  const expense = {
    description: 'Ajuste autorizado',
    amount: 525,
    type: 'expense',
    category: 'Outros',
    date: '2026-10-07',
    status: 'paid',
    account_id: null,
  };
  await mocked(
    async (requests) => {
      const reply = await chatWithWhatsApp('Gastei 5,25 no ajuste não identificado hoje', {
        ...context,
        onCommit: () => {
          committed = true;
        },
      });
      assert.ok(committed);
      assert.equal(reply, 'Gasto registrado.');
      const delivered = await replyWithMoneySnapshot(reply, context.userId, context.today);
      assert.match(delivered, /Sobrou nos movimentos deste mês: R\$\s64,08/);
      assert.match(delivered, /Gasto registrado/);
      assert.equal(
        requests.filter((request) => request.url.pathname.endsWith('save_whatsapp_batch')).length,
        1,
      );
    },
    (url, body) => {
      if (url.hostname === 'api.openai.com') {
        if (++modelCalls === 1) {
          assert.ok(String(body.instructions).includes('"recorded_surplus":6933'));
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
        assert.equal(JSON.parse(result.output).money_snapshot_after_save.recorded_surplus, 6408);
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
      assert.equal(requests.length, 2);
      assert.equal(requests[0].url.searchParams.get('user_id'), 'eq.user-1');
      assert.ok(requests[1].url.pathname.endsWith('save_whatsapp_batch'));
      const changes = requests[1].body.changes as { payload: unknown; expected: unknown; action: string }[];
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
