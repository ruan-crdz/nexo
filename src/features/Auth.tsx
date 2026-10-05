import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase, configured } from '../data/client';
import { useApp } from '../data/context';
import { Button } from '../design-system/components';
import { Brand } from './Shell';

export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' | 'recovery' | 'reset' }) {
  const app = useApp(),
    navigate = useNavigate(),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const titles = {
    login: 'Entrar na minha conta',
    signup: 'Criar minha conta',
    recovery: 'Esqueci minha senha',
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
            Seu dinheiro,
            <br />
            sem complicação.
          </h1>
          <p>Anote pelo WhatsApp. Confira tudo por aqui.</p>
        </div>
        <small>Uma anotação de cada vez.</small>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <h1>{titles[mode]}</h1>
          <p>
            {mode === 'signup'
              ? 'Use seu e-mail e escolha uma senha.'
              : mode === 'recovery'
                ? 'Informe seu e-mail. Vamos enviar um link para escolher outra senha.'
                : 'Use seu e-mail e sua senha para continuar.'}
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
              <div className="simple-form">
                <label>
                  Senha
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={12}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {mode !== 'login' && (
                    <small>Use pelo menos 12 caracteres. Pode ser uma frase fácil de lembrar.</small>
                  )}
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Esconder senha' : 'Mostrar senha'}
                </Button>
              </div>
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
              {mode === 'login' ? 'Ainda não tenho conta' : 'Voltar para entrar'}
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
            Experimentar sem cadastro
          </Button>
        </div>
      </section>
    </div>
  );
}
