import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, `Integração não configurada: ${name}`);
  return value;
}
export function authorizeJob(request: Request) {
  const secret = env('FINANCIAL_JOB_SECRET');
  if (secret.length < 32)
    throw new HttpError(503, 'Configure uma credencial de job com pelo menos 32 caracteres.');
  const expected = `Bearer ${secret}`;
  const received = request.headers.get('authorization') ?? '';
  let difference = received.length ^ expected.length;
  for (let index = 0; index < expected.length; index++)
    difference |= expected.charCodeAt(index) ^ (received.charCodeAt(index) || 0);
  if (difference !== 0) throw new HttpError(401, 'Job não autorizado.');
}
export function admin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
export async function body(request: Request, max = 32_000): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > max)
    throw new HttpError(413, 'Solicitação muito grande.');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > max) throw new HttpError(413, 'Solicitação muito grande.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}
export async function authenticate(request: Request, bucket: string) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'Entre na sua conta.');
  const service = admin();
  const { data, error } = await service.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new HttpError(401, 'Sessão inválida.');
  const limit = await service.rpc('consume_rate_limit', {
    subject: data.user.id,
    bucket_name: bucket,
    max_requests: 20,
  });
  if (limit.error) throw new HttpError(503, 'Controle de acesso indisponível.');
  if (!limit.data) throw new HttpError(429, 'Aguarde um minuto antes de tentar novamente.');
  const scoped = createClient(
    env('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const assurance = await scoped.rpc('session_assured');
  if (assurance.error || !assurance.data)
    throw new HttpError(403, 'Verifique sua autenticação em duas etapas antes de continuar.');
  return { user: data.user, db: scoped, service };
}
export function serve(handler: (request: Request) => Promise<Response>) {
  Deno.serve(async (request) => {
    const requestId = crypto.randomUUID(),
      started = Date.now();
    const origin = request.headers.get('Origin');
    const allowed =
      Deno.env
        .get('ALLOWED_ORIGIN')
        ?.split(',')
        .map((x) => x.trim()) ?? [];
    const headers: Record<string, string> = {
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    let response: Response;
    try {
      if (origin && !allowed.includes(origin)) throw new HttpError(403, 'Origem não permitida.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
      response = await handler(request);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 400;
      response = json(
        {
          error: error instanceof HttpError ? error.message : 'Não foi possível processar a solicitação.',
          request_id: requestId,
        },
        status,
      );
    }
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    response.headers.set('X-Request-Id', requestId);
    console.log(
      JSON.stringify({
        event: 'request',
        request_id: requestId,
        status: response.status,
        latency_ms: Date.now() - started,
      }),
    );
    return response;
  });
}
export async function safeFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(45_000) });
  if (!response.ok) throw new HttpError(502, 'Serviço externo indisponível. Tente novamente.');
  return response;
}
