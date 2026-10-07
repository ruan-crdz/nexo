import { z } from 'zod';
import { goalSchema, recurringRuleSchema, transactionSchema } from '../../../shared/domain.ts';
import {
  isFinancialQuestion,
  isFinancialChartRequest,
  imageGenerationPrompt,
  isSpendabilityQuestion,
  answerFinancialQuestion,
} from '../../../shared/financial-questions.ts';
import {
  merchantKey,
  spendabilityAppAssumptions,
  spendingAllowance,
} from '../../../shared/financial-decisions.ts';
import { readPages } from '../../../shared/pagination.ts';
import { accountSchema } from '../../../shared/domain.ts';
import { recurringTransactions } from '../../../shared/planning.ts';
import { admin, env, HttpError, json } from '../_shared/http.ts';
import {
  downloadMedia,
  hashToken,
  deliverReply,
  deliverImageReply,
  showTypingIndicator,
  verifySignature,
} from '../_shared/whatsapp.ts';
import { parseLinkingCode, whatsappWelcome } from '../../../shared/whatsapp-link.ts';
import {
  parseSpendabilityMessage,
  parseTransaction,
  spendabilityContextSchema,
  generateWhatsAppImage,
  transcribe,
  readReceipt,
} from '../_shared/openai.ts';
import { civilDate, formatMoney, shiftDays, shiftMonths, sum } from '../../../shared/financial-engine.ts';
import { monthlyFlow } from '../../../shared/insights.ts';
import { financeChartPng } from '../_shared/finance-chart.ts';
import { isSummaryRequest, whatsappMonthSummary } from '../../../shared/whatsapp-summary.ts';

