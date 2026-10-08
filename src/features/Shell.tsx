import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import {
  Home,
  NotebookPen,
  Settings,
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
  Target,
  CalendarDays,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useApp } from '../data/context';
import { Brand, Button, Dialog } from '../design-system/components';
import { OfflineStatus } from './OfflineStatus';
import { useFinancialVisibility } from '../design-system/financial-visibility';
import { MoneyForm } from './SimpleMoney';
import { useCaptureFlow } from '../design-system/capture-flow';
export { Brand } from '../design-system/components';

const navigation = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/movimentos', label: 'Histórico', icon: NotebookPen },
  { to: '/nexo', label: 'Nexo', icon: MessageCircle },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/planejar', label: 'Planejar', icon: CalendarDays },
  { to: '/perfil', label: 'Você', icon: Settings },
];
export function Shell() {
  const app = useApp();
  const { visible, toggle } = useFinancialVisibility();
  const { sheetOpen, choosingType, entryType, close, chooseType, closeEntry } = useCaptureFlow();
  const location = useLocation();
  const { pathname } = location;
  const onboardingConnection =
    pathname === '/integracoes' && new URLSearchParams(location.search).get('onboarding') === '1';
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
  if (!app.data.profile.onboarded && !app.error && !onboardingConnection)
    return <Navigate to="/onboarding" replace />;
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
        <div className="topbar-greeting">
          <Link className="simple-profile" to="/perfil" aria-label="Abrir seu perfil">
            {app.data.profile.name.slice(0, 1).toUpperCase()}
          </Link>
          <span>Olá, {app.data.profile.name.split(' ')[0]}</span>
        </div>
        <div className="simple-topbar-actions">
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
        </div>
      </header>
      <nav className="simple-nav" aria-label="Principal">
        <Link className="simple-nav-brand" to="/inicio" aria-label="Nexo início">
          <Brand />
        </Link>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={to === '/perfil' ? 'profile-nav-link' : undefined}
            aria-label={to === '/nexo' ? 'Perguntar ao Nexo' : undefined}
          >
            {to === '/nexo' ? (
              <span className="simple-nav-nexo-mark" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}logo_letra_n.png`} alt="" />
              </span>
            ) : (
              <Icon size={24} />
            )}
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
