import { admin, HttpError } from './http.ts';
import {
  guideAnswer,
  guideChange,
  guideQuestion,
  guideReceipt,
  parseGuideAction,
  type GuideKind,
  type GuideState,
} from '../../../shared/whatsapp-guide.ts';
import {
  backChoice,
  navigationKey,
  navigationPages,
  navigationPrompts,
  navigationQueries,
  rootChoices,
  withNextStep,
} from '../../../shared/whatsapp-navigation.ts';
import type { WhatsAppButton } from '../../../shared/whatsapp-presentation.ts';
import { formatMoney } from '../../../shared/financial-engine.ts';
import { hashToken } from './whatsapp.ts';

type Context = { userId: string; phone: string; messageId: string; today: string; onCommit: () => void };
type Result = { reply?: string; buttons?: WhatsAppButton[]; text?: string };
const recordId = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const editFields = {
  amount: 'Valor',
  description: 'Descrição',
  date: 'Data',
  category: 'Categoria',
  status: 'Pago ou pendente',
} as const;
async function recordFingerprint(row: Record<string, unknown>) {
  return (
    await hashToken(
      JSON.stringify(
        ['id', 'description', 'amount', 'date', 'status', 'category', 'type', 'account_id'].map(
          (key) => row[key] ?? null,
        ),
      ),
    )
  ).slice(0, 12);
}

function isNaturalGuideMessage(text: string) {
  const normalized = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const hasAmount = /(?:r\$\s*\d[\d.,]*(?:\s*(?:mil|milhao|milhoes))?|\d[\d.,]*(?:\s*(?:mil|milhao|milhoes))?\s*(?:reais?|real)\b)/i.test(normalized);
  const hasIntent = /\b(gastei|paguei|comprei|desembolsei|passei|recebi|receberei|vou receber|ganhei|salario|aposentadoria|juntar|guardar|meta|reserva|recorrente|mensal|semanal|anual|todo mes|por mes|cada mes|toda semana|vence|vencimento)\b/i.test(normalized);
  const hasDescription = /\b(?:na|no|em|de|da|do|para)\s+[\p{L}\d]/iu.test(normalized);
  return hasAmount && (hasIntent || hasDescription);
}

