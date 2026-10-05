-- Opt-in MFA is enforced in Postgres, not just in the UI.
create function public.session_assured() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
   coalesce(auth.jwt()->>'aal','aal1')='aal2'
   or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
 )
$$;
revoke all on function public.session_assured() from public,anon;
grant execute on function public.session_assured() to authenticated;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('create policy mfa_assurance on public.%I as restrictive for all to authenticated using((select public.session_assured())) with check((select public.session_assured()))',t);
 end loop;
end $$;
create or replace function public.org_role(org uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.organization_members where organization_id=org and user_id=(select auth.uid()) and public.session_assured()
$$;
