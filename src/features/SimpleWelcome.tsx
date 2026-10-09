import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Mic, CheckCircle2 } from 'lucide-react';
import { useApp } from '../data/context';
import { startFeatureTour } from '../data/feature-tour';
import {
  clearOnboardingStep,
  readOnboardingStep,
  saveOnboardingStep,
  type OnboardingStep,
} from '../data/onboarding-progress';
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
  const location = useLocation();
  const initialStep = new URLSearchParams(location.search).get('step');
  const identity = app.demo ? 'demo' : app.user?.id ?? null;
  const requestedStep: OnboardingStep | null =
    initialStep === 'name' || initialStep === 'whatsapp' || initialStep === 'objective'
      ? initialStep
      : null;
  const [step, setStep] = useState<OnboardingStep>(requestedStep ?? 'name');
  const [progressRestored, setProgressRestored] = useState(false);
  const [name, setName] = useState(app.data.profile.name);
  const [objective, setObjective] = useState(app.data.profile.objective);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!app.authReady || app.loading || (!app.demo && !app.user)) return;
    const nextStep = requestedStep ?? (identity ? readOnboardingStep(identity) : null) ?? 'name';
    setStep(nextStep);
    setProgressRestored(true);
  }, [app.authReady, app.demo, app.loading, app.user, identity, location.search, requestedStep]);
  useEffect(() => {
    if (identity && progressRestored) saveOnboardingStep(identity, step);
  }, [identity, progressRestored, step]);
  if (!app.authReady || app.loading || !app.mfaReady)
    return (
      <main className="center-loading" role="status">
        Abrindo sua conta…
      </main>
    );
  if (!app.user && !app.demo) return <Navigate to="/login" replace />;
  if (!app.demo && app.mfaRequired) return <Navigate to="/seguranca" replace />;
  if (app.data.profile.onboarded) return <Navigate to="/inicio" replace />;
  if (!progressRestored)
    return (
      <main className="center-loading" role="status">
        Retomando seu cadastro…
      </main>
    );
  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError('');
    try {
      await app.repository.profile({ ...app.data.profile, name: name.trim(), onboarded: false });
      await app.refresh();
      setStep('objective');
      navigate('/onboarding?step=objective', { replace: true });
    } catch {
      setError('Não foi possível salvar seu nome. Confira a conexão e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function saveObjective(value: string) {
    setPending(true);
    setError('');
    try {
      await app.repository.profile({
        ...app.data.profile,
        name: name.trim(),
        objective: value,
        onboarded: false,
      });
      await app.refresh();
      setObjective(value);
      setStep('whatsapp');
      navigate('/onboarding?step=whatsapp', { replace: true });
    } catch {
      setError('Não foi possível salvar sua preferência. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function finish() {
    setPending(true);
    setError('');
    try {
      const tourIdentity = app.demo ? 'demo' : app.user?.id;
      if (tourIdentity) {
        startFeatureTour(tourIdentity);
        clearOnboardingStep(tourIdentity);
      }
      await app.repository.profile({
        ...app.data.profile,
        name: name.trim(),
        objective,
        onboarded: true,
        feature_tour_completed: false,
      });
      await app.refresh();
      navigate('/tour', { replace: true });
    } catch {
      setError('Não foi possível salvar sua preferência. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="simple-onboarding">
      <Brand />
      <p className="onboarding-progress">
        {step === 'name' ? '1 de 3' : step === 'objective' ? '2 de 3' : '3 de 3'}
      </p>
      {step === 'name' && (
        <>
          <h1>Como podemos chamar você?</h1>
          <p>Organizar seu dinheiro pode ser simples. Você fala. O Nexo organiza.</p>
          <form className="simple-form" onSubmit={(event) => void saveName(event)}>
            <label>
              Seu nome
              <input
                required
                maxLength={80}
                autoComplete="given-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending}>{pending ? 'Salvando…' : 'Continuar'}</Button>
          </form>
        </>
      )}
      {step === 'objective' && (
        <form
          className="simple-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveObjective(objective);
          }}
        >
          <h1>O que você mais quer melhorar?</h1>
          <div className="onboarding-objectives" role="group" aria-label="Seu objetivo principal">
            {['Sair das dívidas', 'Guardar dinheiro', 'Me organizar', 'Conquistar algo'].map((option) => (
              <Button
                key={option}
                type="button"
                variant={objective === option ? 'primary' : 'secondary'}
                aria-pressed={objective === option}
                onClick={() => setObjective(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button disabled={pending || !objective}>{pending ? 'Salvando…' : 'Continuar'}</Button>
          <Button variant="ghost" type="button" disabled={pending} onClick={() => void saveObjective('')}>
            Pular por enquanto
          </Button>
        </form>
      )}
      {step === 'whatsapp' && (
        <section className="onboarding-step">
          <h1>Use pelo WhatsApp</h1>
          <p>Envie gastos, entradas ou áudios normalmente.</p>
          <div className="chat-example-user">“gastei 10 na coxinha”</div>
          <div className="chat-example-nexo">
            <strong>Nexo</strong>
            <p>R$ 10 · Alimentação</p>
          </div>
          <Link className="button button-primary" to="/integracoes?onboarding=1">
            Conectar WhatsApp
          </Link>
          <Button variant="secondary" disabled={pending} onClick={() => void finish()}>
            Conectar depois
          </Button>
        </section>
      )}
    </main>
  );
}
