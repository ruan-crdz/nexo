-- Monetary amounts are integer cents, never binary floating point.
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create domain public.cents as bigint check (value between 0 and 9000000000000);

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default 'Você' check(length(name) between 1 and 80),
 objective text not null default 'Organizar meu dinheiro',
 monthly_income public.cents not null default 0, fixed_expenses public.cents not null default 0,
 dependents integer not null default 0 check(dependents between 0 and 30),
 variable_income boolean not null default false, insured boolean not null default false,
 timezone text not null default 'America/Sao_Paulo',
 onboarded boolean not null default false, business_enabled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(length(name) between 2 and 80), kind text not null check(kind in ('checking','savings','investment','credit')),
 opening_balance bigint not null default 0 check(abs(opening_balance)<=9000000000000),
 closing_day integer check(closing_day between 1 and 31), due_day integer check(due_day between 1 and 31),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 account_id uuid, description text not null check(length(description) between 2 and 180), amount public.cents not null check(amount>0),
 type text not null check(type in ('income','expense')), category text not null check(length(category) between 1 and 60),
 date date not null, status text not null default 'paid' check(status in ('paid','planned')),
 source text not null default 'manual' check(source in ('manual','whatsapp','import')),
 external_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(account_id,user_id) references public.financial_accounts(id,user_id), unique(user_id,external_id)
);
create table public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), target public.cents not null check(target>0), saved public.cents not null default 0,
 monthly_contribution public.cents not null default 0, deadline date not null, priority text not null check(priority in ('high','medium','low')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.debts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), balance public.cents not null, rate_bps integer not null check(rate_bps between 0 and 100000),
 minimum public.cents not null default 0, due_date date not null, overdue boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.assets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), value public.cents not null,
 kind text not null check(kind in ('property','vehicle','investment','other')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check(length(category) between 1 and 60), limit_amount public.cents not null,
 month text not null check(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,category,month)
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','finance','manager','viewer')),
 created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create table public.business_profiles (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), segment text not null default '',
 revenue public.cents not null default 0, fixed_costs public.cents not null default 0,
 variable_cost_bps integer not null default 0 check(variable_cost_bps between 0 and 10000),
 cash public.cents not null default 0, pro_labore public.cents not null default 0,
 tax_bps integer not null default 0 check(tax_bps between 0 and 10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(variable_cost_bps+tax_bps<=10000)
);
create table public.business_transactions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 description text not null check(length(description) between 2 and 180), amount public.cents not null check(amount>0),
 type text not null check(type in ('income','expense')), category text not null check(length(category) between 1 and 60), date date not null,
 status text not null default 'paid' check(status in ('paid','planned')),
 source text not null default 'manual' check(source in ('manual','whatsapp','import')), account_id uuid check(account_id is null),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.employees (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), role text not null check(length(role) between 2 and 100), department text not null check(length(department) between 1 and 60),
 contract text not null check(contract in ('CLT','PJ','Outro')), salary public.cents not null,
 benefits public.cents not null default 0, charges_bps integer not null default 0 check(charges_bps between 0 and 100000),
 other_costs public.cents not null default 0, start_date date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_budgets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 category text not null check(length(category) between 1 and 60), limit_amount public.cents not null,
 month text not null check(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,category,month)
);
create table public.audit_logs (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, action text not null, resource text not null, resource_id text not null,
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);

