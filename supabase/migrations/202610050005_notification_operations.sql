create table public.notification_runtime (
  id boolean primary key default true check (id),
  last_success timestamptz
);
alter table public.notification_runtime enable row level security;
revoke all on public.notification_runtime from public, anon, authenticated;
grant all on public.notification_runtime to service_role;

-- Only the server can see operational state or configure the scheduler.
create function public.financial_schedule_status() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare enabled boolean;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute 'select exists(select 1 from cron.job where jobname = ''nexo-financial-notifications'' and active)' into enabled;
  return enabled;
end $$;
revoke all on function public.financial_schedule_status() from public, anon, authenticated;
grant execute on function public.financial_schedule_status() to service_role;

create function public.configure_financial_schedule(job_secret text, function_url text, enable_job boolean default false)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $function$
declare secret_id uuid; url_id uuid; job_id bigint;
begin
  if length(job_secret) < 32 or function_url !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/financial-notifications$' then
    raise exception 'Invalid scheduler configuration';
  end if;
  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net with schema extensions';
  select id into secret_id from vault.secrets where name='nexo_financial_job_secret';
  if secret_id is null then
    perform vault.create_secret(job_secret, 'nexo_financial_job_secret');
  else
    perform vault.update_secret(secret_id, job_secret);
  end if;
  select id into url_id from vault.secrets where name='nexo_financial_job_url';
  if url_id is null then
    perform vault.create_secret(function_url, 'nexo_financial_job_url');
  else
    perform vault.update_secret(url_id, function_url);
  end if;
  select cron.schedule('nexo-financial-notifications', '*/15 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='nexo_financial_job_url'),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='nexo_financial_job_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$) into job_id;
  perform cron.alter_job(job_id, active := enable_job);
  return enable_job;
end $function$;
revoke all on function public.configure_financial_schedule(text,text,boolean) from public, anon, authenticated;
grant execute on function public.configure_financial_schedule(text,text,boolean) to service_role;
