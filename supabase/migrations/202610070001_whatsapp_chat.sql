create table public.whatsapp_chat_sessions (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 history jsonb not null default '[]' check(jsonb_typeof(history)='array'),
 expires_at timestamptz not null default now()+interval '10 minutes'
);
create table public.whatsapp_chat_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 message_id text not null references public.whatsapp_messages_metadata(message_id) on delete cascade,
 entity text not null check(entity in ('transactions','financial_accounts','goals','budgets','debts','assets','recurring_rules','profiles')),
 action text not null check(action in ('create','update','delete')),
 record_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 expected jsonb,
 state text not null default 'pending' check(state in ('pending','applied','cancelled')),
 result jsonb,
 expires_at timestamptz not null default now()+interval '10 minutes',
 created_at timestamptz not null default now()
);
alter table public.whatsapp_chat_sessions enable row level security;
alter table public.whatsapp_chat_requests enable row level security;
revoke all on public.whatsapp_chat_sessions,public.whatsapp_chat_requests from public,anon,authenticated;
grant all on public.whatsapp_chat_sessions,public.whatsapp_chat_requests to service_role;
create index whatsapp_chat_requests_owner on public.whatsapp_chat_requests(user_id,created_at desc);

create function public.confirm_whatsapp_chat(owner uuid, sender text, message_key text, proposal uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.whatsapp_chat_requests; current_row jsonb; field text; fields text; assignments text;
 allowed text[]; affected integer; reply_text text;
begin
 if not exists(select 1 from public.whatsapp_connections where user_id=owner and phone=sender and consent_at is not null) then
  raise exception 'whatsapp connection required';
 end if;
 perform 1 from public.whatsapp_messages_metadata where message_id=message_key and user_id=owner for update;
 if not found then raise exception 'claimed message ownership required';end if;
 select * into request from public.whatsapp_chat_requests where id=proposal and user_id=owner for update;
 if not found then raise exception 'proposal ownership required';end if;
 if request.state='applied' then return request.result;end if;
 if request.state<>'pending' or request.expires_at<=now() then raise exception 'proposal expired or cancelled';end if;
 if request.message_id=message_key then raise exception 'confirmation requires another message';end if;
 if exists(select 1 from public.whatsapp_messages_metadata where message_id=message_key and state='complete') then
  raise exception 'message already completed';
 end if;
 if request.entity='profiles' and (request.action<>'update' or request.record_id<>owner) then raise exception 'profile scope';end if;
 allowed:=case request.entity
  when 'transactions' then array['id','description','amount','type','category','date','status','source','account_id']
  when 'financial_accounts' then array['id','name','kind','opening_balance','closing_day','due_day','credit_limit']
  when 'goals' then array['id','name','target','monthly_contribution','deadline','priority','weekly_amount','purpose']
  when 'budgets' then array['id','category','limit_amount','month']
  when 'debts' then array['id','name','balance','rate_bps','minimum','due_date','overdue']
  when 'assets' then array['id','name','value','kind']
  when 'recurring_rules' then array['id','description','amount','category','start_date','active','type','frequency','end_date','annual_adjustment_bps']
  when 'profiles' then array['name','objective','monthly_income','fixed_expenses','dependents','variable_income','insured','timezone','active_goal_id','show_journey_points','checkin_frequency','journey_pause_until','journey_mode'] end;
 for field in select jsonb_object_keys(request.payload) loop
  if not field=any(allowed) or (request.action='update' and field='id') then raise exception 'unsupported field';end if;
 end loop;
 if request.action<>'create' then
  execute format('select to_jsonb(t) from public.%I t where id=$1 and %I=$2 for update',request.entity,
   case when request.entity='profiles' then 'id' else 'user_id' end)
   into current_row using request.record_id,owner;
  if current_row is null then raise exception 'record ownership required';end if;
  if current_row<>request.expected then raise exception 'record changed; prepare again';end if;
 else
  if request.payload->>'id' is distinct from request.record_id::text then raise exception 'record id mismatch';end if;
 end if;
 if request.action='delete' then
  execute format('delete from public.%I where id=$1 and user_id=$2',request.entity) using request.record_id,owner;
 elsif request.action='create' then
  select string_agg(format('%I',key),',') into fields from jsonb_object_keys(request.payload) key;
  execute format('insert into public.%I (%s,user_id) select %s,$2 from jsonb_populate_record(null::public.%I,$1)',
   request.entity,fields,fields,request.entity) using request.payload,owner;
 else
  select string_agg(format('%1$I=(select %1$I from jsonb_populate_record(null::public.%2$I,$1))',key,request.entity),',')
   into assignments from jsonb_object_keys(request.payload) key;
  if assignments is null then raise exception 'empty change';end if;
  execute format('update public.%I set %s where id=$2 and %I=$3',request.entity,assignments,
   case when request.entity='profiles' then 'id' else 'user_id' end) using request.payload,request.record_id,owner;
 end if;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'expected one affected record';end if;
 reply_text:=case request.action when 'delete' then 'Registro excluído.' when 'create' then 'Registro salvo.' else 'Registro atualizado.' end;
 update public.whatsapp_chat_requests set state='applied',result=jsonb_build_object('status','applied','entity',request.entity,'id',request.record_id,'message',reply_text)
  where id=request.id returning result into current_row;
 update public.whatsapp_messages_metadata set state='complete',reply=reply_text,updated_at=now() where message_id=message_key;
 return current_row;
end $$;
revoke all on function public.confirm_whatsapp_chat(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.confirm_whatsapp_chat(uuid,text,text,uuid) to service_role;

create function public.prune_whatsapp_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.whatsapp_chat_sessions where expires_at<now();
 delete from public.whatsapp_chat_requests where expires_at<now() and state<>'applied';
 return new;
end $$;
revoke all on function public.prune_whatsapp_chat() from public,anon,authenticated;
create trigger prune_whatsapp_chat_on_claim after insert on public.whatsapp_messages_metadata
 for each statement execute function public.prune_whatsapp_chat();