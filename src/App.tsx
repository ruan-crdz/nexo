import { IntegrationsPage } from './features/Integrations';
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './features/Shell';
import { Landing, AuthPage, Onboarding } from './features/Auth';
const HomePage = lazy(() => import('./features/Home').then((m) => ({ default: m.HomePage })));
import { ResourcePage, GoalsPage } from './features/Resources';
const BudgetPage = lazy(() => import('./features/Planning').then((m) => ({ default: m.BudgetPage })));
const DebtsPage = lazy(() => import('./features/Planning').then((m) => ({ default: m.DebtsPage })));
const FuturePage = lazy(() => import('./features/Planning').then((m) => ({ default: m.FuturePage })));
const JourneyPage = lazy(() => import('./features/Planning').then((m) => ({ default: m.JourneyPage })));
const ReportsPage = lazy(() => import('./features/Planning').then((m) => ({ default: m.ReportsPage })));
const WealthPage = lazy(() => import('./features/Planning').then((m) => ({ default: m.WealthPage })));
const BusinessDashboard = lazy(() =>
  import('./features/Business').then((m) => ({ default: m.BusinessDashboard })),
);
const BusinessLayout = lazy(() => import('./features/Business').then((m) => ({ default: m.BusinessLayout })));
const BusinessReports = lazy(() =>
  import('./features/Business').then((m) => ({ default: m.BusinessReports })),
);
const BusinessSettings = lazy(() =>
  import('./features/Business').then((m) => ({ default: m.BusinessSettings })),
);
const HiringPage = lazy(() => import('./features/Business').then((m) => ({ default: m.HiringPage })));
const AccessPage = lazy(() => import('./features/Business').then((m) => ({ default: m.AccessPage })));
import { PrivacyPage, ProfilePage } from './features/Settings';
import { AssistantPage } from './features/Assistant';
import { MfaPage } from './features/Mfa';
export default function App() {
  return (
    <Suspense
      fallback={
        <div className="center-loading" role="status">
          Preparando esta área…
        </div>
      }
    >
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/cadastro" element={<AuthPage mode="signup" />} />
          <Route path="/recuperar" element={<AuthPage mode="recovery" />} />
          <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/seguranca" element={<MfaPage />} />
          <Route element={<Shell />}>
            <Route path="/inicio" element={<HomePage />} />
            <Route
              path="/movimentos"
              element={
                <ResourcePage
                  entity="transactions"
                  title="Os movimentos da sua vida."
                  description="Cada registro ajuda a entender melhor seu momento."
                />
              }
            />
            <Route
              path="/contas"
              element={
                <ResourcePage
                  entity="financial_accounts"
                  title="Seu dinheiro, em cada lugar."
                  description="Contas, reserva e cartões reunidos em uma visão."
                />
              }
            />
            <Route path="/metas" element={<GoalsPage />} />
            <Route path="/jornada" element={<JourneyPage />} />
            <Route path="/orcamento" element={<BudgetPage />} />
            <Route path="/dividas" element={<DebtsPage />} />
            <Route path="/patrimonio" element={<WealthPage />} />
            <Route path="/futuro" element={<FuturePage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/assistente" element={<AssistantPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/integracoes" element={<IntegrationsPage />} />
            <Route path="/empresa" element={<BusinessLayout />}>
              <Route index element={<BusinessDashboard />} />
              <Route
                path="movimentos"
                element={
                  <ResourcePage
                    entity="business_transactions"
                    title="O fluxo do seu negócio."
                    description="Entradas, saídas e compromissos futuros em um só lugar."
                  />
                }
              />
              <Route
                path="equipe"
                element={
                  <ResourcePage
                    entity="employees"
                    title="Pessoas que constroem com você."
                    description="Entenda o custo completo da sua equipe, com premissas editáveis."
                  />
                }
              />
              <Route path="orcamento" element={<BudgetPage business />} />
              <Route path="cenarios" element={<HiringPage />} />
              <Route path="relatorios" element={<BusinessReports />} />
              <Route path="configuracoes" element={<BusinessSettings />} />
              <Route path="acessos" element={<AccessPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </Suspense>
  );
}