-- Security-definer helpers bypass membership RLS without recursive policies.
create function public.org_role(org uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.organization_members where organization_id=org and user_id=(select auth.uid())
$$;
revoke all on function public.org_role(uuid) from public;
grant execute on function public.org_role(uuid) to authenticated;

create function public.create_organization(organization_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not public.session_assured() then raise exception 'MFA required'; end if;
 if length(trim(organization_name)) not between 2 and 100 then raise exception 'invalid name'; end if;
 insert into public.organizations(name,owner_id) values(trim(organization_name),auth.uid()) returning id into org;
 insert into public.organization_members(organization_id,user_id,role) values(org,auth.uid(),'owner');
 insert into public.business_profiles(organization_id,name) values(org,trim(organization_name));
 update public.profiles set business_enabled=true where id=auth.uid();
 return org;
end $$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

create function public.set_member(org uuid, member_id uuid, member_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.org_role(org) <> 'owner' or public.org_role(org) is null then raise exception 'owner required'; end if;
 if member_role not in ('admin','finance','manager','viewer') then raise exception 'invalid role'; end if;
 if exists(select 1 from public.organization_members where organization_id=org and user_id=member_id and role='owner') then raise exception 'cannot change owner'; end if;
 insert into public.organization_members(organization_id,user_id,role) values(org,member_id,member_role)
 on conflict(organization_id,user_id) do update set role=excluded.role;
end $$;
revoke all on function public.set_member(uuid,uuid,text) from public;
grant execute on function public.set_member(uuid,uuid,text) to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create function public.audit_business() returns trigger language plpgsql security definer set search_path='' as $$
declare old_json jsonb; new_json jsonb;
begin
 if tg_op <> 'INSERT' then old_json=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_json=to_jsonb(new); end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource,resource_id,before_data,after_data)
 values(coalesce(new_json->>'organization_id',old_json->>'organization_id')::uuid,auth.uid(),tg_op,tg_table_name,coalesce(new_json->>'id',old_json->>'id',new_json->>'user_id',old_json->>'user_id',new_json->>'organization_id',old_json->>'organization_id'),old_json,new_json);
 return coalesce(new,old);
end $$;

alter table public.profiles enable row level security;
create policy profile_self on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create trigger touch_profile before update on public.profiles for each row execute function public.touch_updated_at();

do $$ declare t text; begin
 foreach t in array array['financial_accounts','transactions','goals','debts','assets','budgets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy user_ownership on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  execute format('create index %I on public.%I(user_id)',t||'_user_idx',t);
  execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
 foreach t in array array['business_profiles','business_transactions','employees','business_budgets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy member_read on public.%I for select to authenticated using(public.org_role(organization_id) is not null)',t);
  execute format('create policy finance_insert on public.%I for insert to authenticated with check(public.org_role(organization_id) in (''owner'',''admin'',''finance''))',t);
  execute format('create policy finance_update on public.%I for update to authenticated using(public.org_role(organization_id) in (''owner'',''admin'',''finance'')) with check(public.org_role(organization_id) in (''owner'',''admin'',''finance''))',t);
  execute format('create policy finance_delete on public.%I for delete to authenticated using(public.org_role(organization_id) in (''owner'',''admin'',''finance''))',t);
  execute format('create index %I on public.%I(organization_id)',t||'_org_idx',t);
  execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_business()',t);
 end loop;
end $$;
alter table public.organizations enable row level security;
create policy org_read on public.organizations for select to authenticated using(public.org_role(id) is not null);
alter table public.organization_members enable row level security;
create policy members_read on public.organization_members for select to authenticated using(public.org_role(organization_id) is not null);
create policy members_delete on public.organization_members for delete to authenticated using(public.org_role(organization_id)='owner' and role<>'owner');
create trigger audit_members after insert or update or delete on public.organization_members for each row execute function public.audit_business();
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using(public.org_role(organization_id) in ('owner','admin'));
create index transactions_user_date_idx on public.transactions(user_id,date desc);
create index business_transactions_org_date_idx on public.business_transactions(organization_id,date desc);
create index memberships_user_idx on public.organization_members(user_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Explicit grants: anon has no access to financial data.
revoke all on all tables in schema public from anon;
grant select,insert,update,delete on public.profiles,public.financial_accounts,public.transactions,public.goals,public.debts,public.assets,public.budgets,public.business_profiles,public.business_transactions,public.employees,public.business_budgets to authenticated;
grant select on public.organizations,public.organization_members,public.audit_logs to authenticated;
grant delete on public.organization_members to authenticated;
alter publication supabase_realtime add table public.transactions;
