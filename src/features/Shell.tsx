import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import { Home, NotebookPen, MessageCircle, Settings, CircleHelp } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useApp } from '../data/context';
import { Brand, Button } from '../design-system/components';
import { ThemeToggle } from '../design-system/theme';
import { OfflineStatus } from './OfflineStatus';
export { Brand } from '../design-system/components';

const navigation = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/movimentos', label: 'Anotações', icon: NotebookPen },
  { to: '/integracoes', label: 'WhatsApp', icon: MessageCircle },
  { to: '/perfil', label: 'Ajustes', icon: Settings },
];
export function Shell() {
  const app = useApp();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);
  if (!app.authReady || !app.mfaReady || app.loading)
    return (
      <div className="center-loading" role="status">
        Abrindo seu Nexo…
      </div>
    );
  if (!app.demo && !app.user) return <Navigate to="/login" replace />;
  if (!app.demo && app.mfaRequired) return <Navigate to="/seguranca" replace />;
  if (!app.data.profile.onboarded && !app.error) return <Navigate to="/onboarding" replace />;
  return (
    <div className="simple-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <header className="simple-topbar">
        <Link to="/inicio" aria-label="Nexo início">
          <Brand />
        </Link>
        <span className="workspace-label">Finanças pessoais</span>
        <div className="simple-topbar-actions">
          <ThemeToggle />
          <Link to="/ajuda" className="button button-ghost" title="Preciso de ajuda">
            <CircleHelp size={20} />
            <span>Preciso de ajuda</span>
          </Link>
          <Link to="/perfil" className="simple-profile" aria-label="Abrir meus ajustes">
            {app.data.profile.name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>
      <nav className="simple-nav" aria-label="Principal">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end>
            <Icon size={24} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main id="main-content" ref={main} tabIndex={-1} className="simple-content" data-page={pathname}>
        <OfflineStatus />
        {app.demo && (
          <div className="simple-demo">
            Você está experimentando com dados de exemplo. <Link to="/cadastro">Criar minha conta</Link>
          </div>
        )}
        {app.error ? (
          <div className="card simple-form">
            <h1>Não conseguimos abrir suas anotações.</h1>
            <p>Confira a conexão com a internet e tente de novo.</p>
            <Button onClick={() => void app.refresh()}>Tentar novamente</Button>
            <Button variant="secondary" onClick={() => void app.signOut()}>
              Sair da conta
            </Button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