const messageSchema = z.object({
  id: z.string().min(1).max(300),
  from: z.string().regex(/^\d{8,15}$/),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.object({ body: z.string().max(4000) }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
  document: z
    .object({ id: z.string(), mime_type: z.string().optional(), filename: z.string().max(255).optional() })
    .optional(),
});
const webhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                metadata: z.object({ phone_number_id: z.string() }).optional(),
                messages: z.array(messageSchema).max(20).optional(),
                statuses: z
                  .array(
                    z.object({
                      id: z.string().max(300),
                      status: z.enum(['sent', 'delivered', 'read', 'failed']),
                      errors: z.array(z.object({ code: z.number().int() })).optional(),
                    }),
                  )
                  .max(100)
                  .optional(),
              }),
            }),
          )
          .max(20),
      }),
    )
    .max(20),
});
type Message = z.infer<typeof messageSchema>;
function whatsappDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
function spendabilityMissing(context: z.infer<typeof spendabilityContextSchema>) {
  const missing: string[] = [];
  if (context.purchase_amount === null) missing.push('o preço total da compra');
  if (context.cash === null) missing.push('quanto dinheiro está disponível hoje');
  if (context.next_income_date === null) missing.push('a data do próximo recebimento');
  if (context.estimated_income === null) missing.push('o valor esperado desse recebimento (ou R$ 0)');
  if (context.protected_reserve === null) missing.push('quanto quer manter como reserva (ou R$ 0)');
  if (context.goal_allocation === null) missing.push('quanto já separou para metas (ou R$ 0)');
  return missing;
}
function spendabilityPrompt(context: z.infer<typeof spendabilityContextSchema>) {
  const missing = spendabilityMissing(context);
  const purchase = context.purchase ? ` para ${context.purchase}` : ' para essa compra';
  const price = context.purchase_amount === null ? '' : ` de ${formatMoney(context.purchase_amount)}`;
  const known = [
    ...(context.purchase ? [`Produto: ${context.purchase}.`] : []),
    ...(context.purchase_amount !== null ? [`Preço total: ${formatMoney(context.purchase_amount)}.`] : []),
    ...(context.cash !== null ? [`Saldo disponível informado: ${formatMoney(context.cash)}.`] : []),
    ...(context.next_income_date
      ? [`Próximo recebimento no app: ${whatsappDate(context.next_income_date)}.`]
      : []),
    ...(context.estimated_income !== null
      ? [
          `${context.income_source === 'profile' ? 'Renda mensal do perfil' : 'Valor previsto'}: ${formatMoney(context.estimated_income)}${context.income_source === 'user' ? ' (informado por você)' : ''}.`,
        ]
      : []),
    ...(context.protected_reserve !== null
      ? [`Reserva informada: ${formatMoney(context.protected_reserve)}.`]
      : []),
    ...(context.goal_allocation !== null
      ? [
          `${context.goal_allocation_source === 'app' ? 'Já guardado nas metas do app' : 'Separado para metas'}: ${formatMoney(context.goal_allocation)}.`,
        ]
      : []),
  ];
  const available = known.length
    ? `Já encontrei no seu Nexo:\n${known.map((item) => `• ${item}`).join('\n')}\n\n`
    : '';
  return `Consigo avaliar${purchase}${price}. ${known.length ? 'Confira os dados que encontrei e me diga se algo mudou.' : ''}\n\nAinda preciso de:\n${missing.map((item) => `• ${item}`).join('\n')}\n\n${available}Pode responder em uma mensagem, por exemplo: “Disponível hoje R$ 12.000; reserva R$ 2.000.”`;
}
async function spendabilityAppContext(userId: string, today: string, monthlyIncome: number) {
  const db = admin();
  const [transactionRows, goalRows, recurringRows] = await Promise.all([
    readPages((from, to) =>
      db.from('transactions').select('*').eq('user_id', userId).order('id').range(from, to),
    ),
    readPages((from, to) => db.from('goals').select('*').eq('user_id', userId).order('id').range(from, to)),
    readPages((from, to) =>
      db.from('recurring_rules').select('*').eq('user_id', userId).order('id').range(from, to),
    ),
  ]);
  const transactions = transactionSchema.array().parse(transactionRows);
  const goals = goalSchema.array().parse(goalRows);
  const recurringRules = recurringRuleSchema.array().parse(recurringRows);
  const projected = recurringTransactions(recurringRules, transactions, today);
  return spendabilityContextSchema.parse({
    kind: 'spendability',
    purchase: null,
    purchase_amount: null,
    cash: null,
    protected_reserve: null,
    ...spendabilityAppAssumptions(goals, [...transactions, ...projected], monthlyIncome),
  });
}
async function processMessage(message: Message) {
  const db = admin();
  const claim = await db.rpc('claim_whatsapp', { message_key: message.id });
  if (claim.error) throw new HttpError(503, 'Não foi possível receber a mensagem.');
  if (!claim.data) {
    const previous = await db
      .from('whatsapp_messages_metadata')
      .select('state,reply,sent_at')
      .eq('message_id', message.id)
      .single();
    if (
      previous.data?.reply &&
      !previous.data.sent_at &&
      ['complete', 'pending'].includes(previous.data.state)
    ) {
      await deliverReply(message.id, message.from, previous.data.reply);
    }
    return;
  }
  let committed = false;
  let messagePoints = 0;
  let showPoints = false;
  async function finish(reply: string, userId?: string) {
    if (showPoints && messagePoints > 0)
      reply += `\n\n🌱 +${messagePoints} pontos de hábito (não são dinheiro nem crédito).`;
    const result = await db
      .from('whatsapp_messages_metadata')
      .update({ state: 'complete', reply, user_id: userId ?? null, updated_at: new Date().toISOString() })
      .eq('message_id', message.id);
    if (result.error) throw new Error('metadata');
    committed = true;
    await deliverReply(message.id, message.from, reply);
  }
  async function finishImage(
    image: Uint8Array,
    caption: string,
    userId: string,
    mimeType: 'image/png' | 'image/jpeg',
  ) {
    let reply = caption;
    if (showPoints && messagePoints > 0)
      reply += `\n\n🌱 +${messagePoints} pontos de hábito (não são dinheiro nem crédito).`;
    const stored = await db
      .from('whatsapp_messages_metadata')
      .update({ state: 'complete', reply, user_id: userId, updated_at: new Date().toISOString() })
      .eq('message_id', message.id);
    if (stored.error) throw new HttpError(503, 'Não foi possível registrar a resposta visual.');
    committed = true;
    await deliverImageReply(message.id, message.from, image, reply, mimeType);
  }
  async function findPendingSpendability(userId: string) {
    const pending = await db
      .from('whatsapp_messages_metadata')
      .select('message_id,pending_payload')
      .eq('user_id', userId)
      .eq('state', 'pending')
      .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    if (pending.error) throw new HttpError(503, 'Não foi possível retomar a conversa.');
    const match = pending.data.find(
      (item) => spendabilityContextSchema.safeParse(item.pending_payload).success,
    );
    if (!match) return null;
    const parsed = spendabilityContextSchema.safeParse(match.pending_payload);
    return parsed.success ? { messageId: match.message_id, context: parsed.data } : null;
  }
  async function closePendingSpendability(messageId: string) {
    const closed = await db
      .from('whatsapp_messages_metadata')
      .update({ state: 'complete', pending_payload: null, updated_at: new Date().toISOString() })
      .eq('message_id', messageId);
    if (closed.error) throw new HttpError(503, 'Não foi possível encerrar a avaliação pendente.');
  }
  async function holdSpendability(
    context: z.infer<typeof spendabilityContextSchema>,
    userId: string,
    previousMessageId?: string,
  ) {
    if (previousMessageId && previousMessageId !== message.id)
      await closePendingSpendability(previousMessageId);
    const reply = spendabilityPrompt(context);
    const stored = await db
      .from('whatsapp_messages_metadata')
      .update({
        user_id: userId,
        state: 'pending',
        pending_payload: context,
        reply,
        updated_at: new Date().toISOString(),
      })
      .eq('message_id', message.id);
    if (stored.error) throw new HttpError(503, 'Não foi possível guardar as premissas da conversa.');
    committed = true;
    await deliverReply(message.id, message.from, reply);
  }
  async function answerSpendability(
    context: z.infer<typeof spendabilityContextSchema>,
    userId: string,
    today: string,
    pendingMessageId?: string,
  ) {
    const rows = transactionSchema
      .array()
      .parse(
        await readPages((from, to) =>
          db.from('transactions').select('*').eq('user_id', userId).order('id').range(from, to),
        ),
      );
    let decision: ReturnType<typeof spendingAllowance>;
    try {
      decision = spendingAllowance(
        {
          cash: context.cash!,
          confirmed_on: today,
          next_income_date: context.next_income_date!,
          protected_amount: context.protected_reserve!,
          goal_amount: context.goal_allocation!,
          estimated_income: context.estimated_income!,
        },
        rows,
        today,
      );
    } catch {
      await finish(
        'Não consegui validar essa data de recebimento. Envie uma data futura, dentro dos próximos 12 meses.',
        userId,
      );
      return;
    }
    if (pendingMessageId) await closePendingSpendability(pendingMessageId);
    if (decision.needs_confirmation) {
      await finish(
        'Encontrei gastos sem conta vinculada e não consigo confirmar se o saldo informado está atualizado. Confira seus registros no app antes de decidir.',
        userId,
      );
      return;
    }
    const remaining = decision.allowed - context.purchase_amount!;
    const incomeSource =
      context.income_source === 'planned'
        ? 'renda de um recebimento planejado no app'
        : context.income_source === 'profile'
          ? 'renda mensal cadastrada no seu perfil'
          : 'renda esperada que você informou';
    const goalSource =
      context.goal_allocation_source === 'app'
        ? `${formatMoney(context.goal_allocation!)} já guardados nas metas do app`
        : `${formatMoney(context.goal_allocation!)} separados para metas, como você informou`;
    const lines = [
      remaining >= 0
        ? `Pelas premissas que você informou, a compra de ${formatMoney(context.purchase_amount!)} cabe. Depois dela, restariam ${formatMoney(remaining)} até o próximo recebimento.`
        : `Com essas premissas, a compra não cabe sem mexer no dinheiro protegido. Faltariam ${formatMoney(Math.abs(remaining))} para cobrir o valor.`,
      `Considerei ${formatMoney(context.cash!)} disponíveis hoje, ${formatMoney(context.protected_reserve!)} de reserva, ${goalSource} e as contas até ${whatsappDate(context.next_income_date!)}.`,
      `Também encontrei ${formatMoney(context.estimated_income!)} em ${incomeSource}; esse valor não foi somado como dinheiro já recebido.`,
      'É uma estimativa baseada nos valores que você informou; gastos não anotados podem mudar o resultado.',
    ];
    if (decision.bills.length)
      lines.push(
        '',
        'Contas consideradas:',
        ...decision.bills
          .slice(0, 5)
          .map((bill) => `• ${bill.description} · ${whatsappDate(bill.date)} · ${formatMoney(bill.amount)}`),
      );
    const chart = await financeChartPng({
      title: 'AVALIACAO DA COMPRA',
      subtitle: context.purchase ?? 'COMPRA CONSULTADA',
      items: [
        { label: 'LIVRE APOS CONTAS', value: decision.allowed, tone: 'income' },
        { label: 'PRECO DA COMPRA', value: context.purchase_amount!, tone: 'expense' },
        {
          label: remaining >= 0 ? 'RESTANTE' : 'FALTA',
          value: Math.abs(remaining),
          tone: remaining >= 0 ? 'neutral' : 'warning',
        },
      ],
      footer: 'ESTIMATIVA COM AS PREMISSAS INFORMADAS',
    });
    await finishImage(chart, lines.join('\n'), userId, 'image/png');
  }
  try {
    let text = message.text?.body?.trim() ?? '';
    const linkingCode = parseLinkingCode(text);
    if (linkingCode) {
      const link = await db.rpc('link_whatsapp', {
        hash: await hashToken(linkingCode),
        sender: message.from,
      });
      if (link.error) throw new Error('link');
      await finish(
        link.data
          ? whatsappWelcome
          : 'Esse código de conexão já expirou ou foi usado. No app, abra Você → WhatsApp e gere um novo código.',
        link.data ?? undefined,
      );
      return;
    }
    const connection = await db
      .from('whatsapp_connections')
      .select('user_id,consent_at')
      .eq('phone', message.from)
      .maybeSingle();
    if (connection.error) throw new Error('connection');
    if (!connection.data?.consent_at) {
      await finish(
        'Para proteger seus dados, conecte sua conta antes de enviar informações financeiras. No app, abra Você → WhatsApp e toque em “Conectar meu WhatsApp”.',
      );
      return;
    }
    const userId = connection.data.user_id;
    const rate = await db.rpc('consume_rate_limit', {
      subject: userId,
      bucket_name: 'whatsapp',
      max_requests: 15,
    });
    if (rate.error || !rate.data) {
      await finish('Recebi várias mensagens seguidas. Aguarde um minuto e tente de novo.', userId);
      return;
    }
    await showTypingIndicator(message.id);
    const profile = await db
      .from('profiles')
      .select('timezone,show_journey_points,monthly_income')
      .eq('id', userId)
      .single();
    if (profile.error) throw new Error('profile');
    if (['text', 'audio', 'image', 'document'].includes(message.type)) {
      const award = await db.rpc('award_habit_for', {
        owner: userId,
        event_kind: 'message',
        event_key: `wa:${message.id}`,
      });
      if (award.error) throw new HttpError(503, 'Não foi possível registrar o hábito.');
      messagePoints = Number(award.data);
      showPoints = profile.data.show_journey_points;
    }
    if (message.type === 'audio' && message.audio)
      text = await transcribe(await downloadMedia(message.audio.id), userId);
    const receiptMedia =
      message.type === 'image' && message.image
        ? await downloadMedia(message.image.id)
        : message.type === 'document' && message.document
          ? await downloadMedia(message.document.id)
          : null;
    if (receiptMedia) {
      if (
        message.type === 'document' &&
        message.document?.mime_type?.split(';')[0] !== 'application/pdf' &&
        !message.document?.filename?.toLowerCase().endsWith('.pdf')
      ) {
        await finish(
          'Consigo ler recibos por foto ou PDF. Envie a imagem da nota ou um arquivo PDF.',
          userId,
        );
        return;
      }
      const receipt = await readReceipt(
        receiptMedia,
        profile.data.timezone,
        userId,
        new Date(Number(message.timestamp) * 1000),
      );
      const learned = await db.from('category_preferences').select('merchant,category').eq('user_id', userId);
      if (learned.error) throw new HttpError(503, 'Não foi possível conferir preferências.');
      for (const row of receipt.transactions) {
        const preference = learned.data.find((item) => item.merchant === merchantKey(row.description));
        if (preference) row.category = preference.category;
      }
      if (!receipt.transactions.length) {
        await finish(
          receipt.parsed.clarification ??
            'Não consegui identificar o valor e a data com segurança. Tente uma foto mais nítida ou me envie esses dados por texto.',
          userId,
        );
        return;
      }
      const reply = `Encontrei isto no recibo, mas ainda não salvei:\n${receipt.transactions.map((row) => `• ${row.description} · ${whatsappDate(row.date)} · ${formatMoney(row.amount)}`).join('\n')}\n\nSe estiver certo, envie “confirmar” em até 10 minutos. Vou deixar como pendente; marque como pago no app só depois de conferir. A foto não confirma o pagamento.`;
      const pending = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId, state: 'pending', pending_payload: receipt.transactions, reply })
        .eq('message_id', message.id);
      if (pending.error) throw new HttpError(503, 'Não foi possível preparar revisão.');
      committed = true;
      await deliverReply(message.id, message.from, reply);
      return;
    }
    if (!text) {
      await finish(
        message.type === 'image'
          ? 'Não consegui abrir essa foto. Tente outra mais nítida, mostre a nota inteira ou envie um PDF.'
          : message.type === 'document'
            ? 'Envie um PDF da nota ou uma foto mostrando o recibo inteiro.'
            : 'Pode me mandar uma mensagem de texto ou áudio. Para ler um recibo, envie uma foto ou PDF.',
        userId,
      );
      return;
    }
    if (/^(?:ajuda|menu|oi|ola|olá|tutorial)[!.\s]*$/i.test(text)) {
      await finish(whatsappWelcome, userId);
      return;
    }
    if (isSummaryRequest(text)) {
      const today = civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone);
      const rows = await readPages((from, to) =>
        db
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('date', `${today.slice(0, 7)}-01`)
          .lte('date', today)
          .order('id')
          .range(from, to),
      );
      const transactions = transactionSchema.array().parse(rows);
      const summary = whatsappMonthSummary(transactions, today);
      const flow = monthlyFlow(transactions, today.slice(0, 7));
      const month = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
      const chart = await financeChartPng({
        title: 'RESUMO DO MES',
        subtitle: month,
        items: [
          { label: 'ENTROU', value: flow.income, tone: 'income' },
          { label: 'SAIU', value: flow.expenses, tone: 'expense' },
          {
            label: flow.net < 0 ? 'FALTOU' : 'SOBROU',
            value: Math.abs(flow.net),
            tone: flow.net < 0 ? 'warning' : 'neutral',
          },
        ],
        footer: 'VALORES ANOTADOS - NAO E SALDO BANCARIO',
      });
      await finishImage(chart, summary, userId, 'image/png');
      return;
    }
    if (isFinancialQuestion(text)) {
      if (isSpendabilityQuestion(text)) {
        const pending = await findPendingSpendability(userId);
        const today = civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone);
        const [automatic, extracted] = await Promise.all([
          spendabilityAppContext(userId, today, profile.data.monthly_income),
          parseSpendabilityMessage(text, today, null, userId),
        ]);
        const context = spendabilityContextSchema.parse({
          ...extracted,
          next_income_date: extracted.next_income_date ?? automatic.next_income_date,
          estimated_income: extracted.estimated_income ?? automatic.estimated_income,
          income_source: extracted.estimated_income !== null ? 'user' : automatic.income_source,
          goal_allocation: extracted.goal_allocation ?? automatic.goal_allocation,
          goal_allocation_source:
            extracted.goal_allocation !== null ? 'user' : automatic.goal_allocation_source,
        });
        if (spendabilityMissing(context).length) await holdSpendability(context, userId, pending?.messageId);
        else await answerSpendability(context, userId, today, pending?.messageId);
        return;
      }
      const [rows, goals, accounts] = await Promise.all([
        readPages((from, to) =>
          db.from('transactions').select('*').eq('user_id', userId).order('id').range(from, to),
        ),
        readPages((from, to) =>
          db.from('goals').select('*').eq('user_id', userId).order('id').range(from, to),
        ),
        readPages((from, to) =>
          db.from('financial_accounts').select('*').eq('user_id', userId).order('id').range(from, to),
        ),
      ]);
      const reply = answerFinancialQuestion(
        {
          transactions: transactionSchema.array().parse(rows),
          goals: goalSchema.array().parse(goals),
          financial_accounts: accountSchema.array().parse(accounts),
        },
        text,
        civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone),
      );
      if (!reply)
        throw new HttpError(422, 'Não consegui entender essa pergunta. Tente perguntar de outro jeito.');
      const lines = [reply.answer, ...reply.calculation.slice(0, 8).map((line) => `• ${line}`)];
      if (reply.records.length)
        lines.push(
          '',
          'Lançamentos considerados:',
          ...reply.records
            .slice(0, 8)
            .map(
              (record) =>
                `• ${record.description} · ${whatsappDate(record.date)} · ${formatMoney(record.amount)}`,
            ),
        );
      if (reply.records.length > 8 || reply.calculation.length > 8)
        lines.push('', 'Há mais detalhes no Histórico e em Perguntar ao Nexo no app.');
      const today = civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone);
      const normalized = text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      let chartItems: {
        label: string;
        value: number;
        maxValue?: number;
        tone: 'income' | 'expense' | 'neutral' | 'warning';
      }[];
      let chartTitle = 'CONSULTA FINANCEIRA';
      if (/por que|porque|\bpq\b/.test(normalized) && /gastei.*mais/.test(normalized)) {
        const currentStart = `${today.slice(0, 7)}-01`;
        const previousEnd = shiftMonths(today, -1);
        const previousStart = `${previousEnd.slice(0, 7)}-01`;
        const current = sum(
          reply.records
            .filter((row) => row.date >= currentStart && row.date <= today)
            .map((row) => row.amount),
        );
        const previous = sum(
          reply.records
            .filter((row) => row.date >= previousStart && row.date <= previousEnd)
            .map((row) => row.amount),
        );
        chartTitle = 'GASTOS NO MES';
        chartItems = [
          { label: 'MES ATUAL', value: current, tone: 'expense' },
          { label: 'MES PASSADO', value: previous, tone: 'neutral' },
        ];
      } else if (reply.goals.length) {
        chartTitle = 'PROGRESSO DAS METAS';
        chartItems = reply.goals.map((goal) => ({
          label: goal.name,
          value: goal.saved,
          maxValue: goal.target,
          tone: 'income',
        }));
      } else if (reply.records.length) {
        const grouped = new Map<string, number>();
        for (const record of reply.records)
          grouped.set(record.category, (grouped.get(record.category) ?? 0) + record.amount);
        chartItems = [...grouped.entries()]
          .sort((first, second) => second[1] - first[1])
          .slice(0, 6)
          .map(([label, value]) => ({
            label,
            value,
            tone: reply.records[0].type === 'income' ? 'income' : 'expense',
          }));
      } else {
        chartItems = [{ label: 'SEM REGISTROS', value: 0, tone: 'neutral' }];
      }
      const canShowChart =
        reply.records.length > 0 ||
        reply.goals.length > 0 ||
        isFinancialChartRequest(text) ||
        /não encontrei (gastos pagos|entradas recebidas)/.test(reply.answer);
      if (!canShowChart) {
        await finish(lines.join('\n'), userId);
        return;
      }
      const month = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
      const chart = await financeChartPng({
        title: chartTitle,
        subtitle: `ATE ${whatsappDate(today)} · ${month}`,
        items: chartItems,
        footer: 'VALORES DOS REGISTROS DO NEXO',
      });
      const caption = [
        reply.answer,
        ...reply.calculation.slice(0, 3).map((line) => `• ${line}`),
        ...(reply.records.length ? ['Veja os lançamentos completos em Histórico no app.'] : []),
      ].join('\n');
      await finishImage(chart, caption, userId, 'image/png');
      return;
    }
    const requestedImage = imageGenerationPrompt(text);
    if (requestedImage) {
      const imageLimit = await db.rpc('consume_rate_limit', {
        subject: userId,
        bucket_name: 'whatsapp-image',
        max_requests: 3,
      });
      if (imageLimit.error || !imageLimit.data) {
        await finish('Você já pediu algumas imagens agora. Aguarde um minuto e tente de novo.', userId);
        return;
      }
      const typingRefresh = setInterval(() => void showTypingIndicator(message.id), 20_000);
      try {
        const image = await generateWhatsAppImage(requestedImage);
        await finishImage(
          image,
          'Aqui está a imagem que você pediu. A criação usa a cota de imagens do Nexo.',
          userId,
          'image/jpeg',
        );
      } catch (error) {
        if (committed) throw error;
        await finish(
          error instanceof HttpError
            ? error.message
            : 'Não consegui gerar essa imagem agora. Tente outra descrição.',
          userId,
        );
      } finally {
        clearInterval(typingRefresh);
      }
      return;
    }
    if (/^desfazer$/i.test(text)) {
      const undone = await db.rpc('undo_whatsapp', { owner: userId });
      if (undone.error) throw new Error('undo');
      await finish(
        undone.data
          ? 'Desfeito. Removi o último registro feito pelo WhatsApp; confira o Histórico no app.'
          : 'Não encontrei um registro feito pelo WhatsApp nas últimas 24 horas para desfazer.',
        userId,
      );
      return;
    }
    if (/^confirmar$/i.test(text)) {
      const pending = await db
        .from('whatsapp_messages_metadata')
        .select('message_id,pending_payload')
        .eq('user_id', userId)
        .eq('state', 'pending')
        .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      if (pending.error) throw new Error('pending');
      const transactionPending = pending.data.find((item) => Array.isArray(item.pending_payload));
      if (!transactionPending) {
        await finish('Não há nada aguardando confirmação. Envie o gasto ou recibo novamente.', userId);
        return;
      }
      const saved = await db.rpc('commit_whatsapp', {
        message_key: transactionPending.message_id,
        owner: userId,
        payload: transactionPending.pending_payload,
      });
      if (saved.error) throw new Error('commit');
      await finish(
        'Salvo! Confira em Histórico no app. Para cancelar, envie “desfazer” em até 24 horas.',
        userId,
      );
      return;
    }
    const pendingSpendability = await findPendingSpendability(userId);
    if (pendingSpendability && /^(?:cancelar|desistir)[!.\s]*$/i.test(text)) {
      await closePendingSpendability(pendingSpendability.messageId);
      await finish('Sem problema, cancelei essa avaliação. Não alterei seus registros.', userId);
      return;
    }
    const newTransactionMessage = /\b(?:gastei|gaste|comprei|paguei|recebi|ganhei|entrou|saiu)\b/i.test(text);
    if (pendingSpendability && !newTransactionMessage) {
      const today = civilDate(new Date(Number(message.timestamp) * 1000), profile.data.timezone);
      const context = await parseSpendabilityMessage(text, today, pendingSpendability.context, userId);
      if (spendabilityMissing(context).length) {
        await holdSpendability(context, userId, pendingSpendability.messageId);
        return;
      }
      await answerSpendability(context, userId, today, pendingSpendability.messageId);
      return;
    }
    const parsed = await parseTransaction(
      text,
      profile.data.timezone,
      new Date(Number(message.timestamp) * 1000),
      userId,
    );
    const preferences = await db
      .from('category_preferences')
      .select('merchant,category')
      .eq('user_id', userId);
    if (preferences.error) throw new HttpError(503, 'Não foi possível conferir preferências.');
    for (const row of parsed.transactions) {
      const preference = preferences.data.find((item) => item.merchant === merchantKey(row.description));
      if (preference) row.category = preference.category;
    }
    if (parsed.parsed.intent === 'question') {
      await finish(
        'Posso ajudar com gastos, entradas, contas e metas. Para ver o mês, envie “resumo”; para conferir seus registros, abra Histórico no app. Não salvei nada com esta pergunta.',
        userId,
      );
      return;
    }
    if (parsed.parsed.intent === 'unsupported') {
      await finish(
        'Ainda não consigo fazer isso por mensagem. Posso registrar gastos e entradas ou consultar seu resumo, suas contas e metas. Não salvei nada desta vez.',
        userId,
      );
      return;
    }
    if (parsed.action === 'clarify') {
      await finish(
        parsed.parsed.clarification ??
          'Não peguei todos os detalhes. Me diga o valor, o que foi e quando aconteceu. Por exemplo: “Gastei 25 reais no almoço hoje”.',
        userId,
      );
      return;
    }
    const details = parsed.transactions
      .map(
        (t) =>
          `${t.type === 'income' ? 'Entrada' : 'Gasto'}: ${formatMoney(t.amount)} · ${t.description} · ${t.date.split('-').reverse().join('/')}${t.status === 'planned' ? ' (ainda não aconteceu)' : ''}`,
      )
      .join('\n');
    if (parsed.action === 'confirm') {
      const reply = `Antes de salvar, entendi assim:\n${details}\n\nNada foi salvo ainda. Se estiver certo, envie “confirmar” em até 10 minutos. Se precisar corrigir, mande os dados novamente.`;
      const pending = await db
        .from('whatsapp_messages_metadata')
        .update({ user_id: userId, state: 'pending', pending_payload: parsed.transactions, reply })
        .eq('message_id', message.id);
      if (pending.error) throw new Error('pending');
      committed = true;
      await deliverReply(message.id, message.from, reply);
      return;
    }
    const saved = await db.rpc('commit_whatsapp', {
      message_key: message.id,
      owner: userId,
      payload: parsed.transactions,
    });
    if (saved.error) throw new Error('commit');
    committed = true;
    await finish(
      `Pronto, anotei:\n${details}\n\n${parsed.action === 'save-correctable' ? 'Confira se entendi direitinho. ' : ''}Para corrigir, abra Histórico no app. Para cancelar este registro, envie “desfazer” em até 24 horas.`,
      userId,
    );
  } catch {
    // Never retry a committed financial write. External delivery failure is kept
    // as metadata for operator reconciliation, without logging financial content.
    if (!committed)
      await db
        .from('whatsapp_messages_metadata')
        .update({ state: 'failed', updated_at: new Date().toISOString() })
        .eq('message_id', message.id);
    console.error(JSON.stringify({ event: 'whatsapp_failure', stage: committed ? 'reply' : 'processing' }));
    throw new HttpError(503, 'Falha no processamento.');
  }
}
Deno.serve(async (request) => {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (
        url.searchParams.get('hub.mode') === 'subscribe' &&
        url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN')
      )
        return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
      return new Response('Forbidden', { status: 403 });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (Number(request.headers.get('content-length') ?? 0) > 1_000_000)
      throw new HttpError(413, 'Payload muito grande.');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1_000_000) throw new HttpError(413, 'Payload muito grande.');
    if (!(await verifySignature(raw, request.headers.get('x-hub-signature-256'))))
      throw new HttpError(401, 'Assinatura inválida.');
    const payload = webhookSchema.parse(JSON.parse(raw));
    for (const entry of payload.entry)
      for (const change of entry.changes) {
        if (
          change.value.messages?.length &&
          change.value.metadata?.phone_number_id !== env('WHATSAPP_PHONE_NUMBER_ID')
        )
          throw new HttpError(403, 'Número de destino inválido.');
        for (const message of change.value.messages ?? []) await processMessage(message);
        if (change.value.metadata?.phone_number_id === env('WHATSAPP_PHONE_NUMBER_ID')) {
          for (const status of change.value.statuses ?? []) {
            // A late receipt must not downgrade a message already delivered/read.
            const allowed =
              status.status === 'read'
                ? ['accepted', 'delivered', 'failed', 'reconcile']
                : status.status === 'delivered'
                  ? ['accepted', 'failed', 'reconcile']
                  : ['accepted', 'reconcile'];
            const updated = await admin()
              .from('whatsapp_messages_metadata')
              .update({
                delivery_status: status.status === 'sent' ? 'accepted' : status.status,
                reply_error_code: status.status === 'failed' ? (status.errors?.[0]?.code ?? null) : null,
              })
              .eq('reply_message_id', status.id)
              .in('delivery_status', allowed);
            if (updated.error) throw new HttpError(503, 'Não foi possível atualizar a entrega.');
            const notification = await admin()
              .from('financial_notifications')
              .update({
                state: status.status === 'sent' ? 'accepted' : status.status,
                error_code: status.status === 'failed' ? (status.errors?.[0]?.code ?? null) : null,
                updated_at: new Date().toISOString(),
              })
              .eq('reply_message_id', status.id)
              .in('state', allowed);
            if (notification.error) throw new HttpError(503, 'Não foi possível atualizar o aviso.');
          }
        }
      }
    return json({ received: true });
  } catch (error) {
    return json({ error: 'Webhook não processado.' }, error instanceof HttpError ? error.status : 400);
  }
});
