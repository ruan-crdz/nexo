import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../data/context';
import { supabase } from '../data/client';
import { Brand } from './Shell';
import { Button, Card } from '../design-system/components';
export function MfaPage() {
  const app = useApp(),
    [factors, setFactors] = useState<{ id: string; friendly_name?: string; status: string }[]>([]),
    [factorStatusReady, setFactorStatusReady] = useState(false),
    [factorId, setFactorId] = useState(''),
    [secret, setSecret] = useState(''),
    [qr, setQr] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (supabase && app.user)
      void supabase.auth.mfa.listFactors().then(({ data, error }) => {
        if (error) setError('Não foi possível consultar a autenticação.');
        else {
          setFactors(data.totp);
          setFactorId(data.totp.find((f) => f.status === 'verified')?.id ?? '');
        }
        setFactorStatusReady(true);
      });
    else setFactorStatusReady(true);
  }, [app.user]);
  if (app.authReady && !app.user && !app.demo) return <Navigate to="/login" replace />;
  async function enroll() {
    setPending(true);
    try {
      const result = await supabase!.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Nexo ${new Date().toISOString().slice(0, 10)}`,
      });
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
      const result = await supabase!.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      location.hash = '/inicio';
      location.reload();
    } catch {
      setError('Código inválido ou expirado. Tente o próximo código do autenticador.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="onboarding">
      <Link to="/">
        <Brand />
      </Link>
      <h1>{app.mfaRequired ? 'Confirme que é você.' : 'Proteção'}</h1>
      <Card>
        <h2>Autenticação em duas etapas</h2>
        {!app.demo && !app.mfaRequired && factorStatusReady && (
          <p role="status" className="notice">
            {factors.some((factor) => factor.status === 'verified')
              ? 'Autenticador TOTP ativo nesta conta.'
              : 'Nenhum autenticador TOTP configurado.'}
          </p>
        )}
        <p className="muted">
          Use um aplicativo autenticador compatível com TOTP. O código protege o acesso aos seus dados, além
          da senha.
        </p>
        {app.demo ? (
          <p className="notice" style={{ marginTop: 20 }}>
            MFA está disponível para contas reais conectadas ao Supabase.
          </p>
        ) : (
          <>
            {!factorId && (
              <Button onClick={() => void enroll()} disabled={pending} style={{ marginTop: 20 }}>
                Configurar autenticador
              </Button>
            )}
            {qr && (
              <div className="stack" style={{ marginTop: 20 }}>
                <img
                  src={qr.startsWith('data:') ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
                  width={200}
                  height={200}
                  alt="QR code para cadastrar o Nexo no autenticador"
                />
                <p>Se preferir, adicione manualmente esta chave ao autenticador:</p>
                <code style={{ overflowWrap: 'anywhere' }}>{secret}</code>
                <small className="muted">Guarde a chave em local seguro. Não a compartilhe.</small>
              </div>
            )}
            {factorId && (
              <form
                className="stack"
                style={{ marginTop: 24 }}
                onSubmit={(e) => {
                  e.preventDefault();
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
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <Button disabled={pending} type="submit">
                  Verificar código
                </Button>
              </form>
            )}
            {!app.mfaRequired &&
              factors
                .filter((f) => f.status === 'verified')
                .map((f) => (
                  <div className="settings-row" key={f.id}>
                    <span>{f.friendly_name ?? 'Autenticador ativo'}</span>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void supabase!.auth.mfa.unenroll({ factorId: f.id }).then(({ error }) => {
                          if (error) setError('Verifique um código antes de remover o autenticador.');
                          else location.reload();
                        });
                      }}
                    >
                      Remover fator
                    </Button>
                  </div>
                ))}
          </>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="form-actions">
          {!app.mfaRequired && (
            <Link to="/perfil" className="button button-secondary">
              Voltar ao perfil
            </Link>
          )}
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
      </Card>
    </main>
  );
}
