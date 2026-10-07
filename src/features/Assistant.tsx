import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Mic, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../data/context';
import {
  redactFinancialText,
  useFinancialVisibility,
  useMoneyDisplay,
} from '../design-system/financial-visibility';
import { invoke } from '../data/client';
import { goalMonthlyBudget, goalMonthlyPlan } from '../../shared/journey';
import { civilDate } from '../../shared/financial-engine';
import { Badge, Brand, Button, PageHeader, Why } from '../design-system/components';

type Reply = {
  answer: string;
  metrics: Record<string, string>;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
  engine_version: string;
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; reply?: Reply };
export function TypingIndicator() {
  return (
    <div className="nexo-typing" role="status" aria-label="Nexo está digitando">
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}
const labels: Record<string, string> = {
  balance: 'Saldo estimado nos registros',
  recorded_surplus: 'Resultado dos movimentos',
  protected_goals: 'Protegido em metas',
  goal_name: 'Meta em foco',
  goal_saved: 'Guardado na meta',
  goal_remaining: 'Falta para a meta',
  goal_deadline: 'Prazo da meta',
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
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [saveHistory, setSaveHistory] = useState(false),
    [business, setBusiness] = useState(false);
  async function send(question = input) {
    if (!question.trim() || pending) return;
    setInput('');
    setError('');
    setPending(true);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: question }]);
    try {
      let reply: Reply;
      if (app.demo) {
        const today = civilDate(new Date(), app.data.profile.timezone);
        const budget = goalMonthlyBudget(app.data, today, app.data.profile.timezone);
        const goal =
          app.data.goals.find((item) => item.id === app.data.profile.active_goal_id) ??
          app.data.goals.find((item) => item.saved < item.target);
        const plan = goal
          ? goalMonthlyPlan(goal, today, budget.available, budget.contributed[goal.id] ?? 0)
          : null;
        reply = {
          answer: `Esta é uma leitura local dos dados de exemplo, sem chamada de IA.\n\n${goal && plan ? (plan.remaining === 0 ? `Você já atingiu a meta ${goal.name}. Pode revisar o objetivo ou manter o valor protegido.` : plan.required === 0 ? `A cota deste mês para ${goal.name} já foi cumprida. Você pode manter o valor protegido sem se pressionar por outro aporte.` : plan.suggested > 0 ? `Para ${goal.name}, faltam ${displayMoney(plan.remaining)}. Pelas anotações atuais, cabe um próximo aporte de ${displayMoney(plan.suggested)} neste mês.${plan.gap > 0 ? ' O prazo pede mais que a sobra atual; você pode ajustar o prazo ou o valor da meta.' : ''}` : `Para ${goal.name}, ainda faltam ${displayMoney(plan.remaining)}, mas não há sobra registrada para um novo aporte agora. Confira as despesas e ajuste o prazo sem comprometer o essencial.`) : `Há ${displayMoney(budget.available)} livres para planejar. Antes de escolher uma meta, confira as contas e necessidades ainda não registradas.`}\n\nNão é saldo bancário confirmado. Para avaliar uma compra, use “Posso gastar?”.`,
          metrics: {
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
          question,
          save_history: saveHistory,
          history: messages
            .slice(-6)
            .map((message) => ({ role: message.role, content: message.text.slice(0, 2000) })),
          ...(business && app.organizationId ? { organization_id: app.organizationId } : {}),
        });
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: reply.answer, reply },
      ]);
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
      setInput(result.text);
      app.toast('Áudio transcrito. Confira o texto antes de enviar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível transcrever.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Nexo"
        title="O que você quer entender?"
        description="Respostas claras, com cálculos e registros que você pode conferir."
        action={<Badge tone="green">{app.demo ? 'Dados de exemplo' : 'Seus registros'}</Badge>}
      />
      <section className="assistant-experience">
        {!messages.length && (
          <div className="chat-intro">
            <Brand compact />
            <h2>Escolha uma pergunta para começar</h2>
            <p>Você também pode escrever ou falar do seu jeito.</p>
            <div className="suggestions">
              {['Como está meu mês?', 'Qual meu próximo passo?', 'Como construir minha reserva?'].map((q) => (
                <Button key={q} variant="secondary" onClick={() => void send(q)}>
                  <Sparkles size={14} />
                  {q}
                </Button>
              ))}
              <Link className="button button-secondary" to="/controle">
                <Calculator size={14} />
                Posso gastar?
              </Link>
            </div>
          </div>
        )}
        <div className="chat-messages" role="log" aria-label="Conversa com Nexo">
          {messages.map((m) => (
            <div className={`chat-message ${m.role}`} key={m.id}>
              <small className="muted">{m.role === 'user' ? 'Você' : 'Nexo'}</small>
              {m.role === 'assistant' && m.reply ? (
                <div className="chat-answer">
                  {(visible ? m.text : redactFinancialText(m.text))
                    .split(/\n\s*\n/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                </div>
              ) : (
                <p>{visible ? m.text : redactFinancialText(m.text)}</p>
              )}
              {m.reply && (
                <>
                  <div className="source-list">
                    {Object.entries(m.reply.metrics).map(([k, v]) => (
                      <div key={k}>
                        <strong>{labels[k] ?? k}:</strong> {visible ? v : redactFinancialText(v)}
                      </div>
                    ))}
                  </div>
                  <Why title="Por que esta resposta?">
                    <p>
                      Valores fornecidos pelo Financial Engine {m.reply.engine_version}. Os números são
                      calculados pelo código; a IA só recebe os resultados.
                    </p>
                    {m.reply.sources.length ? (
                      <div className="source-list">
                        <strong>Fontes utilizadas</strong>
                        {m.reply.sources.map((s) => (
                          <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                            {s.title} · Evidência {s.level}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p>
                        {app.demo
                          ? 'Modo demonstração: sem busca RAG ou recomendação de IA.'
                          : m.reply.evidence_status === 'records'
                            ? 'Resposta baseada nos seus registros e nos cálculos do Nexo. Não foi usada uma fonte externa para esta leitura.'
                            : 'Não há fonte externa verificada para a recomendação específica; os registros abaixo continuam disponíveis para conferência.'}
                      </p>
                    )}
                  </Why>
                </>
              )}
            </div>
          ))}
        </div>
        {pending && <TypingIndicator />}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            aria-label="Sua pergunta para o Nexo"
            placeholder="Pergunte do seu jeito…"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <label className="button button-secondary" title="Enviar áudio para transcrição">
            <Mic size={18} />
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              aria-label="Enviar áudio para transcrição"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void audio(file);
                e.target.value = '';
              }}
            />
          </label>
          <Button type="submit" disabled={pending || !input.trim()} aria-label="Enviar pergunta">
            <Send size={18} />
          </Button>
        </form>
        <div className="stack-sm" style={{ maxWidth: 820, margin: '0 auto' }}>
          {!app.demo && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={saveHistory}
                onChange={(e) => setSaveHistory(e.target.checked)}
              />
              <small>Salvar esta conversa na minha conta</small>
            </label>
          )}
          {!app.demo && app.organizationId && (
            <label className="check-label">
              <input type="checkbox" checked={business} onChange={(e) => setBusiness(e.target.checked)} />
              <small>Consultar a empresa ativa em vez dos dados pessoais</small>
            </label>
          )}
          <small className="muted">
            Orientação educacional. Simulações dependem das premissas e não garantem resultados.
          </small>
        </div>
      </section>
    </>
  );
}
