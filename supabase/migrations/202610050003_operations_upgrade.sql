alter table public.recurring_rules add column type text not null default 'expense' check(type in ('income','expense')),
 add column frequency text not null default 'monthly' check(frequency in ('weekly','monthly','yearly')),
 add column end_date date, add column annual_adjustment_bps integer not null default 0 check(annual_adjustment_bps between 0 and 10000),
 add check(end_date is null or end_date>=start_date);
alter table public.financial_accounts add column credit_limit public.cents not null default 0;

create or replace function public.sync_recurring_rules_for(owner uuid) returns integer language plpgsql security definer set search_path='' as $$
declare rule record; today date; due date; offset_period integer; distance integer; period integer; identifier uuid; hash text; created integer:=0; adjusted bigint; years integer;
begin
 select (now() at time zone timezone)::date into today from public.profiles where id=owner;
 if today is null then raise exception 'invalid owner'; end if;
 for rule in select * from public.recurring_rules where user_id=owner and active order by id loop
  distance:=(extract(year from today)::integer-extract(year from rule.start_date)::integer)*12+extract(month from today)::integer-extract(month from rule.start_date)::integer;
  period:=case rule.frequency when 'weekly' then floor((today-rule.start_date)/7.0)::integer when 'yearly' then floor(distance/12.0)::integer else distance end;
  for offset_period in greatest(0,period-1)..greatest(0,period)+case when rule.frequency='weekly' then 6 else 2 end loop
   due:=case when rule.frequency='weekly' then rule.start_date+offset_period*7 else (rule.start_date+make_interval(months=>offset_period*case when rule.frequency='yearly' then 12 else 1 end))::date end;
   if due>today+30 or (rule.end_date is not null and due>rule.end_date) then continue; end if;
   perform pg_advisory_xact_lock(hashtext(rule.id::text));
   if exists(select 1 from public.recurring_occurrences where rule_id=rule.id and due_date=due) then continue; end if;
   years:=greatest(0,extract(year from due)::integer-extract(year from rule.start_date)::integer);
   if due<(rule.start_date+make_interval(years=>years))::date then years:=greatest(0,years-1);end if;adjusted:=rule.amount;
   for annual in 1..years loop adjusted:=adjusted+round(adjusted::numeric*rule.annual_adjustment_bps/10000)::bigint; end loop;
   hash:=encode(extensions.digest(decode('9667e0ce412e47d9a21291d1d616f74b','hex')||convert_to(rule.id::text||':'||due::text,'UTF8'),'sha1'),'hex');
   identifier:=(substr(hash,1,8)||'-'||substr(hash,9,4)||'-5'||substr(hash,14,3)||'-'||substr('89ab',((get_byte(decode(hash,'hex'),8)>>4)&3)+1,1)||substr(hash,18,3)||'-'||substr(hash,21,12))::uuid;
   insert into public.transactions(id,user_id,description,amount,type,category,date,status,source,external_id)
    values(identifier,owner,rule.description,adjusted,rule.type,rule.category,due,'planned','manual','recurring:'||rule.id::text||':'||due::text);
   insert into public.recurring_occurrences values(rule.id,due,identifier);created:=created+1;
  end loop;
 end loop;
 return created;
end $$;
revoke all on function public.sync_recurring_rules_for(uuid) from public,anon,authenticated;
grant execute on function public.sync_recurring_rules_for(uuid) to service_role;

create table public.transaction_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 transaction_id uuid not null, actor_id uuid references public.profiles(id) on delete set null,
 operation text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
alter table public.transaction_history enable row level security;
revoke all on public.transaction_history from anon,authenticated;
grant select on public.transaction_history to authenticated;
create policy history_owner on public.transaction_history for select to authenticated using(user_id=auth.uid() and public.session_assured());
create index history_owner_date on public.transaction_history(user_id,created_at desc,id);
create function public.record_transaction_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=coalesce(new.user_id,old.user_id)) then return coalesce(new,old); end if;
 insert into public.transaction_history(user_id,transaction_id,actor_id,operation,before_data,after_data)
 values(coalesce(new.user_id,old.user_id),coalesce(new.id,old.id),auth.uid(),tg_op,case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);
 return coalesce(new,old);