async function recordNavigation(id: string, key: string | null, context: Context): Promise<Result | null> {
  const db = admin();
  const pagination = /^nexo:records:(edit|delete):(\d{1,3})$/.exec(id);
  if (key === 'edit-help' || key === 'delete-help' || pagination) {
    const action = pagination?.[1] ?? (key === 'delete-help' ? 'delete' : 'edit');
    const offset = Number(pagination?.[2] ?? 0);
    const found = await db
      .from('transactions')
      .select('id,description,amount,date,status,category,type,account_id')
      .eq('user_id', context.userId)
      .order('date', { ascending: false })
      .order('id')
      .range(offset, offset + 8);
    if (found.error) throw new HttpError(503, 'Não consegui consultar seus registros.');
    if (!found.data.length)
      return {
        reply:
          'Não encontrei lançamentos nesta página. Para alterar uma meta, conta ou outro cadastro, escreva o que deseja mudar.',
        buttons: [backChoice],
      };
    const issued = Math.floor(Date.now() / 1000);
    const buttons: WhatsAppButton[] = await Promise.all(
      found.data.slice(0, 8).map(async (row) => ({
        id: `nexo:record:${action}:${row.id}:${issued}:${await recordFingerprint(row)}`,
        title: String(row.description).slice(0, 24),
        description: `${formatMoney(row.amount)} · ${row.date.split('-').reverse().join('/')} · ${row.status === 'paid' ? 'pago/recebido' : 'pendente'}`,
      })),
    );
    // Native list row titles may repeat; IDs, values and dates distinguish them.
    if (found.data.length > 8 && offset < 992)
      buttons.push({ id: `nexo:records:${action}:${offset + 8}`, title: 'Ver mais registros' });
    buttons.push(backChoice);
    return {
      reply:
        action === 'delete'
          ? '*Excluir um lançamento*\nEscolha o registro que deseja excluir. Ao escolher, ele será removido do Nexo. Isso não cancela um pagamento no banco.\n\nPara excluir metas ou outros cadastros, diga o que deseja excluir por texto ou áudio.'
          : '*Corrigir um lançamento*\nEscolha o registro que deseja corrigir. Para alterar metas ou outros cadastros, diga o que deseja mudar por texto ou áudio.',
      buttons,
    };
  }
  const versionPattern = ':(\\d{10}):([a-f0-9]{12})';
  const selected = new RegExp(`^nexo:record:(edit|delete):(${recordId})${versionPattern}$`).exec(id);
  const field = new RegExp(
    `^nexo:edit-field:(amount|description|date|category|status):(${recordId})${versionPattern}$`,
  ).exec(id);
  if (!selected && !field) return null;
  const target = (selected ?? field)![2];
  const found = await db
    .from('transactions')
    .select('*')
    .eq('user_id', context.userId)
    .eq('id', target)
    .maybeSingle();
  if (found.error) throw new HttpError(503, 'Não consegui conferir esse registro.');
  if (!found.data)
    return {
      reply: 'Esse registro não está mais disponível. Abra o menu para consultar os registros atuais.',
      buttons: [backChoice],
    };
  const row = found.data;
  const selection = (selected ?? field)!;
  const elapsed = Math.floor(Date.now() / 1000) - Number(selection[3]);
  if (elapsed < -60 || elapsed > 1800 || (await recordFingerprint(row)) !== selection[4])
    return {
      reply: 'Essa lista expirou ou o registro mudou. Abra uma lista atualizada antes de alterar seus dados.',
      buttons: [backChoice],
    };
  const label = `${row.description} · ${formatMoney(row.amount)}\n${row.date.split('-').reverse().join('/')}`;
  if (selected?.[1] === 'delete') {
    const result = await db.rpc('save_whatsapp_batch', {
      owner: context.userId,
      sender: context.phone,
      message_key: context.messageId,
      changes: [{ entity: 'transactions', action: 'delete', id: target, payload: {}, expected: row }],
    });
    if (result.error)
      throw new HttpError(
        503,
        'Não consegui excluir. O registro pode ter mudado; consulte a lista novamente.',
      );
    context.onCommit();
    return {
      reply: withNextStep(
        result.data?.status === 'applied'
          ? `*Registro excluído* ✓\n${label}`
          : 'Não consegui excluir esse registro. Consulte os registros antes de tentar novamente.',
      ),
      buttons: rootChoices,
    };
  }
  if (field) {
    const name = editFields[field[1] as keyof typeof editFields];
    const prompt = `*Corrigir ${name.toLowerCase()}*\n${label}\n\n${field[1] === 'status' ? 'Escreva “pago” ou “pendente”.' : field[1] === 'date' ? 'Qual é a nova data? Use dia/mês/ano.' : `Qual é o novo valor para ${name.toLowerCase()}?`}`;
    await savePrompt(
      context.userId,
      `${prompt}\n[Contexto da seleção: lançamento ${target}; campo ${field[1]}. Consulte o registro atual antes de aplicar a resposta.]`,
    );
    return { reply: prompt, buttons: [backChoice] };
  }
  return {
    reply: `*Corrigir lançamento*\n${label}\n\nO que você quer mudar?`,
    buttons: [
      ...Object.entries(editFields).map(([value, title]) => ({
        id: `nexo:edit-field:${value}:${target}:${selection[3]}:${selection[4]}`,
        title,
      })),
      backChoice,
    ],
  };
}

async function savePrompt(userId: string, prompt: string) {
  const db = admin();
  const previous = await db
    .from('whatsapp_chat_sessions')
    .select('history')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (previous.error) throw new HttpError(503, 'Não consegui guardar o contexto da conversa.');
  const history = Array.isArray(previous.data?.history) ? previous.data.history.slice(-8) : [];
  const saved = await db.from('whatsapp_chat_sessions').upsert({
    user_id: userId,
    history: [...history, { role: 'assistant', content: prompt }],
    expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
  });
  if (saved.error) throw new HttpError(503, 'Não consegui guardar essa pergunta.');
}

async function advance(
  context: Context,
  current: GuideState,
  next: GuideState | null,
  view: { reply: string; buttons: WhatsAppButton[] },
  changes: unknown = null,
  start = false,
): Promise<Result> {
  const saved = await admin().rpc('advance_whatsapp_guide', {
    owner: context.userId,
    sender: context.phone,
    message_key: context.messageId,
    flow_key: current.id,
    expected_version: start ? -1 : current.version,
    next_state: next,
    changes,
    response_text: view.reply,
    response_buttons: view.buttons,
  });
  if (saved.error) throw new HttpError(503, 'Não consegui concluir essa etapa.');
  if (saved.data?.status === 'stale')
    return {
      reply:
        'Essa etapa já mudou ou o cadastro expirou. Use as opções da mensagem mais recente ou abra o menu para recomeçar.',
      buttons: [backChoice],
    };
  // Covers both durable form transitions and financial writes; delivery can retry
  // their already-stored reply without replaying the action.
  context.onCommit();
  return { ...view, reply: saved.data.reply };
}

