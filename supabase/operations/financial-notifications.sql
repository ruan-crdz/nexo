create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='nexo_financial_job_url')
 or not exists(select 1 from vault.decrypted_secrets where name='nexo_financial_job_secret') then
  raise exception 'Configure no Vault a URL da função financial-notifications e a credencial FINANCIAL_JOB_SECRET antes de agendar.';
 end if;
end $$;

select cron.schedule('nexo-financial-notifications','*/15 * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='nexo_financial_job_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='nexo_financial_job_secret')),
  body:='{}'::jsonb
 );
$$);