end $$;
revoke all on function public.record_transaction_history() from public,anon,authenticated;
create trigger transactions_history after insert or update or delete on public.transactions for each row execute function public.record_transaction_history();
create function public.restore_transaction_version(version_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare version record; current_row jsonb; original jsonb; identifier uuid;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 select * into version from public.transaction_history where id=version_id and user_id=auth.uid();
 if not found or version.before_data is null then raise exception 'version unavailable'; end if;
 perform pg_advisory_xact_lock(hashtext(version.transaction_id::text));
 select to_jsonb(t) into current_row from public.transactions t where id=version.transaction_id for update;
 if version.after_data is distinct from current_row then raise exception 'record changed since this version'; end if;
 original:=version.before_data;identifier:=(original->>'id')::uuid;
 insert into public.transactions(id,user_id,account_id,description,amount,type,category,date,status,source)
 values(identifier,auth.uid(),(original->>'account_id')::uuid,original->>'description',(original->>'amount')::bigint,original->>'type',original->>'category',(original->>'date')::date,original->>'status',original->>'source')
 on conflict(id) do update set account_id=excluded.account_id,description=excluded.description,amount=excluded.amount,type=excluded.type,category=excluded.category,date=excluded.date,status=excluded.status,source=excluded.source;
 return identifier;
end $$;
revoke all on function public.restore_transaction_version(uuid) from public,anon,authenticated;
grant execute on function public.restore_transaction_version(uuid) to authenticated;

create table public.category_preferences (
 user_id uuid not null references public.profiles(id) on delete cascade, merchant text not null check(length(merchant) between 3 and 180),
 category text not null check(length(category) between 1 and 60), created_at timestamptz not null default now(), primary key(user_id,merchant)
);
alter table public.category_preferences enable row level security;
revoke all on public.category_preferences from anon,authenticated;
grant select,insert,update,delete on public.category_preferences to authenticated;
create policy category_owner on public.category_preferences for all to authenticated using(user_id=auth.uid() and public.session_assured()) with check(user_id=auth.uid() and public.session_assured());

create table public.operation_metrics (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
 operation text not null check(operation in ('audio','vision','extraction','notification','manual','correction','visit')),
 model text, input_tokens integer, output_tokens integer, audio_seconds numeric,
 latency_ms integer not null check(latency_ms>=0), success boolean not null, created_at timestamptz not null default now()
);
alter table public.operation_metrics enable row level security;
revoke all on public.operation_metrics from anon,authenticated;
grant select on public.operation_metrics to authenticated;
create policy metrics_owner on public.operation_metrics for select to authenticated using(user_id=auth.uid() and public.session_assured());
create index metrics_owner_date on public.operation_metrics(user_id,created_at desc);
alter table public.profiles add column metrics_enabled boolean not null default false;
grant insert on public.operation_metrics to authenticated;
create policy metrics_insert on public.operation_metrics for insert to authenticated with check(user_id=auth.uid() and public.session_assured() and exists(select 1 from public.profiles where id=auth.uid() and metrics_enabled));
create table public.transaction_sources (
 user_id uuid not null references public.profiles(id) on delete cascade,
 incoming_id uuid not null, canonical_id uuid references public.transactions(id) on delete set null,
 original_data jsonb not null, created_at timestamptz not null default now(), primary key(user_id,incoming_id)
);
alter table public.transaction_sources enable row level security;
revoke all on public.transaction_sources from anon,authenticated;
grant select on public.transaction_sources to authenticated;
create policy sources_owner on public.transaction_sources for select to authenticated using(user_id=auth.uid() and public.session_assured());
create function public.import_reviewed_transactions(payload jsonb,reconciliation jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare link jsonb; source jsonb; target record; remaining jsonb; batch record; result jsonb; saved integer:=0; total integer;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 if jsonb_typeof(payload)<>'array' or jsonb_typeof(reconciliation)<>'array' or jsonb_array_length(payload)>10000 or jsonb_array_length(reconciliation)>10000 then raise exception 'invalid batch'; end if;
 total:=jsonb_array_length(payload);
 for link in select value from jsonb_array_elements(reconciliation) loop
  select value into source from jsonb_array_elements(payload) where value->>'id'=link->>'incoming_id';
  select * into target from public.transactions where id=(link->>'canonical_id')::uuid and user_id=auth.uid() for update;
  if source is null or target.id is null or target.amount<>(source->>'amount')::bigint or target.type<>source->>'type'
   or abs(target.date-(source->>'date')::date)>2 then raise exception 'invalid reconciliation'; end if;
  insert into public.transaction_sources(user_id,incoming_id,canonical_id,original_data) values(auth.uid(),(source->>'id')::uuid,target.id,source) on conflict(user_id,incoming_id) do nothing;
 end loop;
 select coalesce(jsonb_agg(value),'[]') into remaining from jsonb_array_elements(payload)
  where not exists(select 1 from public.transaction_sources where user_id=auth.uid() and incoming_id=(value->>'id')::uuid);
 for batch in select jsonb_agg(value) as rows from jsonb_array_elements(remaining) with ordinality group by floor((ordinality-1)/1000.0) loop
  result:=public.import_transactions(batch.rows);saved:=saved+(result->>'saved')::integer;
 end loop;
 return jsonb_build_object('saved',saved,'skipped',total-saved);
end $$;
revoke all on function public.import_reviewed_transactions(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_reviewed_transactions(jsonb,jsonb) to authenticated;
alter table public.family_invites add column account_id uuid references public.financial_accounts(id) on delete cascade,
 add column period_start date, add column period_end date, add column can_propose boolean not null default false,
 add check(period_start is null or period_end is null or period_end>=period_start);
drop function public.create_family_invite(text);
create function public.create_family_invite(selected_scope text,allowed_account uuid default null,start_date date default null,end_date date default null,allow_proposals boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; identifier uuid;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 if allowed_account is not null and not exists(select 1 from public.financial_accounts where id=allowed_account and user_id=auth.uid()) then raise exception 'invalid account'; end if;
 if allow_proposals and selected_scope<>'transactions' then raise exception 'transaction scope required'; end if;
 if not public.consume_rate_limit(auth.uid(),'family-invite',10) then raise exception 'rate limit'; end if;
 token:=encode(extensions.gen_random_bytes(16),'hex');
 insert into public.family_invites(owner_id,token_hash,scope,account_id,period_start,period_end,can_propose) values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),selected_scope,allowed_account,start_date,end_date,allow_proposals) returning id into identifier;
 return jsonb_build_object('id',identifier,'code',token,'expires_at',now()+interval '24 hours');
end $$;
revoke all on function public.create_family_invite(text,uuid,date,date,boolean) from public,anon,authenticated;
grant execute on function public.create_family_invite(text,uuid,date,date,boolean) to authenticated;
create or replace function public.family_snapshot(invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare permission record; owner_name text; today date; income bigint; expenses bigint; rows jsonb; begin_date date; end_date date;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 select * into permission from public.family_invites where id=invite_id and viewer_id=auth.uid() and state='active';
 if not found then raise exception 'access not approved'; end if;
 select name,(now() at time zone timezone)::date into owner_name,today from public.profiles where id=permission.owner_id;
 begin_date:=coalesce(permission.period_start,date_trunc('month',today)::date);end_date:=least(coalesce(permission.period_end,today),today);
 select coalesce(sum(amount) filter(where type='income'),0),coalesce(sum(amount) filter(where type='expense'),0) into income,expenses
 from public.transactions where user_id=permission.owner_id and status='paid' and date between begin_date and end_date and (permission.account_id is null or account_id=permission.account_id);
 if income>9000000000000 or expenses>9000000000000 then raise exception 'money limit'; end if;
 rows:='[]'::jsonb;
 if permission.scope='transactions' then
    select coalesce(jsonb_agg(to_jsonb(record)),'[]'::jsonb) into rows from (select id,description,amount,type,category,date,status,source,null::uuid as account_id
     from public.transactions where user_id=permission.owner_id and date between begin_date and end_date and (permission.account_id is null or account_id=permission.account_id) order by date desc,id limit 100) record;
 end if;
 return jsonb_build_object('owner_name',owner_name,'month',to_char(today,'YYYY-MM'),'start',begin_date,'end',end_date,'income',income,'expenses',expenses,'net',income-expenses,'scope',permission.scope,'can_propose',permission.can_propose,'transactions',rows);
end $$;
create or replace function public.list_family_invites() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'owner_id',f.owner_id,'viewer_id',f.viewer_id,'account_id',f.account_id,'period_start',f.period_start,'period_end',f.period_end,'can_propose',f.can_propose,
    'owner_name',o.name,'viewer_name',v.name,'viewer_email',case when f.owner_id=auth.uid() then u.email else null end,'scope',f.scope,'state',f.state,'expires_at',f.expires_at) order by f.created_at desc),'[]'::jsonb)
 from public.family_invites f join public.profiles o on o.id=f.owner_id left join public.profiles v on v.id=f.viewer_id left join auth.users u on u.id=f.viewer_id where f.owner_id=auth.uid() or f.viewer_id=auth.uid());
