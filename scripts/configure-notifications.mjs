import { createClient } from '@supabase/supabase-js';

// Run with node --env-file=.env.server scripts/configure-notifications.mjs
// Requires the same FINANCIAL_JOB_SECRET already installed on Edge Functions.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.FINANCIAL_JOB_SECRET;
const account = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
if (!url || !serviceKey || !secret || secret.length < 32 || !account)
  throw new Error(
    'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FINANCIAL_JOB_SECRET e WHATSAPP_BUSINESS_ACCOUNT_ID no ambiente privado.',
  );
const response = await fetch(`${url}/functions/v1/financial-notifications`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'prepare_template',
    business_account_id: account,
    create: process.argv.includes('--create-template'),
  }),
  signal: AbortSignal.timeout(45_000),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error ?? 'Não foi possível conferir o template.');
console.log(JSON.stringify({ template: result.name, status: result.status, compatible: result.compatible }));
if (!process.argv.includes('--status-only')) {
  const enable = process.argv.includes('--activate');
  if (enable && (!result.approved || !result.configured))
    throw new Error(
      'Ativação pendente: template aprovado e WHATSAPP_FINANCIAL_TEMPLATE precisam corresponder. Instale o mesmo nome nos secrets da função.',
    );
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.rpc('configure_financial_schedule', {
    job_secret: secret,
    function_url: `${url}/functions/v1/financial-notifications`,
    enable_job: enable,
  });
  if (error)
    throw new Error(
      'Não foi possível configurar o agendamento. Confira a migração e as extensões pg_cron, pg_net e Vault.',
    );
  console.log(
    enable
      ? 'Agendamento ativado. Apenas usuários que consentiram receberão avisos.'
      : 'Agendamento preparado e pausado. Nenhuma mensagem foi enviada por este comando.',
  );
}
