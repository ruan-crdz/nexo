import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './data/context';
import App from './App';
import './design-system/styles.css';
import { ThemeProvider } from './design-system/theme';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(_error: Error, info: ErrorInfo) {
    console.error('Nexo: interface indisponível', info.componentStack?.split('\n')[1]);
  }
  render() {
    return this.state.error ? (
      <main className="onboarding">
        <h1>Vamos tentar de novo?</h1>
        <p>Não foi possível abrir esta tela. Seus registros persistidos continuam guardados.</p>
        <button className="button button-primary" onClick={() => location.reload()}>
          Recarregar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