export async function handleWhatsAppNavigation(
  input: { id?: string; text?: string; media?: boolean },
  context: Context,
): Promise<Result | null> {
  const db = admin();
  const legacy =
    input.id === 'nexo:menu:record'
      ? 'expense'
      : input.id === 'nexo:menu:summary'
        ? 'summary'
        : input.id === 'nexo:menu:help'
          ? 'help'
          : null;
  let key = legacy ?? navigationKey(input.id ?? '');
  if (!input.id && /^(oi|olá|ola|menu|ajuda|início|inicio)[!.?\s]*$/i.test(input.text ?? '')) key = 'home';
  const active = await db
    .from('whatsapp_guided_sessions')
    .select('state')
    .eq('user_id', context.userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (active.error) throw new HttpError(503, 'Não consegui consultar a etapa atual.');
  const current = active.data?.state as GuideState | undefined;
  if (current) current.today = context.today;
  if (current && input.media)
    return guideQuestion(
      current,
      'Há um cadastro em andamento. Termine ou cancele este cadastro; depois, envie a foto ou o PDF novamente.',
    );
  if (current && input.text && isNaturalGuideMessage(input.text)) {
    const cleared = await db.from('whatsapp_guided_sessions').delete().eq('user_id', context.userId);
    if (cleared.error) throw new HttpError(503, 'Não consegui retomar sua frase.');
    return null;
  }
  if (!current) {
    const records = await recordNavigation(input.id ?? '', key, context);
    if (records) return records;
  }
  if (key) {
    if (['expense', 'income', 'goal', 'recurring'].includes(key)) {
      if (current) {
        const cleared = await db.from('whatsapp_guided_sessions').delete().eq('user_id', context.userId);
        if (cleared.error) throw new HttpError(503, 'Não consegui encerrar o cadastro anterior.');
      }
      const prompts: Record<GuideKind, string> = {
        expense:
          '*Anotar gasto*\nEscreva ou mande um áudio com o que aconteceu. Exemplo: “Gastei 25 reais na farmácia hoje”. Se faltar algo, eu pergunto só o necessário.',
        income:
          '*Anotar entrada*\nEscreva ou mande um áudio com o valor, de onde veio e quando aconteceu. Exemplo: “Recebi 2.000 reais de salário hoje”. Se faltar algo, eu pergunto só o necessário.',
        goal:
          '*Criar uma meta*\nConte o objetivo, o valor e o prazo em uma frase. Exemplo: “Quero juntar 5 mil reais para uma viagem até dezembro de 2026, com prioridade alta e 300 reais por mês”. Se faltar algo, eu pergunto junto, sem formulário.',
        recurring:
          '*Criar conta fixa*\nDescreva o valor, o vencimento e a frequência em uma frase. Exemplo: “Internet, 120 reais por mês, vencimento todo dia 10”. Se faltar uma data essencial, eu pergunto.',
      };
      const prompt = prompts[key as GuideKind];
      await savePrompt(context.userId, prompt);
      return { reply: prompt, buttons: [backChoice] };
    }
    if (current) {
      const cancelled = await advance(context, current, null, {
        reply: 'Cadastro interrompido. Nada desse cadastro foi salvo.',
        buttons: [backChoice],
      });
      if (cancelled.reply?.startsWith('Essa etapa')) return cancelled;
    }
    if (Object.hasOwn(navigationPages, key)) {
      const page = navigationPages[key];
      return {
        ...page,
        reply: `${current ? 'Cadastro interrompido. Nada desse cadastro foi salvo.\n\n' : ''}${page.reply}`,
      };
    }
    if (Object.hasOwn(navigationQueries, key)) return { text: navigationQueries[key] };
    const prompt = navigationPrompts[key];
    await savePrompt(context.userId, prompt);
    return { reply: prompt, buttons: [backChoice] };
  }
  const selected = parseGuideAction(input.id ?? '');
  if (selected && (!current || current.id !== selected.id || current.version !== selected.version))
    return {
      reply:
        'Essa opção é de uma etapa anterior ou de um cadastro encerrado. Use a mensagem mais recente ou abra o menu.',
      buttons: [backChoice],
    };
  if (!current || (input.id && !selected)) return null;
  if (selected?.value === 'cancel' || /^(cancelar|cancela|sair)[!.?\s]*$/i.test(input.text ?? ''))
    return advance(context, current, null, {
      reply: withNextStep('Cadastro cancelado. Nenhum registro desse cadastro foi salvo.'),
      buttons: rootChoices,
    });
  if (!input.text && !selected) return null;
  const answer = guideAnswer(
    current,
    input.text ?? '',
    selected?.value ?? (/^voltar[!.?\s]*$/i.test(input.text ?? '') ? 'back' : undefined),
  );
  if ('error' in answer) return guideQuestion(current, answer.error);
  if (!answer.complete) return advance(context, current, answer.state, guideQuestion(answer.state));
  const change = guideChange(answer.state);
  return advance(
    context,
    current,
    null,
    { reply: withNextStep(guideReceipt(answer.state)), buttons: rootChoices },
    [change],
  );
}