end $$;
create table public.family_proposals (
 id uuid primary key default gen_random_uuid(), invite_id uuid not null references public.family_invites(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade, proposer_id uuid not null references public.profiles(id) on delete cascade,
 transaction_id uuid not null, before_data jsonb not null, proposed_data jsonb not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected')), created_at timestamptz not null default now()
);
alter table public.family_proposals enable row level security;
revoke all on public.family_proposals from anon,authenticated;
grant select on public.family_proposals to authenticated;
create policy proposal_participant on public.family_proposals for select to authenticated using(public.session_assured() and owner_id=auth.uid());
create function public.propose_family_correction(invite_id uuid,record_id uuid,new_description text,new_amount bigint,new_category text) returns uuid language plpgsql security definer set search_path='' as $$
declare permission record; original record; identifier uuid; today date;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 select * into permission from public.family_invites where id=invite_id and viewer_id=auth.uid() and state='active' and can_propose and scope='transactions';
 if not found then raise exception 'proposal not permitted'; end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=permission.owner_id;
 select * into original from public.transactions where id=record_id and user_id=permission.owner_id
 and date<=today and (permission.account_id is null or account_id=permission.account_id)
 and date>=coalesce(permission.period_start,date_trunc('month',today)::date) and date<=coalesce(permission.period_end,today)
 and id in (select id from public.transactions where user_id=permission.owner_id and date between coalesce(permission.period_start,date_trunc('month',today)::date) and least(coalesce(permission.period_end,today),today) and (permission.account_id is null or account_id=permission.account_id) order by date desc,id limit 100);
 if not found or length(new_description) not between 2 and 180 or new_amount not between 1 and 9000000000000 or length(new_category) not between 1 and 60 then raise exception 'invalid proposal'; end if;
 insert into public.family_proposals(invite_id,owner_id,proposer_id,transaction_id,before_data,proposed_data)
 values(invite_id,permission.owner_id,auth.uid(),record_id,to_jsonb(original),jsonb_build_object('description',new_description,'amount',new_amount,'category',new_category)) returning id into identifier;
 return identifier;
end $$;
create function public.decide_family_proposal(proposal_id uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare proposal record; current_row jsonb;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 select * into proposal from public.family_proposals where id=proposal_id and owner_id=auth.uid() and state='pending' for update;
 if not found then raise exception 'owner required'; end if;
 if not approve then update public.family_proposals set state='rejected' where id=proposal_id;return;end if;
 if not exists(select 1 from public.family_invites where id=proposal.invite_id and state='active' and can_propose) then raise exception 'permission revoked'; end if;
 select to_jsonb(t) into current_row from public.transactions t where id=proposal.transaction_id and user_id=auth.uid() for update;
 if current_row is distinct from proposal.before_data then raise exception 'record changed'; end if;
 update public.transactions set description=proposal.proposed_data->>'description',amount=(proposal.proposed_data->>'amount')::bigint,category=proposal.proposed_data->>'category' where id=proposal.transaction_id and user_id=auth.uid();
 update public.family_proposals set state='approved' where id=proposal_id;
end $$;
revoke all on function public.propose_family_correction(uuid,uuid,text,bigint,text),public.decide_family_proposal(uuid,boolean) from public,anon,authenticated;
grant execute on function public.propose_family_correction(uuid,uuid,text,bigint,text),public.decide_family_proposal(uuid,boolean) to authenticated;
alter table public.financial_notifications drop constraint financial_notifications_state_check;
alter table public.financial_notifications add constraint financial_notifications_state_check check(state in ('pending','processing','accepted','delivered','read','failed','cancelled','retry','reconcile'));
alter table public.financial_notifications add column attempts integer not null default 0,
 add column next_attempt_at timestamptz, add column lease_until timestamptz;
create function public.claim_financial_notification(notification_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare count integer;
begin
 update public.financial_notifications set state='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now()
 where id=notification_id and state in ('pending','retry') and attempts<3 and (next_attempt_at is null or next_attempt_at<=now()) returning attempts into count;
 return count;
end $$;
create function public.reconcile_expired_notifications() returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.financial_notifications set state='reconcile',lease_until=null,updated_at=now() where state='processing' and lease_until<now();
 get diagnostics changed=row_count;return changed;
end $$;
revoke all on function public.claim_financial_notification(uuid),public.reconcile_expired_notifications() from public,anon,authenticated;
grant execute on function public.claim_financial_notification(uuid),public.reconcile_expired_notifications() to service_role;