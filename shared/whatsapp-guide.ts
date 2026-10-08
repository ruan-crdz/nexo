import { formatMoney, parseMoney, shiftDays, validDate } from './financial-engine.ts';
import { validateChatChange } from './whatsapp-chat.ts';
import type { WhatsAppButton } from './whatsapp-presentation.ts';

export type GuideKind = 'expense' | 'income' | 'goal' | 'recurring';
export type GuideState = {
  id: string;
  version: number;
  kind: GuideKind;
  step: number;
  today: string;
  answers: Record<string, string | number>;
};
type Field = {
  key: string;
  question: string;
  type: 'text' | 'money' | 'date' | 'choice';
  max?: number;
  zero?: boolean;
  choices?: { value: string; title: string }[];
};
const choice = (value: string, title: string) => ({ value, title });
const category: Field = {
  key: 'category',
  question: 'Em qual categoria entra?',
  type: 'text',
  max: 60,
  choices: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Serviços', 'Outros'].map(
    (title) => choice(title, title),
  ),
};
const description: Field = {
  key: 'description',
  question: 'O que você quer anotar?\nExemplo: Farmácia.',
  type: 'text',
  max: 180,
};
const amount: Field = {
  key: 'amount',
  question: 'Qual é o valor?\nDigite, por exemplo: 35,90.',
  type: 'money',
};
const date: Field = {
  key: 'date',
  question: 'Qual é a data?\nEscolha abaixo ou escreva no formato dia/mês/ano.',
  type: 'date',
  choices: [choice('today', 'Hoje'), choice('yesterday', 'Ontem')],
};
const fields: Record<GuideKind, Field[]> = {
  expense: [
    description,
    amount,
    date,
    category,
    {
      key: 'status',
      question: 'Esse gasto já foi pago?\nAo escolher, eu salvo o registro.',
      type: 'choice',
      choices: [choice('paid', 'Já paguei'), choice('planned', 'Ainda vou pagar')],
    },
  ],
  income: [
    { ...description, question: 'De onde veio ou virá esse dinheiro?\nExemplo: Aposentadoria.' },
    amount,
    date,
    {
      ...category,
      choices: ['Salário', 'Serviços', 'Investimentos', 'Outros'].map((title) => choice(title, title)),
    },
    {
      key: 'status',
      question: 'Esse dinheiro já foi recebido?\nAo escolher, eu salvo o registro.',
      type: 'choice',
      choices: [choice('paid', 'Já recebi'), choice('planned', 'Ainda vou receber')],
    },
  ],
  goal: [
    {
      key: 'name',
      question: 'Para que você quer juntar dinheiro?\nExemplo: Uma viagem.',
      type: 'text',
      max: 100,
    },
    { key: 'target', question: 'Quanto você quer juntar no total?\nExemplo: 2.000,00.', type: 'money' },
    { key: 'deadline', question: 'Até que data?\nEscreva no formato dia/mês/ano.', type: 'date' },
    {
      key: 'monthly_contribution',
      question: 'Quanto pretende guardar por mês?\nDigite 0 se ainda não quiser reservar um valor.',
      type: 'money',
      zero: true,
    },
    {
      key: 'priority',
      question:
        'Qual é a prioridade dessa Caixinha?\nAo escolher, eu crio a Caixinha. O valor guardado começa em zero; depois você pode anotar os aportes.',
      type: 'choice',
      choices: [choice('high', 'Alta'), choice('medium', 'Média'), choice('low', 'Baixa')],
    },
  ],
  recurring: [
    { ...description, question: 'Qual conta se repete?\nExemplo: Internet.' },
    amount,
    {
      key: 'start_date',
      question: 'Quando é o primeiro vencimento?\nEscreva no formato dia/mês/ano.',
      type: 'date',
    },
    category,
    {
      key: 'frequency',
      question:
        'Com que frequência essa conta se repete?\nAo escolher, eu cadastro a conta como previsão. Isso não registra um pagamento.',
      type: 'choice',
      choices: [choice('weekly', 'Toda semana'), choice('monthly', 'Todo mês'), choice('yearly', 'Todo ano')],
    },
  ],
};
const titles: Record<GuideKind, string> = {
  expense: 'Anotar gasto',
  income: 'Anotar entrada',
  goal: 'Criar uma Caixinha',
  recurring: 'Criar conta fixa',
};
export function createGuide(kind: GuideKind, today: string): GuideState {
  return { id: crypto.randomUUID(), version: 0, kind, today, step: 0, answers: {} };
}
export function guideQuestion(state: GuideState, hint?: string) {
  const field = fields[state.kind][state.step];
  const buttons: WhatsAppButton[] = (field.choices ?? []).map((item, index) => ({
    id: `nexo:guide:${state.id}:${state.version}:${index}`,
    title: item.title,
  }));
  if (state.step > 0 && buttons.length !== 3)
    buttons.push({ id: `nexo:guide:${state.id}:${state.version}:back`, title: 'Voltar uma etapa' });
  if (buttons.length !== 3)
    buttons.push({ id: `nexo:guide:${state.id}:${state.version}:cancel`, title: 'Cancelar cadastro' });
  return {
    reply: `*${titles[state.kind]} · ${state.step + 1} de ${fields[state.kind].length}*\n\n${hint ? `${hint}\n\n` : ''}${field.question}\n\n${buttons.length === 3 ? 'Para voltar, escreva voltar. ' : ''}Para sair, escreva menu.`,
    buttons,
  };
}
export function parseGuideAction(id: string) {
  const match = /^nexo:guide:([a-f0-9-]{36}):(\d+):(\d+|back|cancel)$/.exec(id);
  return match ? { id: match[1], version: Number(match[2]), value: match[3] } : null;
}
export function guideAnswer(
  state: GuideState,
  input: string,
  selected?: string,
): { state: GuideState; complete: boolean } | { error: string } {
  if (selected === 'back') {
    const step = Math.max(0, state.step - 1);
    const answers = { ...state.answers };
    for (const field of fields[state.kind].slice(step)) delete answers[field.key];
    return { state: { ...state, step, answers, version: state.version + 1 }, complete: false };
  }
  const field = fields[state.kind][state.step];
  let value: string | number = input.trim();
  if (selected !== undefined) {
    const item = field.choices?.[Number(selected)];
    if (!item) return { error: 'Essa opção não está disponível nesta etapa. Escolha uma das opções abaixo.' };
    value = item.value;
  } else {
    const match = field.choices?.find(
      (item) => item.title.toLocaleLowerCase('pt-BR') === String(value).toLocaleLowerCase('pt-BR'),
    );
    if (match) value = match.value;
  }
  try {
    if (field.type === 'money') {
      value = parseMoney(String(value).replace(/\s*reais[.!]?$/i, ''));
      if (value < 0 || (!field.zero && value === 0)) throw new Error();
    } else if (field.type === 'date') {
      const lower = String(value).toLowerCase();
      if (['today', 'hoje'].includes(lower)) value = state.today;
      else if (['yesterday', 'ontem'].includes(lower)) value = shiftDays(state.today, -1);
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(value))) {
        const [day, month, year] = String(value).split('/');
        value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      if (!validDate(String(value))) throw new Error();
      if (state.kind === 'goal' && String(value) < state.today)
        return { error: 'O prazo da Caixinha precisa ser hoje ou uma data futura.' };
    } else if (field.type === 'choice') {
      if (!field.choices?.some((item) => item.value === value))
        return { error: 'Escolha uma opção abaixo ou escreva exatamente o nome dela.' };
    } else if (String(value).length < 2 || String(value).length > (field.max ?? 180)) {
      return { error: `Use um nome entre 2 e ${field.max ?? 180} caracteres.` };
    }
  } catch {
    return {
      error:
        field.type === 'date'
          ? 'Não consegui entender a data. Use dia/mês/ano, como 20/10/2026.'
          : 'Não consegui entender o valor. Use números, como 35,90.',
    };
  }
  return {
    state: {
      ...state,
      version: state.version + 1,
      step: state.step + 1,
      answers: { ...state.answers, [field.key]: value },
    },
    complete: state.step + 1 === fields[state.kind].length,
  };
}
export function guideChange(state: GuideState) {
  if (state.step !== fields[state.kind].length) throw new Error('Cadastro incompleto.');
  const values = { ...state.answers };
  let entity: 'transactions' | 'goals' | 'recurring_rules';
  if (state.kind === 'expense' || state.kind === 'income') {
    entity = 'transactions';
    Object.assign(values, { type: state.kind, account_id: null });
  } else if (state.kind === 'goal') entity = 'goals';
  else {
    entity = 'recurring_rules';
    Object.assign(values, { type: 'expense', active: true });
  }
  return validateChatChange({ entity, action: 'create', id: null, values: JSON.stringify(values) }, null);
}
export function guideReceipt(state: GuideState) {
  const a = state.answers;
  const dateLabel = (value: unknown) => String(value).split('-').reverse().join('/');
  if (state.kind === 'goal')
    return `*Caixinha criada* ✓\n${a.name}\nObjetivo: *${formatMoney(Number(a.target))}*\nPrazo: ${dateLabel(a.deadline)}\nPor mês: ${formatMoney(Number(a.monthly_contribution))}\nGuardado: R$ 0,00\n\nVocê já pode acompanhar no app.`;
  if (state.kind === 'recurring')
    return `*Conta fixa cadastrada* ✓\n${a.description} · *${formatMoney(Number(a.amount))}*\nPrimeiro vencimento: ${dateLabel(a.start_date)}\nFrequência: ${{ weekly: 'semanal', monthly: 'mensal', yearly: 'anual' }[String(a.frequency)]}\n\nÉ uma previsão. Nenhum pagamento foi registrado.`;
  return `*${state.kind === 'expense' ? 'Gasto anotado' : 'Entrada anotada'}* ✓\n${a.description} · *${formatMoney(Number(a.amount))}*\n${dateLabel(a.date)} · ${a.category}\nSituação: ${a.status === 'planned' ? 'pendente' : state.kind === 'expense' ? 'pago' : 'recebido'}\n\nJá está no app.`;
}
