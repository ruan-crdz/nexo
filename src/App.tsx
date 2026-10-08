import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './features/Shell';
import { AuthPage } from './features/Auth';
import { SimpleLanding, SimpleOnboarding } from './features/SimpleWelcome';
import { SimpleHome, SimpleHistory, CapturePage } from './features/SimpleMoney';
import { SimpleSettings, SimpleHelp } from './features/SimpleSettings';
import { AppUpdate } from './features/AppUpdate';
import { FeatureTour } from './features/FeatureTour';
const SimplePrivacy = lazy(async () => ({
  default: (await import('./features/SimplePrivacy')).SimplePrivacy,
}));
const IntegrationsPage = lazy(async () => ({
  default: (await import('./features/Integrations')).IntegrationsPage,
}));
const MfaPage = lazy(async () => ({ default: (await import('./features/Mfa')).MfaPage }));
const PlanningHub = lazy(async () => ({ default: (await import('./features/PlanningHub')).PlanningHub }));
const FinancialQuestions = lazy(async () => ({
  default: (await import('./features/FinancialQuestions')).FinancialQuestions,
}));
const StatementImport = lazy(async () => ({
  default: (await import('./features/StatementImport')).StatementImport,
}));
const FamilyPage = lazy(async () => ({ default: (await import('./features/Family')).FamilyPage }));
const FinancialTools = lazy(async () => ({
  default: (await import('./features/FinancialTools')).FinancialTools,
}));
const ReceiptImport = lazy(async () => ({
  default: (await import('./features/ReceiptImport')).ReceiptImport,
}));
const GoalsPage = lazy(async () => ({ default: (await import('./features/GoalsPage')).GoalsPage }));
const AssistantPage = lazy(async () => ({ default: (await import('./features/Assistant')).AssistantPage }));

export default function App() {
  return (
    <>
      <AppUpdate />
      <HashRouter>
        <Suspense
          fallback={
            <p role="status" className="simple-content">
              Abrindo…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<SimpleLanding />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/cadastro" element={<AuthPage mode="signup" />} />
            <Route path="/recuperar" element={<AuthPage mode="recovery" />} />
            <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
            <Route path="/onboarding" element={<SimpleOnboarding />} />
            <Route path="/tour" element={<FeatureTour />} />
            <Route path="/seguranca" element={<MfaPage />} />
            <Route element={<Shell />}>
              <Route path="/inicio" element={<SimpleHome />} />
              <Route path="/anotar" element={<CapturePage />} />
              <Route path="/movimentos" element={<SimpleHistory />} />
              <Route path="/integracoes" element={<IntegrationsPage />} />
              <Route path="/perfil" element={<SimpleSettings />} />
              <Route path="/ajuda" element={<SimpleHelp />} />
              <Route path="/privacidade" element={<SimplePrivacy />} />
              <Route path="/planejar" element={<PlanningHub />} />
              <Route path="/metas" element={<GoalsPage />} />
              <Route path="/metas/nova" element={<GoalsPage />} />
              <Route path="/metas/:goalId" element={<GoalsPage />} />
              <Route path="/perguntas" element={<FinancialQuestions />} />
              <Route path="/nexo" element={<AssistantPage />} />
              <Route path="/importar" element={<StatementImport />} />
              <Route path="/familia" element={<FamilyPage />} />
              <Route path="/controle" element={<FinancialTools />} />
              <Route path="/recibo" element={<ReceiptImport />} />
            </Route>
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </>
  );
}
