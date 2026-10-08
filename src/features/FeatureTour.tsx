import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Eye,
  Home,
  MessageCircle,
  NotebookPen,
  Target,
  Upload,
} from 'lucide-react';
import {
  completeFeatureTour,
  readFeatureTour,
  startFeatureTour,
  setFeatureTourStep,
} from '../data/feature-tour';
import { useApp } from '../data/context';
import { Brand, Button } from '../design-system/components';

const steps = [
  {
    title: 'Acompanhe seu mês',
    description: 'Na tela inicial, confira o que entrou, o que saiu e o que ainda está reservado.',
    example: 'Resultado dos movimentos e valor livre para planejar, sem confundir com saldo bancário.',
    icon: Home,
  },
  {
    title: 'Converse com o Nexo',
    description: 'Pergunte sobre seus registros ou conte o que aconteceu com suas finanças.',
    example: '“Paguei 32 reais no mercado hoje.” Se faltar um detalhe, o Nexo pergunta.',
    icon: MessageCircle,
  },
  {
    title: 'Anote e revise movimentos',
    description: 'Registre gastos e entradas, consulte o histórico e corrija ou exclua o que precisar.',
    example: 'Também dá para importar um extrato e revisar os dados antes de salvar.',
    icon: NotebookPen,
  },
  {
    title: 'Cuide das suas metas',
    description: 'Defina o que quer alcançar e acompanhe os aportes sem duplicar gastos.',
    example: 'Você vê quanto já guardou, quanto falta e qual próximo passo cabe no seu mês.',
    icon: Target,
  },
  {
    title: 'Organize o planejamento',
    description: 'Reúna contas recorrentes, limites de gastos, dívidas e bens em um só lugar.',
    example: 'Contas futuras entram como previsão; elas não são tratadas como pagas.',
    icon: CalendarDays,
  },
  {
    title: 'Use o WhatsApp do seu jeito',
    description: 'Envie texto ou áudio. Para comprovantes, mande uma foto ou PDF para revisar.',
    example: 'Conecte o WhatsApp quando quiser; você também pode usar tudo pelo app.',
    icon: Upload,
  },
  {
    title: 'Tenha controle da sua privacidade',
    description: 'Oculte valores na tela e configure a proteção da sua conta pelo perfil.',
    example: 'Seus dados são pessoais; recursos de segurança podem exigir uma etapa extra.',
    icon: Eye,
  },
];

export function FeatureTour() {
  const app = useApp();
  const navigate = useNavigate();
  const identity = app.demo ? 'demo' : app.user?.id ?? null;
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!identity || !app.authReady || app.loading) return;
    const progress = readFeatureTour(identity);
    if (progress?.status === 'pending') setStep(Math.min(progress.step, steps.length - 1));
    else if (!progress) startFeatureTour(identity);
    setRestored(true);
  }, [app.authReady, app.loading, identity]);

  async function finish() {
    if (!identity || saving) return;
    setSaving(true);
    setError('');
    try {
      await app.repository.profile({ ...app.data.profile, feature_tour_completed: true });
      await app.refresh();
      completeFeatureTour(identity);
      navigate('/inicio', { replace: true });
    } catch {
      setError('Não foi possível concluir agora. Tente novamente para abrir o Nexo.');
    } finally {
      setSaving(false);
    }
  }

  function advance() {
    if (step === steps.length - 1) {
      void finish();
      return;
    }
    const next = step + 1;
    if (identity) setFeatureTourStep(identity, next);
    setStep(next);
  }

  function goBack() {
    const previous = Math.max(0, step - 1);
    if (identity) setFeatureTourStep(identity, previous);
    setStep(previous);
  }

  if (!app.authReady || !app.mfaReady || app.loading)
    return (
      <main className="center-loading" role="status">
        Abrindo seu Nexo…
      </main>
    );
  if (!app.demo && !app.user) return <Navigate to="/login" replace />;
  if (!app.demo && app.mfaRequired) return <Navigate to="/seguranca" replace />;
  if (!app.data.profile.onboarded && !app.error) return <Navigate to="/onboarding" replace />;
  if (app.data.profile.feature_tour_completed && !app.error) return <Navigate to="/inicio" replace />;
  if (!identity || !restored)
    return (
      <main className="center-loading" role="status">
        Preparando seu tour…
      </main>
    );
  if (readFeatureTour(identity)?.status !== 'pending') return <Navigate to="/inicio" replace />;

  const current = steps[step];
  const Icon = current.icon;
  return (
    <main className="feature-tour" aria-labelledby="feature-tour-title">
      <header className="feature-tour-header">
        <Brand compact />
        <Button variant="ghost" onClick={() => void finish()} disabled={saving}>
          Pular tudo <ArrowRight size={16} />
        </Button>
      </header>
      <section className="feature-tour-content" aria-live="polite" key={step}>
        <div className="feature-tour-progress-row">
          <span>Conheça o Nexo</span>
          <span>
            {step + 1} de {steps.length}
          </span>
        </div>
        <div
          className="feature-tour-progress"
          role="progressbar"
          aria-label="Progresso do tour"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="feature-tour-icon" aria-hidden="true">
          <Icon size={30} strokeWidth={1.8} />
        </div>
        <p className="eyebrow">Passo {step + 1}</p>
        <h1 id="feature-tour-title">{current.title}</h1>
        <p className="feature-tour-description">{current.description}</p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="feature-tour-example">
          <strong>Como funciona</strong>
          <p>{current.example}</p>
        </div>
        <div className="feature-tour-actions">
          <Button variant="secondary" onClick={goBack} disabled={step === 0}>
            <ArrowLeft size={17} /> Voltar
          </Button>
          <Button onClick={advance} disabled={saving}>
            {step === steps.length - 1 ? 'Começar a usar' : 'Continuar'}
            {step !== steps.length - 1 && <ArrowRight size={17} />}
          </Button>
        </div>
      </section>
    </main>
  );
}