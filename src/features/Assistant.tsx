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
import { personalSummary, weeklyPlan } from '../../shared/insights';
import { Badge, Brand, Button, PageHeader, Why } from '../design-system/components';

type Reply = {
  answer: string;
  metrics: Record<string, string>;
  sources: { id: string; title: string; url: string; level: string }[];
  evidence_status: string;
  engine_version: string;
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; reply?: Reply };
const labels: Record<string, string> = {
  balance: 'Saldo',
  income: 'Entradas',
  expenses: 'Saídas',
  free: 'Livre para planejar',
  reserve: 'Reserva',
  debt: 'Dívidas',
  net_worth: 'Patrimônio líquido',
  upcoming_bills: 'Contas previstas',
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
        const s = personalSummary(app.data);
        reply = {
          answer: `Esta é uma explicação local da demonstração, sem chamada de IA.\n\nSeu próximo marco: ${s.milestone.title}.\n\n${weeklyPlan(
            app.data,
          )
            .map((p, i) => `${i + 1}. ${p.title}`)
            .join('\n')}\n\nPara avaliar uma compra específica, abra “Futuro se…”.`,
          metrics: {
            balance: displayMoney(s.balance),
            free: displayMoney(s.free),
            reserve: displayMoney(s.reserve),
          },
          sources: [],
          evidence_status: 'demo',
          engine_version: '1.0.0',
        };
      } else {
        reply = await invoke<Reply>('ai-chat', {
          question,
          save_history: saveHistory,
          ...(business && app.organizationId ? { organization_id: app.organizationId } : {}),
        });
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: reply.answer, reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder.');
      setInput(question);
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
        action={
          <Badge tone="green">
            {app.demo ? 'Explicação local · demo' : 'IA + motor financeiro + fontes'}
          </Badge>
        }
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
                <h2>{visible ? m.text : redactFinancialText(m.text)}</h2>
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
                          : 'Não houve evidência suficiente para uma orientação específica.'}
                      </p>
                    )}
                  </Why>
                </>
              )}
            </div>
          ))}
        </div>
        {pending && (
          <p className="muted" role="status" style={{ padding: 20 }}>
            Preparando uma resposta com contexto…
          </p>
        )}
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
          <label className="button button-secondary">
            <Mic size={18} />
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              aria-label="Enviar áudio para transcrição"
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
