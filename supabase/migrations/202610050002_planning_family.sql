alter table public.profiles add column reminders_enabled boolean not null default false,
 add column weekly_digest boolean not null default false,
 add column whatsapp_notifications boolean not null default false,
 add column notification_consent_at timestamptz;
create function public.record_notification_consent() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.whatsapp_notifications then new.notification_consent_at:=now(); else new.notification_consent_at:=null; end if;
  return new;
 end if;
 if new.whatsapp_notifications then
  if not old.whatsapp_notifications or old.notification_consent_at is null then new.notification_consent_at:=now();
  else new.notification_consent_at:=old.notification_consent_at; end if;
 else new.notification_consent_at:=null; end if;
 return new;
end $$;
revoke all on function public.record_notification_consent() from public,anon,authenticated;
create trigger notification_consent before insert or update on public.profiles for each row execute function public.record_notification_consent();

create table public.recurring_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 description text not null check(length(description) between 2 and 180), amount public.cents not null check(amount>0),
 category text not null check(length(category) between 1 and 60), start_date date not null,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recurring_occurrences (
 rule_id uuid not null references public.recurring_rules(id) on delete cascade,
 due_date date not null, transaction_id uuid references public.transactions(id) on delete set null,
 primary key(rule_id,due_date)
);
alter table public.recurring_rules enable row level security;
alter table public.recurring_occurrences enable row level security;
revoke all on public.recurring_rules,public.recurring_occurrences from anon,authenticated;
create policy recurring_owner on public.recurring_rules for all to authenticated
 using(user_id=auth.uid() and public.session_assured()) with check(user_id=auth.uid() and public.session_assured());
create policy occurrence_owner on public.recurring_occurrences for select to authenticated
 using(public.session_assured() and exists(select 1 from public.recurring_rules r where r.id=rule_id and r.user_id=auth.uid()));
grant select,insert,update,delete on public.recurring_rules to authenticated;
grant select on public.recurring_occurrences to authenticated;
create index recurring_user_idx on public.recurring_rules(user_id);
create trigger recurring_touch before update on public.recurring_rules for each row execute function public.touch_updated_at();

create function public.sync_recurring_rules_for(owner uuid) returns integer language plpgsql security definer set search_path='' as $$
declare rule record; today date; due date; offset_month integer; distance integer; identifier uuid; hash text; created integer:=0;
begin
 select (now() at time zone timezone)::date into today from public.profiles where id=owner;
 if today is null then raise exception 'invalid owner'; end if;
 if (select count(*) from public.recurring_rules where user_id=owner)>200 then raise exception 'recurrence limit'; end if;
 for rule in select * from public.recurring_rules where user_id=owner and active loop
  distance:=(extract(year from today)::integer-extract(year from rule.start_date)::integer)*12+extract(month from today)::integer-extract(month from rule.start_date)::integer;
  for offset_month in greatest(0,distance-1)..greatest(0,distance)+2 loop
   due:=(rule.start_date+make_interval(months=>offset_month))::date;
   if due>today+30 then continue; end if;
   perform pg_advisory_xact_lock(hashtext(rule.id::text));
   if exists(select 1 from public.recurring_occurrences where rule_id=rule.id and due_date=due) then continue; end if;
   hash:=encode(extensions.digest(decode('9667e0ce412e47d9a21291d1d616f74b','hex')||convert_to(rule.id::text||':'||due::text,'UTF8'),'sha1'),'hex');
  identifier:=(substr(hash,1,8)||'-'||substr(hash,9,4)||'-5'||substr(hash,14,3)||'-'||substr('89ab',((get_byte(decode(hash,'hex'),8)>>4)&3)+1,1)||substr(hash,18,3)||'-'||substr(hash,21,12))::uuid;
   insert into public.transactions(id,user_id,description,amount,type,category,date,status,source,external_id)
    values(identifier,owner,rule.description,rule.amount,'expense',rule.category,due,'planned','manual','recurring:'||rule.id::text||':'||due::text);
   insert into public.recurring_occurrences values(rule.id,due,identifier);
   created:=created+1;
  end loop;
 end loop;
 return created;
end $$;
revoke all on function public.sync_recurring_rules_for(uuid) from public,anon,authenticated;
grant execute on function public.sync_recurring_rules_for(uuid) to service_role;
create function public.sync_recurring_rules() returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 return public.sync_recurring_rules_for(auth.uid());
end $$;
revoke all on function public.sync_recurring_rules() from public,anon,authenticated;
grant execute on function public.sync_recurring_rules() to authenticated;

