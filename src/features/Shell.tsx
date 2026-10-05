import { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRightLeft,
  LayoutDashboard,
  Target,
  Sparkles,
  TrendingUp,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  MessageCircle,
  ChevronRight,
  Building2,
  Users,
  ShieldCheck,
  CircleHelp,
  Landmark,
  Route,
  ReceiptText,
  Menu,
} from 'lucide-react';
import { useApp } from '../data/context';
import { Brand, Button, Dialog } from '../design-system/components';
import { DEMO_KEY } from '../data/repository';
import { ThemeToggle } from '../design-system/theme';

export { Brand } from '../design-system/components';
const personalNav = [
  { to: '/inicio', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/movimentos', label: 'Movimentos', icon: ArrowRightLeft },
  { to: '/metas', label: 'Metas e sonhos', icon: Target },
  { to: '/jornada', label: 'Minha jornada', icon: Route },
  { to: '/orcamento', label: 'Orçamento', icon: ChartNoAxesCombined },
  { to: '/patrimonio', label: 'Patrimônio', icon: Landmark },
  { to: '/dividas', label: 'Dívidas', icon: ReceiptText },
  { to: '/futuro', label: 'Futuro se…', icon: TrendingUp },
];
const businessNav = [
  { to: '/empresa', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/empresa/movimentos', label: 'Fluxo de caixa', icon: ArrowRightLeft },
  { to: '/empresa/equipe', label: 'Equipe', icon: Users },
  { to: '/empresa/orcamento', label: 'Orçamento por área', icon: ChartNoAxesCombined },
  { to: '/empresa/cenarios', label: 'Posso contratar?', icon: TrendingUp },
  { to: '/empresa/relatorios', label: 'DRE e indicadores', icon: ReceiptText },
  { to: '/empresa/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/empresa/acessos', label: 'Acessos', icon: ShieldCheck },
];
export function Shell() {
  const { pathname } = useLocation(),
    app = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const business = pathname.startsWith('/empresa');
  if (!app.authReady || !app.mfaReady || app.loading)
    return (
      <div className="center-loading" role="status">
        Preparando seu espaço…
      </div>
    );
  if (!app.demo && !app.user) return <Navigate to="/login" replace />;
  if (!app.demo && app.mfaRequired) return <Navigate to="/seguranca" replace />;
  if (!app.data.profile.onboarded && !app.error) return <Navigate to="/onboarding" replace />;
  const nav = business ? businessNav : personalNav;
  const title =
    [
      ...nav,
      { to: '/assistente', label: 'Assistente Nexo' },
      { to: '/perfil', label: 'Seu perfil' },
      { to: '/integracoes', label: 'Integrações' },
      { to: '/privacidade', label: 'Privacidade' },
      { to: '/contas', label: 'Contas e cartões' },
      { to: '/relatorios', label: 'Relatórios' },
    ].find((n) => n.to === pathname)?.label ?? 'Seu espaço';
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link to="/inicio" aria-label="Nexo início">
          <Brand />
        </Link>
        <div className="workspace-switch">
          <NavLink to="/inicio" className={!business ? 'active' : ''}>
            Pessoal
          </NavLink>
          <NavLink to="/empresa" className={business ? 'active' : ''}>
            Empresas
          </NavLink>
        </div>
        <p className="nav-label">{business ? 'Seu negócio' : 'Seu dinheiro'}</p>
        <nav className="side-nav" aria-label="Principal">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="nav-label">Um passo à frente</p>
        <nav className="side-nav" aria-label="Ferramentas">
          <NavLink to="/assistente">
            <Sparkles size={17} />
            Assistente Nexo<span className="nav-count">IA</span>
          </NavLink>
          <NavLink to="/integracoes">
            <MessageCircle size={17} />
            WhatsApp
          </NavLink>
          {!business && (
            <NavLink to="/contas">
              <Wallet size={17} />
              Contas e cartões
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={20} />
            <strong> Clareza para decidir.</strong>
            <p>Seu próximo passo começa com o que você sabe hoje.</p>
            <Link to="/privacidade" className="text-link">
              Sua privacidade
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <Link className="profile-link" to="/perfil">
            <span className="avatar">{app.data.profile.name.slice(0, 1)}</span>
            <div>
              <strong>{app.data.profile.name}</strong>
              <small>{app.demo ? 'Conta de demonstração' : 'Minha conta'}</small>
            </div>
            <Settings size={16} className="muted" />
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <Link to="/inicio" aria-label="Nexo início">
              <Brand />
            </Link>
          </div>
          <div className="breadcrumbs">
            {business ? <Building2 size={14} /> : <LayoutDashboard size={14} />}
            <span>Nexo {business ? 'Empresas' : 'Pessoal'}</span>
            <ChevronRight size={12} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {app.demo && <span className="demo-label">Demonstração</span>}
            <Button
              variant="ghost"
              className="mobile-menu-button"
              aria-label="Abrir todas as áreas"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <Link className="button button-ghost" to="/privacidade" aria-label="Ajuda e privacidade">
              <CircleHelp size={18} />
            </Link>
            <Link to="/perfil" aria-label="Meu perfil">
              <span className="avatar">{app.data.profile.name.slice(0, 1)}</span>
            </Link>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          {app.error ? (
            <div className="card">
              <h1>Vamos tentar de novo?</h1>
              <p className="error-message">{app.error}</p>
              <Button onClick={() => void app.refresh()}>Recarregar</Button>
              {app.demo ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    localStorage.removeItem(DEMO_KEY);
                    void app.refresh();
                  }}
                >
                  Redefinir demonstração
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void app.signOut()}>
                  Sair da conta
                </Button>
              )}
            </div>
          ) : (
            <Outlet />
          )}
          <footer className="app-footer">
            <span>Um passo de cada vez. Na direção que importa.</span>
            <Link to="/privacidade">
              Seus dados, suas escolhas <ShieldCheck size={11} />
            </Link>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navegação móvel">
        <NavLink to={business ? '/empresa' : '/inicio'} end>
          <LayoutDashboard size={19} />
          <span>Início</span>
        </NavLink>
        <NavLink to={business ? '/empresa/movimentos' : '/movimentos'}>
          <ArrowRightLeft size={19} />
          <span>Movimentos</span>
        </NavLink>
        <NavLink to="/assistente" className="assistant-nav">
          <Sparkles size={19} />
          <span>Nexo</span>
        </NavLink>
        <NavLink to={business ? '/empresa/equipe' : '/metas'}>
          {business ? <Users size={19} /> : <Target size={19} />}
          <span>{business ? 'Equipe' : 'Metas'}</span>
        </NavLink>
        <NavLink to="/perfil">
          <Settings size={19} />
          <span>Perfil</span>
        </NavLink>
      </nav>
      {menuOpen && (
        <Dialog title="Seu Nexo" onClose={() => setMenuOpen(false)}>
          <nav className="mobile-menu-grid" aria-label="Todas as áreas">
            {[
              ...nav,
              { to: '/contas', label: 'Contas e cartões', icon: Wallet },
              { to: '/relatorios', label: 'Relatórios', icon: ReceiptText },
              { to: '/empresa', label: 'Nexo Empresas', icon: Building2 },
              { to: '/inicio', label: 'Nexo Pessoal', icon: LayoutDashboard },
              { to: '/integracoes', label: 'WhatsApp', icon: MessageCircle },
            ].map(({ to, label, icon: Icon }, i) => (
              <Link key={`${to}-${i}`} to={to} onClick={() => setMenuOpen(false)}>
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
        </Dialog>
      )}
    </div>
  );
}
