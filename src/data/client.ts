import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      })
    : null;
export const configured = Boolean(supabase);
export async function invoke<T>(name: string, body: Record<string, unknown> | FormData): Promise<T> {
  if (!supabase) throw new Error('Conecte o Supabase para usar esta integração.');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error)
    throw new Error(
      'Não foi possível concluir a solicitação. Confira a configuração da integração e tente novamente.',
    );
  return data as T;
}
