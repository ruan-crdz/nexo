import { describe, expect, it } from 'vitest';
import {
  createGuide,
  guideAnswer,
  guideChange,
  guideQuestion,
  guideReceipt,
  parseGuideAction,
  type GuideKind,
} from '../../shared/whatsapp-guide';
import {
  navigationKey,
  navigationPages,
  navigationPrompts,
  navigationQueries,
  rootChoices,
} from '../../shared/whatsapp-navigation';
import { whatsAppMessageContent } from '../../shared/whatsapp-presentation';

function complete(kind: GuideKind, inputs: string[]) {
  let state = createGuide(kind, '2026-10-08');
  for (const input of inputs) {
    const question = guideQuestion(state);
    expect(question.buttons.length).toBeLessThanOrEqual(10);
    expect(whatsAppMessageContent(question.reply, question.buttons).type).toBe('interactive');
    const result = guideAnswer(state, input);
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return state;
}
describe('experiência guiada do WhatsApp', () => {
  it('todas as opções são nativas, válidas e alcançáveis; não aceita comandos inventados', () => {
    const visited = new Set<string>();
    function visit(key: string) {
      if (visited.has(key)) return;
      visited.add(key);
      const page = navigationPages[key];
      if (page) {
        expect(whatsAppMessageContent(page.reply, page.buttons).type).toBe('interactive');
        for (const button of page.buttons) {
          const destination = navigationKey(button.id);
          expect(destination, button.id).not.toBeNull();
          visit(destination!);
        }
      }
    }
    visit('home');
    for (const key of [
      ...Object.keys(navigationPages),
      ...Object.keys(navigationQueries),
      ...Object.keys(navigationPrompts),
      'expense',
      'income',
      'goal',
      'recurring',
    ])
      expect(visited.has(key), key).toBe(true);
    expect(navigationKey('nexo:nav:__proto__')).toBeNull();
    expect(navigationKey('nexo:nav:apagar-tudo')).toBeNull();
    const message = whatsAppMessageContent('Escolha uma opção', rootChoices);
    expect(message.interactive?.type).toBe('list');
    expect(message.interactive?.action.sections?.[0].rows).toHaveLength(10);
    expect(() => whatsAppMessageContent('teste', [...rootChoices, rootChoices[0]])).toThrow();
  });
  it.each([
    ['expense', ['Farmácia', '35,90', 'Hoje', 'Saúde', 'Já paguei'], 'transactions', 3590],
    [
      'income',
      ['Aposentadoria', '2.000,00', 'Ontem', 'Salário', 'Ainda vou receber'],
      'transactions',
      200000,
    ],
    ['goal', ['Viagem', '3.000,00', '20/12/2026', '100', 'Alta'], 'goals', 300000],
    ['recurring', ['Internet', '156', '20/10/2026', 'Serviços', 'Todo mês'], 'recurring_rules', 15600],
  ] as const)('conclui %s com datas, valores e situação explícitos', (kind, inputs, entity, cents) => {
    const state = complete(kind, [...inputs]);
    const change = guideChange(state);
    expect(change.entity).toBe(entity);
    expect(change.payload.amount ?? change.payload.target).toBe(cents);
    expect(guideReceipt(state)).not.toMatch(/confirmar|posso salvar|saldo bancário/i);
    if (kind === 'income') expect(change.payload).toMatchObject({ date: '2026-10-07', status: 'planned' });
    if (kind === 'goal') expect(change.payload).not.toHaveProperty('saved');
    if (kind === 'recurring')
      expect(change.payload).toMatchObject({
        frequency: 'monthly',
        start_date: '2026-10-20',
        type: 'expense',
      });
  });
  it('não chuta valores, datas inválidas, prazo passado nem escolhas desconhecidas', () => {
    let state = createGuide('expense', '2026-10-08');
    expect(() => guideChange(state)).toThrow(/incompleto/);
    state = { ...state, step: 1 };
    for (const input of ['talvez 20', '1.23', '-5', '0', 'NaN', '999999999999999999'])
      expect(guideAnswer(state, input)).toHaveProperty('error');
    state = { ...state, step: 2 };
    expect(guideAnswer(state, '31/02/2026')).toHaveProperty('error');
    expect(guideAnswer(state, '', '99')).toHaveProperty('error');
    expect(guideAnswer({ ...state, kind: 'goal' }, '01/01/2020')).toHaveProperty('error');
  });
  it('voltar remove respostas seguintes e muda a versão de todos os botões', () => {
    const state = {
      ...createGuide('expense', '2026-10-08'),
      step: 4,
      version: 4,
      answers: { description: 'Padaria', amount: 1000, date: '2026-10-08', category: 'Alimentação' },
    };
    const answer = guideAnswer(state, '', 'back');
    if ('error' in answer) throw new Error(answer.error);
    expect(answer.state.step).toBe(3);
    expect(answer.state.answers).not.toHaveProperty('category');
    for (const button of guideQuestion(answer.state).buttons)
      expect(parseGuideAction(button.id)).toMatchObject({ id: state.id, version: 5 });
  });
});
