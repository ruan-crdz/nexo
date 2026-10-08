import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Camera,
  ChevronDown,
  FileUp,
  Keyboard,
  Mic,
  MoreVertical,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { useApp } from '../data/context';
import {
  redactFinancialText,
  useFinancialVisibility,
  useMoneyDisplay,
} from '../design-system/financial-visibility';
import { invoke } from '../data/client';
import { goalMonthlyBudget, goalMonthlyPlan } from '../../shared/journey';
import { civilDate } from '../../shared/financial-engine';
import { monthlyFlow } from '../../shared/insights';
import { Brand, Button, Dialog } from '../design-system/components';

type Reply = {
  answer: string;
  metrics: Record<string, string>;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
  engine_version: string;
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; reply?: Reply; question?: string };
export function TypingIndicator() {
  return (
    <div className="nexo-typing" role="status" aria-label="Nexo está respondendo">
      <Brand compact />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}
const labels: Record<string, string> = {
  balance: 'Saldo estimado nos registros',
  recorded_surplus: 'Resultado dos movimentos',
  protected_goals: 'Guardado em Caixinhas',
  goal_name: 'Caixinha em foco',
  goal_saved: 'Guardado na Caixinha',
  goal_remaining: 'Falta para a Caixinha',
  goal_deadline: 'Prazo da Caixinha',
  goal_monthly_required: 'Cota mensal para o prazo',
  goal_next_contribution: 'Próximo aporte que cabe agora',
  income: 'Entradas',
  expenses: 'Saídas',
  free: 'Livre para planejar',
  reserve: 'Reserva',
  debt: 'Dívidas',
  net_worth: 'Patrimônio líquido',
  upcoming_bills: 'Reservado para despesas',
  score: 'Nexo Score',
  cash: 'Caixa',
  revenue: 'Receita',
  costs: 'Custos',
  result: 'Resultado',
  payroll: 'Folha',
  runway: 'Meses de caixa',
  break_even: 'Ponto de equilíbrio',
};
export function AssistantPage() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const { visible } = useFinancialVisibility();
  const location = useLocation();
  const routeQuestion = (location.state as { question?: unknown } | null)?.question;
  const [input, setInput] = useState(typeof routeQuestion === 'string' ? routeQuestion : '');
  const historyPreferenceKey = `nexo.ai.save-history.${app.user?.id ?? 'local'}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saveHistory, setSaveHistory] = useState(() =>
    Boolean(app.user && !app.demo && localStorage.getItem(historyPreferenceKey) === 'true'),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardVoiceRef = useRef(false);
  const voiceReplyRef = useRef(false);
  const organizations = app.demo ? [] : app.data.organizations;
  const activeOrganization = organizations.find((organization) => organization.id === app.organizationId);
  const focusedGoal =
    app.data.goals.find((goal) => goal.id === app.data.profile.active_goal_id) ?? app.data.goals[0];
  const suggestions = [
    'Como está meu mês?',
    'Posso gastar R$ 500?',
    app.data.debts.length
      ? 'Qual dívida devo priorizar?'
      : focusedGoal
        ? `Quando chego nos ${displayMoney(focusedGoal.target)}?`
        : 'Como está minha reserva?',
  ];
  const followups = [
    'Onde estou gastando mais?',
    'Quanto posso guardar?',
    focusedGoal ? 'Quando chego na minha Caixinha?' : 'Como está meu mês?',
  ];

  useEffect(() => {
    if (!app.demo && app.user) localStorage.setItem(historyPreferenceKey, String(saveHistory));
  }, [app.demo, app.user, historyPreferenceKey, saveHistory]);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
    },
    [],
  );

  function newConversation() {
    setMessages([]);
    setInput('');
    setError('');
    setMenuOpen(false);
    window.speechSynthesis?.cancel();
  }

  async function send(question = input, fromAudio = false) {
    if (!question.trim() || (pending && !fromAudio)) return;
    setInput('');
    setError('');
    setPending(true);
    const requestId = crypto.randomUUID();
    setMessages((previous) => [...previous, { id: requestId, role: 'user', text: question }]);
    try {
      let reply: Reply;
      if (app.demo) {
        const today = civilDate(new Date(), app.data.profile.timezone);
        const monthFlow = monthlyFlow(app.data.transactions, today.slice(0, 7));
        const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
        const normalizedQuestion = question
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        const asksAboutMonth = /\b(mes|gastos?|entradas?|saidas?)\b/.test(normalizedQuestion);
        const goal =
          app.data.goals.find((item) => item.id === app.data.profile.active_goal_id) ??
          app.data.goals.find((item) => item.saved < item.target);
        const plan = goal
          ? goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0)
          : null;
        const demoAnswer = asksAboutMonth
          ? `${monthFlow.net >= 0 ? 'Seu mês está positivo.' : 'Seu mês está abaixo do que entrou.'} Entrou ${displayMoney(monthFlow.income)} e saiu ${displayMoney(monthFlow.expenses)}.`
          : !goal || !plan
            ? `Há ${displayMoney(budget.available)} livres para planejar. Antes de escolher uma Caixinha, confira as contas e necessidades ainda não registradas.`
            : plan.remaining === 0
              ? `Você chegou à Caixinha ${goal.name}. Pode rever o nome ou manter o valor guardado.`
              : !goal.deadline
                ? `Na Caixinha ${goal.name}, faltam ${displayMoney(plan.remaining)}. Você pode guardar no seu ritmo, sem prazo ou cota mensal obrigatória.`
                : plan.required === 0
                  ? `A cota deste mês para a Caixinha ${goal.name} já foi cumprida. Você pode manter o valor guardado sem se pressionar por outro aporte.`
                  : plan.suggested > 0
                    ? `Na Caixinha ${goal.name}, faltam ${displayMoney(plan.remaining)}. Pelas anotações atuais, cabe guardar ${displayMoney(plan.suggested)} neste mês.${plan.gap > 0 ? ' O prazo pede mais que a sobra atual; você pode ajustar o prazo ou o valor da Caixinha.' : ''}`
                    : `Na Caixinha ${goal.name}, ainda faltam ${displayMoney(plan.remaining)}, mas não há sobra registrada para guardar agora. Confira as despesas e ajuste o plano sem comprometer o essencial.`;
        reply = {
          answer: `${demoAnswer}\n\nEsta é uma leitura local dos dados de exemplo, sem chamada de IA. Não é saldo bancário confirmado.`,
          metrics: asksAboutMonth
            ? {
                free: displayMoney(budget.available),
                income: displayMoney(monthFlow.income),
                expenses: displayMoney(monthFlow.expenses),
                recorded_surplus: displayMoney(monthFlow.net),
                upcoming_bills: displayMoney(budget.reservedExpenses),
              }
            : {
                recorded_surplus: displayMoney(budget.net),
                free: displayMoney(budget.available),
                upcoming_bills: displayMoney(budget.reservedExpenses),
              },
          sources: [],
          evidence_status: 'demo',
          engine_version: '1.0.0',
        };
      } else {
        reply = await invoke<Reply>('ai-chat', {
          request_id: requestId,
          question,
          save_history: saveHistory,
          history: messages
            .slice(-6)
            .map((message) => ({ role: message.role, content: message.text.slice(0, 2000) })),
          ...(app.organizationId ? { organization_id: app.organizationId } : {}),
        });
      }
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: 'assistant', text: reply.answer, reply, question },
      ]);
      if (voiceReplyRef.current && 'speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(reply.answer);
        speech.lang = 'pt-BR';
        window.speechSynthesis.speak(speech);
        voiceReplyRef.current = false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder.');
      setInput((current) => (current.trim() ? current : question));
    } finally {
      setPending(false);
    }
  }
  async function audio(file: File) {
    setPending(true);
    setError('');
    try {
      if (app.demo) throw new Error('A transcrição exige uma conta real e OpenAI configurada.');
      const form = new FormData();
      form.set('file', file);
      const result = await invoke<{ text: string }>('ai-transcribe', form);
      await send(result.text, true);
    } catch (err) {
      voiceReplyRef.current = false;
      setError(err instanceof Error ? err.message : 'Não foi possível transcrever.');
    } finally {
      setPending(false);
    }
  }

  async function startVoice() {
    setVoiceOpen(true);
    setVoiceError('');
    if (app.demo) {
      setVoiceError(
        'A transcrição de áudio exige uma conta real. Você ainda pode conversar por texto nesta demonstração.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError(
        'Este navegador não permite gravar áudio. Você pode escolher um arquivo ou usar o teclado.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardVoiceRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setVoiceRecording(false);
        if (discardVoiceRef.current) {
          discardVoiceRef.current = false;
          setVoiceOpen(false);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setVoiceError('Não foi possível capturar sua fala. Tente novamente ou use o teclado.');
          return;
        }
        setVoiceOpen(false);
        voiceReplyRef.current = true;
        void audio(new File([blob], 'nexo-voz.webm', { type: blob.type }));
      };
      recorder.start();
      setVoiceRecording(true);
    } catch {
      setVoiceError('Não consegui acessar o microfone. Confira a permissão do navegador.');
    }
  }

  function stopVoice(discard = false) {
    discardVoiceRef.current = discard;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else setVoiceOpen(false);
  }

  function selectContext(organizationId: string | null) {
    app.selectOrganization(organizationId);
    setContextOpen(false);
  }

  function primaryAction(question: string) {
    const normalized = question
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (/como esta.*mes|resumo.*mes/.test(normalized)) return { label: 'Ver meu mês', to: '/inicio' };
    if (/posso|compr|gastar/.test(normalized)) return { label: 'Simular compra', to: '/controle' };
    if (/caixinha|reserva|guardar|guardado/.test(normalized)) return { label: 'Ver objetivos', to: '/metas' };
    if (/gasto|entrada|movimento/.test(normalized)) return { label: 'Ver meu histórico', to: '/movimentos' };
    return { label: 'Ver meu mês', to: '/inicio' };
  }

  function renderAnswer(message: ChatMessage) {
    const reply = message.reply;
    if (!reply) return <p>{visible ? message.text : redactFinancialText(message.text)}</p>;
    const text = visible ? message.text : redactFinancialText(message.text);
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
    const metricEntries = Object.entries(reply.metrics);
    const normalizedQuestion = (message.question ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const preferredKeys = /caixinha|reserva|guardar|guardado|falta/.test(normalizedQuestion)
      ? ['goal_remaining', 'goal_saved', 'protected_goals', 'free']
      : /posso|compr|gastar|cabe/.test(normalizedQuestion)
        ? ['free', 'balance', 'recorded_surplus']
        : /mes|gasto|entrada|saiu|entrou/.test(normalizedQuestion)
          ? ['free', 'recorded_surplus', 'expenses', 'income']
          : ['free', 'recorded_surplus', 'balance'];
    const primary = preferredKeys.find((key) => reply.metrics[key]) ?? metricEntries[0]?.[0];
    const action = primaryAction(message.question ?? '');
    const explanation = paragraphs.slice(1);
    return (
      <div className="nexo-answer">
        {paragraphs[0] && <p className="nexo-answer-direct">{paragraphs[0]}</p>}
        {primary && (
          <div className="nexo-answer-metric">
            <span>{labels[primary] ?? primary}</span>
            <strong>{visible ? reply.metrics[primary] : redactFinancialText(reply.metrics[primary])}</strong>
          </div>
        )}
        <Link className="nexo-answer-action" to={action.to}>
          {action.label} <ArrowUpRight size={16} />
        </Link>
        {(explanation.length > 0 || reply.engine_version) && (
          <details className="nexo-answer-disclosure">
            <summary>Por quê?</summary>
            {explanation.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="muted">
              Cálculo feito pelo Financial Engine {reply.engine_version}; a IA recebe os resultados.
            </p>
          </details>
        )}
        {metricEntries.length > 0 && (
          <details className="nexo-answer-disclosure">
            <summary>Dados usados</summary>
            <dl className="nexo-metrics">
              {metricEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key] ?? key}</dt>
                  <dd>{visible ? value : redactFinancialText(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        <details className="nexo-answer-disclosure">
          <summary>Fontes</summary>
          {reply.sources.length ? (
            <div className="nexo-sources">
              {reply.sources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                  {source.title} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">
              {app.demo
                ? 'Demonstração: resposta local, sem IA ou fontes externas.'
                : reply.evidence_status === 'records'
                  ? 'Resposta baseada nos seus registros e nos cálculos do Nexo.'
                  : 'Não há fonte externa verificada para esta resposta.'}
            </p>
          )}
        </details>
      </div>
    );
  }

  return (
    <>
      <section className="nexo-page">
        <header className="nexo-context-header">
          <h1>Nexo</h1>
          <div className="nexo-context-actions">
            {!app.demo && organizations.length > 0 && (
              <div className="nexo-context-selector">
                <Button
                  variant="secondary"
                  aria-expanded={contextOpen}
                  onClick={() => setContextOpen((open) => !open)}
                >
                  {activeOrganization?.name ?? 'Pessoal'} <ChevronDown size={16} />
                </Button>
                {contextOpen && (
                  <div className="nexo-context-menu" role="menu" aria-label="Usar dados de">
                    <button
                      role="menuitemradio"
                      aria-checked={!app.organizationId}
                      onClick={() => selectContext(null)}
                    >
                      <span>Minha vida financeira</span>
                      {!app.organizationId && <span aria-hidden="true">✓</span>}
                    </button>
                    {organizations.map((organization) => (
                      <button
                        key={organization.id}
                        role="menuitemradio"
                        aria-checked={app.organizationId === organization.id}
                        onClick={() => selectContext(organization.id)}
                      >
                        <span>{organization.name}</span>
                        {app.organizationId === organization.id && <span aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="nexo-options">
              <Button
                variant="ghost"
                aria-label="Mais opções do Nexo"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreVertical size={20} />
              </Button>
              {menuOpen && (
                <div className="nexo-options-menu" role="menu">
                  <button role="menuitem" onClick={newConversation}>
                    Nova conversa
                  </button>
                  {!app.demo && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setPrivacyOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      Privacidade da conversa
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAboutOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Sobre as respostas
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="nexo-chat">
          {!messages.length && (
            <div className="chat-intro nexo-empty">
              <Brand compact />
              <h2>O que você quer saber?</h2>
              <div className="suggestions nexo-suggestions">
                {suggestions.map((question) => (
                  <Button key={question} variant="secondary" onClick={() => void send(question)}>
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="chat-messages" role="log" aria-label="Conversa com Nexo">
            {messages.map((m) => (
              <article
                className={`chat-message ${m.role}`}
                key={m.id}
                aria-label={m.role === 'user' ? 'Sua mensagem' : 'Resposta do Nexo'}
              >
                {m.role === 'user' ? (
                  <p>{visible ? m.text : redactFinancialText(m.text)}</p>
                ) : (
                  renderAnswer(m)
                )}
              </article>
            ))}
          </div>
          {pending && <TypingIndicator />}
          {error && (
            <div className="nexo-error" role="alert">
              <p>Não consegui responder agora. Sua pergunta não foi perdida.</p>
              <Button variant="secondary" onClick={() => void send(input || messages.at(-1)?.text || '')}>
                Tentar novamente
              </Button>
              <small>{error}</small>
            </div>
          )}
          {messages.some((message) => message.role === 'assistant') && (
            <div className="nexo-followups" aria-label="Perguntas relacionadas">
              {followups.map((question) => (
                <Button
                  key={question}
                  variant="secondary"
                  onClick={() => void send(question)}
                  disabled={pending}
                >
                  {question}
                </Button>
              ))}
            </div>
          )}
          <div className="nexo-composer-dock">
            {plusOpen && (
              <div className="nexo-attach-menu" role="menu">
                <Link role="menuitem" to="/recibo" onClick={() => setPlusOpen(false)}>
                  <Camera size={18} /> Fotografar recibo ou enviar imagem
                </Link>
                <Link role="menuitem" to="/importar" onClick={() => setPlusOpen(false)}>
                  <FileUp size={18} /> Enviar extrato
                </Link>
              </div>
            )}
            <form
              className="chat-composer nexo-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                aria-label="Adicionar imagem ou extrato"
                aria-expanded={plusOpen}
                onClick={() => setPlusOpen((open) => !open)}
              >
                <Plus size={20} />
              </Button>
              <input
                aria-label="Sua pergunta para o Nexo"
                placeholder="Pergunte sobre seu dinheiro…"
                maxLength={2000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                aria-label="Falar com o Nexo"
                onClick={() => void startVoice()}
                disabled={pending}
              >
                <Mic size={20} />
              </Button>
              <Button type="submit" disabled={pending || !input.trim()} aria-label="Enviar pergunta">
                <Send size={18} />
              </Button>
            </form>
          </div>
        </div>
      </section>
      {privacyOpen && (
        <Dialog title="Privacidade da conversa" onClose={() => setPrivacyOpen(false)}>
          <div className="simple-form">
            <label className="check-label">
              <input
                type="checkbox"
                checked={saveHistory}
                onChange={(event) => setSaveHistory(event.target.checked)}
              />
              <span>Salvar minhas conversas</span>
            </label>
            <p className="muted">
              Desativado por padrão. Quando ativado, perguntas e respostas são salvas na sua conta. Você pode
              mudar esta preferência quando quiser.
            </p>
          </div>
        </Dialog>
      )}
      {aboutOpen && (
        <Dialog title="Sobre as respostas do Nexo" onClose={() => setAboutOpen(false)}>
          <div className="simple-form">
            <p>
              O Nexo usa seus registros e cálculos verificáveis para ajudar a entender decisões financeiras.
              Simulações dependem das premissas informadas e não garantem resultados.
            </p>
            <p>Os valores registrados no app não são saldo bancário confirmado.</p>
          </div>
        </Dialog>
      )}
      {voiceOpen && (
        <div className="nexo-voice-overlay" role="dialog" aria-modal="true" aria-label="Nexo Voz">
          <header>
            <h1>Nexo</h1>
            <Button variant="ghost" aria-label="Fechar Nexo Voz" onClick={() => stopVoice(true)}>
              <X size={20} />
            </Button>
          </header>
          <div className={`nexo-voice-orb${voiceRecording ? ' is-recording' : ''}`}>
            <Brand compact />
          </div>
          <h2>
            {voiceError
              ? 'Não consegui iniciar a conversa por voz.'
              : voiceRecording
                ? 'Pode falar.'
                : 'Preparando o microfone…'}
          </h2>
          {voiceError && <p role="alert">{voiceError}</p>}
          <div className="nexo-voice-actions">
            {voiceRecording && (
              <Button variant="danger" onClick={() => stopVoice(false)}>
                <span className="voice-record-dot" /> Encerrar
              </Button>
            )}
            {!app.demo && (
              <label className="button button-secondary">
                <Mic size={18} /> Escolher áudio
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setVoiceOpen(false);
                      voiceReplyRef.current = true;
                      void audio(file);
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            )}
            <Button variant="secondary" onClick={() => stopVoice(true)}>
              <Keyboard size={18} /> Usar teclado
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
