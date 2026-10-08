import { mkdirSync, writeFileSync } from 'node:fs';
import { createGuide, guideAnswer, guideQuestion, guideReceipt } from '../shared/whatsapp-guide.ts';
import { navigationPages, rootChoices, withNextStep } from '../shared/whatsapp-navigation.ts';
import { whatsAppMessageContent } from '../shared/whatsapp-presentation.ts';

const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const rich = (value) =>
  escape(value)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replaceAll('\n', '<br>');
function bubble(text, buttons = [], user = false) {
  const message = whatsAppMessageContent(text, buttons);
  const list = message.interactive?.type === 'list';
  return `<div class="bubble ${user ? 'user' : ''}"><div class="body">${rich(text)}</div>${buttons.length ? `<div class="footer">Pode escolher abaixo ou mandar texto ou áudio.</div>${list ? `<details><summary>☷ &nbsp; Ver opções</summary><div class="choices">${buttons.map((item) => `<div class="row"><strong>${escape(item.title)}</strong>${item.description ? `<small>${escape(item.description)}</small>` : ''}</div>`).join('')}</div></details>` : `<div class="buttons">${buttons.map((item) => `<span>${escape(item.title)}</span>`).join('')}</div>`}` : ''}</div>`;
}
function phone(title, subtitle, content) {
  return `<section class="scenario"><div class="caption"><h2>${title}</h2><p>${subtitle}</p></div><div class="phone"><div class="contact"><span class="avatar">N</span><div><strong>Nexo</strong><small>Seu dinheiro, com clareza</small></div></div><div class="conversation">${content}</div></div></section>`;
}
function example(kind, answers) {
  let state = createGuide(kind, '2026-10-08');
  const questions = [];
  for (const input of answers) {
    questions.push(guideQuestion(state));
    const result = guideAnswer(state, input);
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return { questions, receipt: guideReceipt(state) };
}
const expense = example('expense', ['Farmácia', '35,90', 'Hoje', 'Saúde', 'Já paguei']);
const goal = example('goal', ['Viagem em família', '3.000', '20/12/2026', '150', 'Média']);
const recurring = example('recurring', ['Internet', '156', '20/10/2026', 'Serviços', 'Todo mês']);
const scenarios = [
  phone(
    '01 · Começar sem decorar comandos',
    'Menu real do código. Clique em “Ver opções” para expandir.',
    bubble(navigationPages.home.reply, rootChoices),
  ),
  phone(
    '02 · Uma pergunta por vez',
    'Gasto guiado: descrição → valor → data → categoria → situação.',
    bubble('Farmácia', [], true) +
      bubble(expense.questions[1].reply, expense.questions[1].buttons) +
      bubble('35,90', [], true) +
      bubble(expense.questions[2].reply, expense.questions[2].buttons),
  ),
  phone(
    '03 · Pronto, com próximos passos',
    'Comprovante determinístico. Sem perguntar de novo se pode salvar.',
    bubble(withNextStep(expense.receipt), rootChoices),
  ),
  phone(
    '04 · Metas à vista',
    'Metas têm menu próprio, cadastro guiado e registro de aportes.',
    bubble(navigationPages.goals.reply, navigationPages.goals.buttons) +
      bubble(withNextStep(goal.receipt), rootChoices),
  ),
  phone(
    '05 · Conta fixa não é pagamento',
    'A resposta distingue previsão de dinheiro que já saiu.',
    bubble(withNextStep(recurring.receipt), rootChoices),
  ),
  phone(
    '06 · Corrigir com orientação',
    'Na conversa real, a lista mostra os lançamentos da própria pessoa.',
    bubble(
      '*Corrigir lançamento*\nFarmácia · R$ 35,90\n08/10/2026\n\nO que você quer mudar?',
      ['Valor', 'Descrição', 'Data', 'Categoria', 'Pago ou pendente', 'Menu principal'].map((title, i) => ({
        id: String(i),
        title,
      })),
    ),
  ),
];
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexo · Modelos do WhatsApp</title><style>
:root{font-family:Arial,sans-serif;color:#16352d;background:#f3f5f0;font-synthesis:none}*{box-sizing:border-box}body{margin:0}header,main,aside{max-width:1320px;margin:auto;padding:36px 28px}header{padding-bottom:12px}.brand{font-size:14px;letter-spacing:.16em;font-weight:bold;color:#326951}h1{font-size:clamp(30px,4vw,48px);line-height:1.12;margin:18px 0;max-width:760px;letter-spacing:-1.5px}header p{font-size:18px;line-height:1.6;max-width:820px;color:#435f54}.tag{display:inline-block;padding:9px 14px;border-radius:20px;background:#dcebdc;font-size:13px;font-weight:bold}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px;align-items:start}.caption{min-height:105px}.caption h2{font-size:19px;line-height:1.4;margin:0 0 8px}.caption p{font-size:14px;color:#52665b;line-height:1.5;margin:0 0 18px}.phone{background:#eae7df;border:1px solid #ccd4c9;border-radius:22px;overflow:hidden;box-shadow:0 8px 25px #16352d0d}.contact{display:flex;gap:12px;align-items:center;padding:17px;background:#075e54;color:white}.contact small{display:block;margin-top:4px;color:#dfefe8;font-size:12px}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#dcebdc;color:#075e54;font-weight:bold}.conversation{padding:20px 13px 28px;min-height:420px}.bubble{margin:0 12px 14px 0;background:white;border-radius:4px 14px 14px 14px;box-shadow:0 1px 1px #0001;overflow:hidden}.bubble.user{margin:0 0 14px 50px;background:#dcf8c6;border-radius:14px 4px 14px 14px}.body{padding:15px;font-size:16px;line-height:1.55;overflow-wrap:anywhere}.footer{font-size:11px;line-height:1.5;padding:0 15px 12px;color:#61736a}summary,.buttons span{padding:15px;min-height:48px;color:#006453;text-align:center;font-weight:600;font-size:15px;border-top:1px solid #e5eae6}summary{cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}summary:hover{background:#eff8f1}summary:focus-visible{outline:3px solid #326951;outline-offset:-3px}.buttons{display:flex;flex-wrap:wrap}.buttons span{flex:1;white-space:nowrap}.choices{background:#fafcf9;padding:5px 12px}.row{padding:13px 4px;border-bottom:1px solid #dfe8de;font-size:15px}.row:last-child{border:0}.row small{display:block;color:#52665b;margin-top:5px;font-size:13px;line-height:1.4}aside{font-size:15px;line-height:1.7;padding-top:0;color:#435f54}aside strong{color:#16352d}a{color:#075e54}@media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:660px){header,main,aside{padding:24px 16px}.grid{grid-template-columns:1fr;gap:30px}.caption{min-height:0}.conversation{min-height:0}h1{letter-spacing:-.7px}}
</style><header><div class="brand">NEXO / WHATSAPP</div><h1>Menos dúvidas.<br>Um próximo passo claro.</h1><p>Menus visíveis, perguntas simples e uma resposta clara quando a ação termina. Texto e áudio continuam disponíveis para quem prefere conversar.</p><span class="tag">Demonstração local · dados fictícios · não envia mensagens</span></header><main class="grid">${scenarios.join('')}</main><aside><strong>O que este material representa</strong><br>Os textos, escolhas e comprovantes dos cadastros vêm dos mesmos módulos usados pelo webhook. As caixas reproduzem a hierarquia da conversa; a aparência exata dos componentes nativos é definida pelo WhatsApp e varia entre aparelhos. Esta página não executa operações financeiras. “Ver opções” expande os modelos; as demais opções são ilustrativas.<br><br><strong>Limites explícitos</strong><br>Os campos são respondidos na conversa. Não há enquete ou WhatsApp Flow publicado nesta entrega. Consultas e mensagens livres continuam usando IA, portanto exigem avaliação de precisão separada. Automação bancária, confiabilidade da entrega e superioridade frente aos concorrentes não são demonstradas por este protótipo.</aside></html>`;
mkdirSync('docs/whatsapp', { recursive: true });
writeFileSync('docs/whatsapp/modelos.html', html, 'utf8');
console.log('Modelos gerados em docs/whatsapp/modelos.html');
