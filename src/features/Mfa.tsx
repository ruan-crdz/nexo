import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Button } from '../design-system/components';
import { ProfileSubpageLayout, SettingsRow } from './ProfileSubpageLayout';

async function withTimeout<Value>(promise: Promise<Value>, milliseconds = 12000) {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('timeout')), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export function MfaPage() {
  const app = useApp(),
    [factors, setFactors] = useState<{ id: string; friendly_name?: string; status: string }[]>([]),
    [factorStatusReady, setFactorStatusReady] = useState(false),
    [factorRequest, setFactorRequest] = useState(0),
    [factorId, setFactorId] = useState(''),
    [secret, setSecret] = useState(''),
    [qr, setQr] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let current = true;
    setFactorStatusReady(false);
    if (!supabase || !app.user) {
      setFactorStatusReady(true);
      return () => {
        current = false;
      };
    }
    void withTimeout(supabase.auth.mfa.listFactors())
      .then(({ data, error }) => {
        if (!current) return;
        if (error) setError('Não foi possível consultar a proteção da conta.');
        else {
          setFactors(data.totp);
          setFactorId(data.totp.find((factor) => factor.status === 'verified')?.id ?? '');
        }
      })
      .catch(() => {
        if (current) setError('Não consegui consultar agora. Tente novamente.');
      })
      .finally(() => {
        if (current) setFactorStatusReady(true);
      });
    return () => {
      current = false;
    };
  }, [app.user, factorRequest]);
  if (app.authReady && !app.user && !app.demo) return <Navigate to="/login" replace />;
  async function enroll() {
    setPending(true);
    try {
      const result = await withTimeout(
        supabase!.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `Nexo ${new Date().toISOString().slice(0, 10)}`,
        }),
      );
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      setQr(result.data.totp.qr_code);
      setSecret(result.data.totp.secret);
      setError('');
    } catch {
      setError('Não foi possível iniciar. Verifique fatores pendentes no seu projeto Supabase.');
    } finally {
      setPending(false);
    }
  }
  async function verify() {
    setPending(true);
    try {
      const result = await withTimeout(supabase!.auth.mfa.challengeAndVerify({ factorId, code }));
      if (result.error) throw result.error;
      location.hash = '/inicio';
      location.reload();
    } catch {
      setError('Código inválido ou expirado. Tente o próximo código do autenticador.');
    } finally {
      setPending(false);
    }
  }
  async function removeFactor(id: string) {
    setPending(true);
    setError('');
    try {
      const result = await withTimeout(supabase!.auth.mfa.unenroll({ factorId: id }));
      if (result.error) throw result.error;
      location.reload();
    } catch {
      setError('Não foi possível remover. Verifique o código do autenticador e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="profile-standalone">
      <ProfileSubpageLayout
        title={app.mfaRequired ? 'Confirme que é você' : 'Proteção'}
        showBack={!app.mfaRequired}
      >
        <section className="profile-security-section">
          <div className="profile-service-mark" aria-hidden="true">
            <ShieldCheck size={30} />
          </div>
          <h2>{app.mfaRequired ? 'Confirme que é você' : 'Proteja ainda mais sua conta'}</h2>
          {!app.mfaRequired && (
            <p className="muted">Use um aplicativo autenticador para adicionar uma segunda verificação.</p>
          )}
          {!app.demo && !app.mfaRequired && factorStatusReady && (
            <p role="status" className="notice">
              {factors.some((factor) => factor.status === 'verified')
                ? 'Autenticador TOTP ativo nesta conta.'
                : 'Nenhum autenticador TOTP configurado.'}
            </p>
          )}
          {!factorStatusReady && !app.demo && <p role="status">Conferindo proteção…</p>}
          {error.includes('consultar agora') && (
            <Button variant="secondary" onClick={() => setFactorRequest((value) => value + 1)}>
              Tentar novamente
            </Button>
          )}
          {app.demo ? (
            <div className="profile-demo-guard">
              <p className="notice">A proteção em duas etapas está disponível em uma conta real.</p>
              <Link className="button button-primary" to="/cadastro">
                Criar minha conta
              </Link>
              <Link className="profile-secondary-link" to="/perfil">
                Voltar ao Perfil
              </Link>
            </div>
          ) : (
            <>
              {!factorId && (
                <Button onClick={() => void enroll()} disabled={pending || !factorStatusReady}>
                  Ativar autenticação em duas etapas
                </Button>
              )}
              {qr && (
                <div className="profile-otp-setup">
                  <h3>Escaneie o QR Code</h3>
                  <img
                    src={qr.startsWith('data:') ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
                    width={200}
                    height={200}
                    alt="QR code para cadastrar o Nexo no autenticador"
                  />
                  <details className="profile-disclosure">
                    <summary>Usar chave manual</summary>
                    <div className="profile-disclosure-content">
                      <code>{secret}</code>
                      <p className="muted">Guarde a chave em local seguro. Não a compartilhe.</p>
                    </div>
                  </details>
                  <h3>Digite o código de 6 dígitos</h3>
                  <form
                    className="profile-otp-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void verify();
                    }}
                  >
                    <label>
                      Código do autenticador
                      <input
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                      />
                    </label>
                    <Button disabled={pending} type="submit">
                      {pending ? 'Verificando…' : 'Confirmar'}
                    </Button>
                  </form>
                </div>
              )}
              {app.mfaRequired && factorId && !qr && (
                <form
                  className="profile-otp-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void verify();
                  }}
                >
                  <label>
                    Código de 6 dígitos
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  </label>
                  <Button disabled={pending} type="submit">
                    {pending ? 'Verificando…' : 'Confirmar'}
                  </Button>
                </form>
              )}
              {!app.mfaRequired &&
                factors
                  .filter((f) => f.status === 'verified')
                  .map((f) => (
                    <div className="profile-mfa-active" key={f.id}>
                      <p className="profile-inline-status" role="status">
                        <ShieldCheck size={20} /> Sua conta está protegida.
                      </p>
                      <p>Autenticação em duas etapas ativa</p>
                      <SettingsRow
                        title="Remover autenticação"
                        danger
                        disabled={pending}
                        onClick={() => void removeFactor(f.id)}
                      />
                    </div>
                  ))}
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {!app.demo && (
            <div className="profile-form-actions">
              <Button
                variant="ghost"
                onClick={() =>
                  void app.signOut().then(() => {
                    location.hash = '/login';
                  })
                }
              >
                Sair
              </Button>
            </div>
          )}
        </section>
      </ProfileSubpageLayout>
    </main>
  );
}
