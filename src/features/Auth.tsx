import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Sprout, ShieldCheck, MessageCircle, Compass } from 'lucide-react';
import { supabase, configured } from '../data/client';
import { useApp } from '../data/context';
import { Button, Card, Progress } from '../design-system/components';
import { Brand } from './Shell';
import { ThemeToggle } from '../design-system/theme';
import { parseMoney } from '../../shared/financial-engine';

export function Landing() {
  const app = useApp(),
    navigate = useNavigate();
  return (
    <div className="landing">
      <nav>
        <Link to="/">
          <Brand />
        </Link>
        <div className="landing-actions">
          <ThemeToggle />
          <Link className="button button-ghost" to="/login">
            Entrar
          </Link>
          <Link className="button button-primary" to="/cadastro">
            Começar
            <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <div>
          <p className="eyebrow">Menos ruído. Mais direção.</p>
          <h1>
            Seu dinheiro precisa levar você <em>a algum lugar.</em>
          </h1>
          <p>
            Entenda seu momento, encontre seu próximo marco e transforme escolhas de hoje em possibilidades
            para amanhã.
          </p>
          <div className="landing-actions">
            <Button
              onClick={() => {
                app.enterDemo();
                navigate('/inicio');
              }}
            >
              Explorar demonstração
              <ArrowRight size={16} />
            </Button>
            <Link to="/cadastro" className="button button-secondary">
              Criar minha conta
            </Link>
          </div>
          <p style={{ fontSize: 11 }}>Demonstração com dados fictícios. Sem cadastro ou cartão.</p>
        </div>
        <div className="landing-art" aria-label="Exemplo ilustrativo de progresso de reserva">
          <Card>
            <div className="journey-header">
              <Sprout size={16} />
              Um futuro mais tranquilo
            </div>
            <h2>Uma reserva para respirar.</h2>
            <strong>
              R$ 7.200
              <span className="muted" style={{ fontSize: 14 }}>
                {' '}
                / R$ 10.200
              </span>
            </strong>
            <Progress value={70.6} label="Exemplo: 71% da meta" />
            <p style={{ fontSize: 12, marginBottom: 0 }}>Um passo de cada vez. Na sua direção.</p>
          </Card>
        </div>
      </section>
      <div className="grid grid-3 landing-features">
        {[
          {
            icon: Compass,
            title: 'Saiba seu próximo passo',
            text: 'Marcos que partem da sua realidade. Sem comparação, pressão ou julgamento.',
          },
          {
            icon: MessageCircle,
            title: 'Fale do seu jeito',
            text: 'Registros e perguntas em português. Integração oficial com WhatsApp configurável.',
          },
          {
            icon: ShieldCheck,
            title: 'Entenda o porquê',
            text: 'Cálculos explicáveis, premissas visíveis e controle sobre seus próprios dados.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <Icon size={23} />
            <h3>{title}</h3>
            <p>{text}</p>
          </Card>
        ))}
      </div>
      <footer className="app-footer" style={{ marginBottom: 30 }}>
        <span>Nexo · Seu próximo passo.</span>
        <Link to="/login">Pessoal e Empresas, na mesma direção.</Link>
      </footer>
    </div>
  );
}
export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' | 'recovery' | 'reset' }) {
  const app = useApp(),
    navigate = useNavigate(),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const titles = {
    login: 'Bom ter você por aqui.',
    signup: 'Um novo começo para seu dinheiro.',
    recovery: 'Vamos recuperar seu acesso.',
    reset: 'Escolha sua nova senha.',
  };
  if (app.authReady && app.user && !app.demo && mode === 'login') return <Navigate to="/inicio" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    setMessage('');
    try {
      if (!supabase)
        throw new Error(
          'Cadastro e login precisam de um projeto Supabase conectado. Você pode explorar a demonstração agora.',
        );
      const redirect = `${location.origin}${import.meta.env.BASE_URL}`;
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        sessionStorage.removeItem('nexo.mode');
        location.hash = '/inicio';
        location.reload();
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        setMessage('Confira seu e-mail para confirmar o cadastro. Depois, entre na sua conta.');
      }
      if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirect}#/redefinir-senha`,
        });
        if (error) throw error;
        setMessage('Se houver uma conta com esse e-mail, você receberá as instruções.');
      }
      if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Senha atualizada. Você já pode entrar.');
      }
    } catch {
      setError(
        configured
          ? 'Não foi possível concluir. Confira os dados e tente novamente.'
          : 'Conecte o Supabase para cadastrar uma conta real. A demonstração está disponível abaixo.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link to="/">
          <Brand />
        </Link>
        <div>
          <h1>
            Mais do que organizar.
            <br />
            Encontrar direção.
          </h1>
          <p>Seu dinheiro faz parte da sua vida. Vamos cuidar dos próximos passos juntos.</p>
        </div>
        <small>Um passo de cada vez. Na direção que importa.</small>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <h1>{titles[mode]}</h1>
          <p>
            {mode === 'signup'
              ? 'Comece simples. O Nexo aprende com os seus registros.'
              : 'Seu espaço para decidir com mais clareza.'}
          </p>
          <form onSubmit={(e) => void submit(e)}>
            {mode !== 'reset' && (
              <label>
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            )}
            {mode !== 'recovery' && (
              <label>
                Senha
                <input
                  type="password"
                  minLength={12}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <small>Pelo menos 12 caracteres.</small>
              </label>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <Button disabled={pending} type="submit">
              {pending
                ? 'Aguarde…'
                : mode === 'login'
                  ? 'Entrar'
                  : mode === 'signup'
                    ? 'Criar conta'
                    : mode === 'reset'
                      ? 'Salvar nova senha'
                      : 'Enviar instruções'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="auth-links">
            <Link to={mode === 'login' ? '/cadastro' : '/login'} className="text-link">
              {mode === 'login' ? 'Criar conta' : 'Voltar ao login'}
            </Link>
            {mode === 'login' && (
              <Link to="/recuperar" className="text-link">
                Esqueci minha senha
              </Link>
            )}
          </div>
          <div className="auth-divider">ou conheça primeiro</div>
          <Button
            variant="secondary"
            style={{ width: '100%' }}
            onClick={() => {
              app.enterDemo();
              navigate('/inicio');
            }}
          >
            Explorar demonstração
          </Button>
        </div>
      </section>
    </div>
  );
}
export function Onboarding() {
  const app = useApp(),
    navigate = useNavigate(),
    [step, setStep] = useState(0),
    [objective, setObjective] = useState('Organizar meu dinheiro'),
    [name, setName] = useState(''),
    [income, setIncome] = useState(''),
    [expenses, setExpenses] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  if (!app.user && !app.demo && app.authReady) return <Navigate to="/login" replace />;
  async function finish() {
    setPending(true);
    try {
      await app.repository.profile({
        ...app.data.profile,
        name: name.trim() || 'Você',
        objective,
        monthly_income: income ? parseMoney(income) : 0,
        fixed_expenses: expenses ? parseMoney(expenses) : 0,
        onboarded: true,
      });
      await app.refresh();
      navigate('/inicio');
    } catch {
      setError('Confira os valores. Use, por exemplo, 2.500,00.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="onboarding">
      <Brand />
      <p className="eyebrow" style={{ marginTop: 35 }}>
        Seu começo · {step + 1} de 3
      </p>
      <Progress value={((step + 1) / 3) * 100} label="Progresso da configuração" />
      {step === 0 ? (
        <>
          <h1>O que trouxe você até aqui?</h1>
          <p className="muted">Não existe uma resposta certa. Vamos começar pelo que importa agora.</p>
          <div className="choice-grid">
            {[
              'Sair das dívidas',
              'Organizar meu dinheiro',
              'Parar de viver no limite',
              'Criar reserva',
              'Comprar algo',
              'Começar a investir',
              'Construir patrimônio',
              'Planejar meu futuro',
            ].map((o) => (
              <button
                key={o}
                className={`choice ${o === objective ? 'selected' : ''}`}
                onClick={() => setObjective(o)}
                aria-pressed={o === objective}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      ) : step === 1 ? (
        <>
          <h1>Como podemos chamar você?</h1>
          <label>
            Seu nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="given-name"
            />
          </label>
          <p className="muted" style={{ marginTop: 18 }}>
            Você pode completar as outras informações aos poucos.
          </p>
        </>
      ) : (
        <>
          <h1>Uma ideia do seu mês.</h1>
          <p className="muted" style={{ marginBottom: 24 }}>
            Pode ser aproximado. Se não souber, deixe em branco e continue.
          </p>
          <div className="stack">
            <label>
              Renda mensal aproximada (R$)
              <input
                inputMode="decimal"
                placeholder="Não sei ainda"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </label>
            <label>
              Despesas fixas aproximadas (R$)
              <input
                inputMode="decimal"
                placeholder="Não sei ainda"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
              />
            </label>
          </div>
        </>
      )}
      {error && <p className="error-message">{error}</p>}
      <div className="form-actions">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        )}
        <Button disabled={pending} onClick={() => (step < 2 ? setStep(step + 1) : void finish())}>
          {step < 2 ? 'Continuar' : 'Entrar no meu Nexo'}
          <ArrowRight size={16} />
        </Button>
      </div>
    </main>
  );
}
