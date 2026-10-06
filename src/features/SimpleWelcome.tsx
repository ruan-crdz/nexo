import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MessageCircle, Mic, CheckCircle2 } from 'lucide-react';
import { useApp } from '../data/context';
import { Brand, Button, Card } from '../design-system/components';

export function SimpleLanding() {
  const app = useApp();
  const navigate = useNavigate();
  if (app.authReady && app.user && !app.demo) return <Navigate to="/inicio" replace />;
  return (
    <div className="simple-welcome">
      <header>
        <Brand />
        <Link className="button button-secondary" to="/login">
          Já tenho conta
        </Link>
      </header>
      <main>
        <section className="welcome-copy">
          <p className="eyebrow">Seu dinheiro, sem complicação</p>
          <h1>
            Conte o que gastou.
            <br />O Nexo anota para você.
          </h1>
          <p>
            Mande uma mensagem ou um áudio pelo WhatsApp. Depois, veja aqui o que entrou, o que saiu e o que
            sobrou no mês.
          </p>
          <Link className="button button-primary" to="/cadastro">
            Começar a usar
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              app.enterDemo();
              navigate('/inicio');
            }}
          >
            Experimentar sem cadastro
          </Button>
          <small className="muted">A experiência usa valores de exemplo.</small>
        </section>
        <Card className="welcome-conversation">
          <div className="welcome-chat-header">
            <MessageCircle size={28} />
            <div>
              <h2>Nexo no WhatsApp</h2>
              <p>Exemplo de conversa</p>
            </div>
          </div>
          <div className="chat-example-user">
            <Mic size={22} />
            <p>“Gastei 30 reais na farmácia hoje.”</p>
          </div>
          <div className="chat-example-nexo">
            <CheckCircle2 size={22} />
            <p>Anotado! Um gasto de R$ 30,00 na farmácia.</p>
          </div>
          <p className="muted">Você pode conferir e corrigir os movimentos no app.</p>
        </Card>
      </main>
      <footer>Simples de anotar. Fácil de acompanhar.</footer>
    </div>
  );
}

export function SimpleOnboarding() {
  const app = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!app.authReady || app.loading || !app.mfaReady)
    return (
      <main className="center-loading" role="status">
        Abrindo sua conta…
      </main>
    );
  if (!app.user && !app.demo) return <Navigate to="/login" replace />;
  if (!app.demo && app.mfaRequired) return <Navigate to="/seguranca" replace />;
  if (app.data.profile.onboarded) return <Navigate to="/inicio" replace />;
  async function start(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await app.repository.profile({ ...app.data.profile, name: name.trim(), onboarded: true });
      await app.refresh();
      navigate('/integracoes');
    } catch {
      setError('Não foi possível salvar seu nome. Confira a conexão e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="simple-onboarding">
      <Brand />
      <h1>Como podemos chamar você?</h1>
      <p>Só precisamos do seu nome para começar. Depois, vamos conectar seu WhatsApp.</p>
      <form className="simple-form" onSubmit={(e) => void start(e)}>
        <label>
          Seu nome
          <input
            required
            maxLength={80}
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <Button disabled={pending}>{pending ? 'Salvando…' : 'Continuar'}</Button>
      </form>
    </main>
  );
}
