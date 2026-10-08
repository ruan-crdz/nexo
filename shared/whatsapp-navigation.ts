import type { WhatsAppButton } from './whatsapp-presentation.ts';

export const nexoAppUrl = 'https://ruan-crdz.github.io/nexo/';
export const nextStepText = 'O que deseja fazer a seguir?';
export type NavigationPage = { reply: string; buttons: WhatsAppButton[] };
const option = (key: string, title: string): WhatsAppButton => ({
  id: `nexo:nav:${key}`,
  title,
});
export const rootChoices = [
  option('expense', 'Anotar gasto'),
  option('income', 'Anotar entrada'),
  option('money', 'Consultar dinheiro'),
  option('goals', 'Caixinhas'),
  option('planning', 'Me planejar'),
  option('accounts', 'Contas e cartões'),
  option('receipts', 'Enviar comprovante'),
  option('corrections', 'Corrigir ou excluir'),
  option('help', 'Ajuda e preferências'),
  option('app', 'Abrir o app'),
];
export const backChoice = option('home', 'Menu principal');
const page = (reply: string, choices: WhatsAppButton[]): NavigationPage => ({
  reply,
  buttons: [...choices, backChoice],
});
export const navigationPages: Record<string, NavigationPage> = {
  home: {
    reply:
      '*Olá! Sou o Nexo.* 🌿\nVamos cuidar do seu dinheiro do seu jeito.\n\nEscolha uma opção abaixo ou escreva ou mande um áudio com o que aconteceu.',
    buttons: rootChoices,
  },
  money: page('*Consultar dinheiro*\nO que você quer conferir?', [
    option('summary', 'Resumo do mês'),
    option('history', 'Últimos registros'),
    option('due', 'Contas a pagar'),
    option('categories', 'Gastos por categoria'),
    option('cash-help', 'Dinheiro até uma data'),
    option('purchase-help', 'Posso comprar?'),
  ]),
  goals: page('*Caixinhas*\nO que você quer fazer?', [
    option('goal-list', 'Ver Caixinhas'),
    option('goal', 'Criar Caixinha'),
    option('saving-help', 'Anotar valor guardado'),
    option('withdrawal-help', 'Anotar uma retirada'),
  ]),
  planning: page('*Me planejar*\nEscolha por onde começar.', [
    option('recurring', 'Criar conta fixa'),
    option('recurring-list', 'Ver contas fixas'),
    option('budget-help', 'Limites de gastos'),
    option('debt-help', 'Minhas dívidas'),
    option('asset-help', 'Meus bens'),
    option('cash-help', 'Dinheiro até uma data'),
  ]),
  accounts: page(
    '*Contas e cartões*\nOs cadastros aqui são manuais. Eles não conectam seu banco automaticamente.',
    [
      option('account-list', 'Ver contas e cartões'),
      option('account-help', 'Cadastrar conta'),
      option('card-help', 'Cadastrar cartão'),
    ],
  ),
  receipts: page(
    '*Enviar comprovante*\nEnvie uma foto nítida da nota inteira ou um PDF. Vou ler os dados e avisar o que consegui registrar.\n\nUma nota não comprova pagamento: os registros entram como pendentes. Se já pagou, me avise. Não envie senhas ou dados completos do cartão.',
    [],
  ),
  corrections: page(
    '*Corrigir ou excluir*\nPrimeiro, escolha o que deseja fazer. Se houver dois registros parecidos, vou perguntar qual deles.',
    [
      option('edit-help', 'Corrigir um registro'),
      option('delete-help', 'Excluir um registro'),
      option('history', 'Ver últimos registros'),
    ],
  ),
  help: page('*Ajuda e preferências*\nComo posso ajudar?', [
    option('tutorial', 'Como usar'),
    option('profile-help', 'Meu nome e objetivo'),
    option('notifications', 'Avisos e lembretes'),
    option('family', 'Compartilhar em família'),
    option('privacy', 'Privacidade e acesso'),
    option('app', 'Abrir o app'),
  ]),
  tutorial: page(
    '*Seu dinheiro, sem complicação*\n\n• Use o menu como atalho ou escreva do seu jeito.\n• Exemplo: “Paguei 35 reais na farmácia hoje”. Pode mandar vários gastos juntos.\n• Áudio funciona como texto. Foto e PDF servem para ler notas.\n• Pedidos completos são salvos direto. Se faltar algo, eu pergunto só o necessário.\n• Para abrir o menu, escreva *menu*.\n\nEu organizo os registros; não faço pagamentos nem transferências.',
    [],
  ),
  app: page(`*Seu Nexo no app*\nToque no link para consultar e organizar seus dados:\n${nexoAppUrl}`, []),
  notifications: page(
    `*Avisos e lembretes*\nNo app, abra Você e ajuste suas preferências de avisos. A entrega pelo WhatsApp depende da configuração do serviço.\n${nexoAppUrl}`,
    [],
  ),
  family: page(
    `*Compartilhar em família*\nConvites e permissões precisam ser configurados no app. Não vou compartilhar seus dados apenas por uma mensagem.\n${nexoAppUrl}`,
    [],
  ),
  privacy: page(
    `*Privacidade e acesso*\nPara alterar senha, gerenciar sessões, exportar ou excluir sua conta, abra Você no app.\n${nexoAppUrl}`,
    [],
  ),
};

