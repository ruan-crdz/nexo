import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import {
  Home,
  NotebookPen,
  CalendarClock,
  Sparkles,
  Settings,
  CircleHelp,
  Plus,
  Eye,
  EyeOff,
  ShieldCheck,
  Camera,
  Mic,
  MessageCircle,
  FileUp,
  PenLine,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useApp } from '../data/context';
import { Brand, Button, Dialog } from '../design-system/components';
import { ThemeToggle } from '../design-system/theme';
import { OfflineStatus } from './OfflineStatus';
import { useFinancialVisibility } from '../design-system/financial-visibility';
import { MoneyForm } from './SimpleMoney';
import { useCaptureFlow } from '../design-system/capture-flow';
export { Brand } from '../design-system/components';

const navigation = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/movimentos', label: 'Movimentos', icon: NotebookPen },
  { to: '/planejar', label: 'Planejar', icon: CalendarClock },
  { to: '/nexo', label: 'Nexo', icon: Sparkles },
  { to: '/perfil', label: 'Perfil', icon: Settings },
];
export function Shell() {
  const app = useApp();
  const { visible, toggle } = useFinancialVisibility();
  const { sheetOpen, choosingType, entryType, open, close, chooseType, closeEntry } = useCaptureFlow();
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
        <Link className="simple-mobile-brand" to="/inicio" aria-label="Nexo início">
          <Brand />
        </Link>
        <span className="workspace-label">Finanças pessoais</span>
        <div className="simple-topbar-actions">
          <Link
            to="/anotar"
            className="button button-primary topbar-capture"
            aria-label="Anotar agora"
            onClick={(event) => {
              event.preventDefault();
              open();
            }}
          >
            <Plus size={20} />
            <span>Anotar</span>
          </Link>
          <Button
            variant="ghost"
            className="topbar-icon"
            aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
            title={visible ? 'Ocultar valores' : 'Mostrar valores'}
            onClick={toggle}
          >
            {visible ? <Eye size={20} /> : <EyeOff size={20} />}
          </Button>
          <Link
            to="/seguranca"
            className="button button-ghost topbar-icon"
            aria-label="Abrir Proteção"
            title="Proteção"
          >
            <ShieldCheck size={20} />
          </Link>
          <ThemeToggle />
          <Link to="/ajuda" className="button button-ghost topbar-help" title="Preciso de ajuda">
            <CircleHelp size={20} />
            <span>Preciso de ajuda</span>
          </Link>
          <Link to="/perfil" className="simple-profile" aria-label="Abrir meu perfil">
            {app.data.profile.name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>
      <nav className="simple-nav" aria-label="Principal">
        <Link className="simple-nav-brand" to="/inicio" aria-label="Nexo início">
          <Brand />
        </Link>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={to === '/perfil' ? 'profile-nav-link' : undefined}>
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
      {sheetOpen && (
        <Dialog
          title={choosingType ? 'O que quer anotar?' : 'Como quer adicionar?'}
          className="capture-sheet"
          onClose={close}
        >
          <div className="capture-options">
            {choosingType ? (
              <>
                <Button variant="secondary" onClick={() => chooseType('expense')}>
                  <ArrowUpRight size={20} /> Um gasto
                </Button>
                <Button variant="secondary" onClick={() => chooseType('income')}>
                  <ArrowDownLeft size={20} /> Uma entrada
                </Button>
                <Button variant="ghost" onClick={() => chooseType()}>
                  Voltar
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => chooseType()}>
                  <PenLine size={20} /> Digitar
                </Button>
                <Link className="button button-secondary" to="/nexo" onClick={close}>
                  <Mic size={20} /> Falar com o Nexo
                </Link>
                <Link className="button button-secondary" to="/recibo" onClick={close}>
                  <Camera size={20} /> Fotografar recibo
                </Link>
                <Link className="button button-secondary" to="/importar" onClick={close}>
                  <FileUp size={20} /> Importar extrato
                </Link>
                <Link className="button button-secondary" to="/integracoes" onClick={close}>
                  <MessageCircle size={20} /> Usar WhatsApp
                </Link>
              </>
            )}
          </div>
        </Dialog>
      )}
      {entryType && <MoneyForm type={entryType} onClose={closeEntry} />}
    </div>
  );
}