create function public.import_transactions(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved integer;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>1000 then raise exception 'invalid batch'; end if;
 if exists(select 1 from public.transactions t join jsonb_to_recordset(payload) as p(id uuid) on p.id=t.id where t.user_id<>auth.uid()) then raise exception 'invalid batch'; end if;
 insert into public.transactions(id,user_id,account_id,description,amount,type,category,date,status,source,external_id)
 select p.id,auth.uid(),p.account_id,p.description,p.amount,p.type,p.category,p.date,p.status,'import','import:'||p.id::text
 from jsonb_to_recordset(payload) as p(id uuid,account_id uuid,description text,amount bigint,type text,category text,date date,status text)
 on conflict(id) do nothing;
 get diagnostics saved=row_count;
 return jsonb_build_object('saved',saved,'skipped',jsonb_array_length(payload)-saved);
end $$;
revoke all on function public.import_transactions(jsonb) from public,anon,authenticated;
grant execute on function public.import_transactions(jsonb) to authenticated;

create table public.family_invites (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 viewer_id uuid references public.profiles(id) on delete cascade,
 token_hash text not null unique, scope text not null check(scope in ('summary','transactions')),
 state text not null default 'invited' check(state in ('invited','pending','active','revoked')),
 expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now(),
 check(viewer_id is null or viewer_id<>owner_id)
);
alter table public.family_invites enable row level security;
revoke all on public.family_invites from anon,authenticated;
create policy family_participant on public.family_invites for select to authenticated
 using(public.session_assured() and (owner_id=auth.uid() or viewer_id=auth.uid()));
grant select on public.family_invites to authenticated;

create function public.create_family_invite(selected_scope text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; identifier uuid;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 if not public.consume_rate_limit(auth.uid(),'family-invite',10) then raise exception 'rate limit'; end if;
 token:=encode(extensions.gen_random_bytes(16),'hex');
 insert into public.family_invites(owner_id,token_hash,scope) values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),selected_scope) returning id into identifier;
 return jsonb_build_object('id',identifier,'code',token,'expires_at',now()+interval '24 hours');
end $$;
create function public.request_family_access(invite_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 if not public.consume_rate_limit(auth.uid(),'family-request',10) then raise exception 'rate limit'; end if;
 if invite_code !~ '^[a-fA-F0-9]{32}$' then raise exception 'invalid invite'; end if;
 update public.family_invites set viewer_id=auth.uid(),state='pending' where token_hash=encode(extensions.digest(lower(invite_code),'sha256'),'hex')
  and state='invited' and expires_at>now() and owner_id<>auth.uid();
 if not found then raise exception 'invalid or expired invite'; end if;
end $$;
create function public.approve_family_access(invite_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 update public.family_invites set state='active' where id=invite_id and owner_id=auth.uid() and state='pending' and expires_at>now();
 if not found then raise exception 'owner approval required'; end if;
end $$;
create function public.revoke_family_access(invite_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 update public.family_invites set state='revoked' where id=invite_id and (owner_id=auth.uid() or viewer_id=auth.uid());
 if not found then raise exception 'participant required'; end if;
end $$;
create function public.family_snapshot(invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare permission record; owner_name text; today date; income bigint; expenses bigint; rows jsonb;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 select * into permission from public.family_invites where id=invite_id and viewer_id=auth.uid() and state='active';
 if not found then raise exception 'access not approved'; end if;
 select name,(now() at time zone timezone)::date into owner_name,today from public.profiles where id=permission.owner_id;
 select coalesce(sum(amount) filter(where type='income'),0),coalesce(sum(amount) filter(where type='expense'),0) into income,expenses
  from public.transactions where user_id=permission.owner_id and status='paid' and date between date_trunc('month',today)::date and today;
 if income>9000000000000 or expenses>9000000000000 then raise exception 'money limit'; end if;
 rows:='[]'::jsonb;
 if permission.scope='transactions' then
  select coalesce(jsonb_agg(to_jsonb(record)),'[]'::jsonb) into rows from (select id,description,amount,type,category,date,status,source,null::uuid as account_id
   from public.transactions where user_id=permission.owner_id and date<=today order by date desc,id limit 100) record;
 end if;
 return jsonb_build_object('owner_name',owner_name,'month',to_char(today,'YYYY-MM'),'income',income,'expenses',expenses,'net',income-expenses,'scope',permission.scope,'transactions',rows);
end $$;
revoke all on function public.create_family_invite(text),public.request_family_access(text),public.approve_family_access(uuid),public.revoke_family_access(uuid),public.family_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.create_family_invite(text),public.request_family_access(text),public.approve_family_access(uuid),public.revoke_family_access(uuid),public.family_snapshot(uuid) to authenticated;
create function public.list_family_invites() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'owner_id',f.owner_id,'viewer_id',f.viewer_id,
  'owner_name',o.name,'viewer_name',v.name,'viewer_email',case when f.owner_id=auth.uid() then u.email else null end,
  'scope',f.scope,'state',f.state,'expires_at',f.expires_at) order by f.created_at desc),'[]'::jsonb)
  from public.family_invites f join public.profiles o on o.id=f.owner_id left join public.profiles v on v.id=f.viewer_id
  left join auth.users u on u.id=f.viewer_id where f.owner_id=auth.uid() or f.viewer_id=auth.uid());
end $$;
revoke all on function public.list_family_invites() from public,anon,authenticated;
grant execute on function public.list_family_invites() to authenticated;
create table public.financial_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 dedupe_key text not null, kind text not null check(kind in ('bill','budget','weekly')),
 state text not null default 'pending' check(state in ('pending','processing','accepted','delivered','read','failed','cancelled')),
 reply_message_id text, error_code integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,dedupe_key)
);
alter table public.financial_notifications enable row level security;
revoke all on public.financial_notifications from anon,authenticated;
create policy notifications_owner on public.financial_notifications for select to authenticated using(user_id=auth.uid() and public.session_assured());
grant select on public.financial_notifications to authenticated;
create index notification_reply_idx on public.financial_notifications(reply_message_id) where reply_message_id is not null;