/** Only these immutable IDs can trigger model queries. Display labels are never commands. */
export const navigationQueries: Record<string, string> = {
  summary:
    'Consulte meu resumo deste mês: entradas pagas, gastos pagos e resultado dos movimentos. Distinga esse resultado de saldo bancário.',
  history: 'Mostre meus últimos cinco lançamentos, com descrição, valor, data e se estão pagos ou pendentes.',
  due: 'Quais contas ainda estão pendentes neste mês? Mostre valores e vencimentos.',
  categories: 'Quanto gastei por categoria neste mês? Considere apenas os gastos pagos.',
  'goal-list': 'Consulte minhas Caixinhas e mostre o valor guardado e o alvo de cada uma.',
  'recurring-list':
    'Consulte minhas contas recorrentes e mostre valor, frequência e próximo vencimento, se puder calculá-lo.',
  'account-list':
    'Consulte minhas contas e cartões cadastrados. Explique que são registros manuais, não saldos bancários verificados.',
};

/** Prompts are also stored in chat history so a short answer has context. */
export const navigationPrompts: Record<string, string> = {
  'cash-help':
    '*Planejar até uma data*\nQuanto dinheiro você tem disponível de verdade e até que dia precisa durar?\n\nExemplo: “Tenho 150 reais até 20/10/2026; comida e transporte já estão pagos”. Vou usar o valor que você informar, não presumir que a sobra do app é seu saldo.',
  'purchase-help':
    '*Pensar antes de comprar*\nO que você quer comprar, por quanto e como pretende pagar? Conte também quanto dinheiro está disponível, sem incluir limite do cartão.',
  'saving-help':
    '*Anotar valor guardado*\nEm qual Caixinha você guardou dinheiro e quanto foi?\nExemplo: “Guardei 50 reais na reserva”. Isso atualiza o valor guardado, sem criar outro gasto.',
  'withdrawal-help':
    '*Anotar uma retirada*\nDe qual Caixinha você retirou dinheiro e quanto foi?\nExemplo: “Retirei 30 reais da reserva”.',
  'budget-help':
    '*Limites de gastos*\nQuer consultar seus limites ou definir um novo?\nPara definir, diga a categoria, o valor e o mês: “Limite de 500 reais para alimentação em outubro de 2026”.',
  'debt-help':
    '*Minhas dívidas*\nQuer consultar, cadastrar ou corrigir uma dívida?\nPara cadastrar, me conte o nome, o valor ainda devido, o vencimento, os juros e o pagamento mínimo. Se não souber algum dado, me avise.',
  'asset-help':
    '*Meus bens*\nQuer consultar ou cadastrar um bem?\nPara cadastrar, diga o nome, o tipo e o valor estimado: “Meu carro vale 30 mil reais”.',
  'account-help':
    '*Cadastrar conta manual*\nQual é o nome da conta, o tipo e o saldo inicial?\nExemplo: “Conta corrente Banco X, saldo inicial de 200 reais”. O banco não será conectado automaticamente.',
  'card-help':
    '*Cadastrar cartão*\nQual é o nome, o limite, o dia do fechamento, o dia do vencimento e o saldo inicial do cartão?',
  'edit-help':
    '*Corrigir um registro*\nQual registro você quer mudar e o que ficou errado?\nExemplo: “O mercado de ontem foi 45 reais, não 54”. Só vou alterar o que você pedir.',
  'delete-help':
    '*Excluir um registro*\nQual registro você quer excluir? Diga o nome, o valor e a data, se souber.\nSe eu encontrar mais de um parecido, vou perguntar qual deles.',
  'profile-help':
    '*Seu nome e objetivo*\nQuer consultar ou mudar seu nome ou objetivo financeiro? Diga o que deseja ajustar.',
};

export function navigationKey(id: string) {
  const match = /^nexo:nav:([a-z-]+)$/.exec(id);
  if (!match) return null;
  const key = match[1];
  return Object.hasOwn(navigationPages, key) ||
    Object.hasOwn(navigationQueries, key) ||
    Object.hasOwn(navigationPrompts, key) ||
    ['expense', 'income', 'goal', 'recurring'].includes(key)
    ? key
    : null;
}

export function withNextStep(reply: string) {
  return `${reply.trim()}\n\n${nextStepText}`;
}
