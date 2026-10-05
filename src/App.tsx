import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './features/Shell';
import { AuthPage } from './features/Auth';
import { SimpleLanding, SimpleOnboarding } from './features/SimpleWelcome';
import { SimpleHome, SimpleHistory } from './features/SimpleMoney';
import { SimpleSettings, SimpleHelp } from './features/SimpleSettings';
import { SimplePrivacy } from './features/SimplePrivacy';
import { IntegrationsPage } from './features/Integrations';
import { MfaPage } from './features/Mfa';
import { PlanningHub } from './features/PlanningHub';
import { FinancialQuestions } from './features/FinancialQuestions';
import { StatementImport } from './features/StatementImport';
import { FamilyPage } from './features/Family';
import { FinancialTools } from './features/FinancialTools';
import { ReceiptImport } from './features/ReceiptImport';
import { AppUpdate } from './features/AppUpdate';

export default function App() {
  return (
    <>
      <AppUpdate />
      <HashRouter>
        <Routes>
          <Route path="/" element={<SimpleLanding />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/cadastro" element={<AuthPage mode="signup" />} />
          <Route path="/recuperar" element={<AuthPage mode="recovery" />} />
          <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
          <Route path="/onboarding" element={<SimpleOnboarding />} />
          <Route path="/seguranca" element={<MfaPage />} />
          <Route element={<Shell />}>
            <Route path="/inicio" element={<SimpleHome />} />
            <Route path="/movimentos" element={<SimpleHistory />} />
            <Route path="/integracoes" element={<IntegrationsPage />} />
            <Route path="/perfil" element={<SimpleSettings />} />
            <Route path="/ajuda" element={<SimpleHelp />} />
            <Route path="/privacidade" element={<SimplePrivacy />} />
            <Route path="/planejar" element={<PlanningHub />} />
            <Route path="/perguntas" element={<FinancialQuestions />} />
            <Route path="/importar" element={<StatementImport />} />
            <Route path="/familia" element={<FamilyPage />} />
            <Route path="/controle" element={<FinancialTools />} />
            <Route path="/recibo" element={<ReceiptImport />} />
          </Route>
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </HashRouter>
    </>
  );
}
