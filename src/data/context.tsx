import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './client';
import { cloudRepository, demoRepository } from './repository';
import type { Repository } from './repository';
import type { Dataset } from '../../shared/domain';
import { emptyDataset } from '../../shared/domain';

interface AppContextValue {
  demo: boolean;
  user: User | null;
  authReady: boolean;
  mfaReady: boolean;
  mfaRequired: boolean;
  enterDemo: () => void;
  signOut: () => Promise<void>;
  data: Dataset;
  loading: boolean;
  error: string | null;
  repository: Repository;
  refresh: () => Promise<void>;
  organizationId: string | null;
  selectOrganization: (id: string | null) => void;
  toast: (message: string) => void;
}
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(() => sessionStorage.getItem('nexo.mode') === 'demo');
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!supabase);
  const [mfaReady, setMfaReady] = useState(!supabase),
    [mfaRequired, setMfaRequired] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const client = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error) setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (!user || demo || !supabase) {
      setMfaRequired(false);
      setMfaReady(true);
      return;
    }
    setMfaReady(false);
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!active) return;
      setMfaRequired(Boolean(error) || (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2'));
      setMfaReady(true);
    });
    return () => {
      active = false;
    };
  }, [user, demo]);
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timeout);
    }
  }, [message]);
  const repository = useMemo(() => (demo || !user ? demoRepository : cloudRepository(user.id)), [demo, user]);
  const query = useQuery({
    queryKey: ['dataset', demo ? 'demo' : user?.id, organizationId],
    queryFn: () => repository.load(organizationId),
    enabled: demo || (Boolean(user) && mfaReady && !mfaRequired),
    retry: 1,
  });
  useEffect(() => {
    if (demo || !user || !supabase) return;
    const channel = supabase
      .channel(`personal-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => {
          void client.invalidateQueries({ queryKey: ['dataset'] });
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [demo, user, client]);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['dataset'] });
  };
  const value: AppContextValue = {
    demo,
    user,
    authReady,
    mfaReady,
    mfaRequired,
    data: query.data ?? emptyDataset(),
    loading: query.isLoading,
    error: query.error
      ? 'Não foi possível carregar os dados. Verifique sua conexão e a instalação do banco.'
      : null,
    repository,
    refresh,
    organizationId,
    selectOrganization: setOrganizationId,
    toast: setMessage,
    enterDemo: () => {
      client.clear();
      sessionStorage.setItem('nexo.mode', 'demo');
      setDemo(true);
      setOrganizationId(null);
    },
    signOut: async () => {
      if (!demo && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      sessionStorage.removeItem('nexo.mode');
      setDemo(false);
      setUser(null);
      setOrganizationId(null);
      client.clear();
    },
  };
  return (
    <AppContext.Provider value={value}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider ausente.');
  return value;
}
