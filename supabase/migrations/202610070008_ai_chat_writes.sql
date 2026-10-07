create table public.ai_chat_writes (
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table public.ai_chat_writes enable row level security;
revoke all on public.ai_chat_writes from public,anon,authenticated;
grant all on public.ai_chat_writes to service_role;

create function public.save_ai_chat_batch(request uuid, changes jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); previous jsonb; item jsonb; data jsonb; entity_name text; operation text;
 target uuid; current_row jsonb; allowed text[]; field text; fields text; assignments text;
 affected integer; saved integer:=0; results jsonb:='[]'; result jsonb;
begin
 if owner is null or not public.session_assured() then raise exception 'authentication required';end if;
 if request is null then raise exception 'request id required';end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 30 then raise exception 'invalid batch';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select ai.result into previous from public.ai_chat_writes ai where ai.user_id=owner and ai.request_id=request;
 if previous is not null then return previous;end if;
 for item in select value from jsonb_array_elements(changes) loop
  entity_name:=item->>'entity';operation:=item->>'action';data:=item->'payload';target:=nullif(item->>'id','')::uuid;current_row:=null;
  if entity_name is null or entity_name not in ('transactions','financial_accounts','goals','budgets','debts','assets','recurring_rules','profiles') then raise exception 'unsupported entity';end if;
  if operation not in ('create','update','delete') or data is null or jsonb_typeof(data)<>'object' then raise exception 'invalid change';end if;
  if entity_name='profiles' and (operation<>'update' or target is distinct from owner) then raise exception 'profile scope';end if;
  allowed:=case entity_name
    when 'transactions' then array['id','description','amount','type','category','date','status','account_id','source']
   when 'financial_accounts' then array['id','name','kind','opening_balance','closing_day','due_day','credit_limit']
   when 'goals' then array['id','name','target','monthly_contribution','deadline','priority','weekly_amount','purpose']
   when 'budgets' then array['id','category','limit_amount','month']
   when 'debts' then array['id','name','balance','rate_bps','minimum','due_date','overdue']
   when 'assets' then array['id','name','value','kind']
   when 'recurring_rules' then array['id','description','amount','category','start_date','active','type','frequency','end_date','annual_adjustment_bps']
   when 'profiles' then array['name','objective','monthly_income','fixed_expenses','dependents','variable_income','insured','timezone','active_goal_id','show_journey_points','checkin_frequency','journey_pause_until','journey_mode'] end;
  for field in select jsonb_object_keys(data) loop
    if not field=any(allowed) or (operation<>'create' and (field='id' or (entity_name='transactions' and field='source'))) then raise exception 'unsupported field';end if;
  end loop;
  if operation='create' then
   if entity_name='profiles' then raise exception 'profile create not supported';end if;
    target:=coalesce(nullif(data->>'id','')::uuid,gen_random_uuid());
   data:=jsonb_set(data,'{id}',to_jsonb(target));
    if entity_name='transactions' then data:=jsonb_set(data,'{source}','"manual"');end if;
   select string_agg(format('%I',key),',') into fields from jsonb_object_keys(data) key;
   execute format('insert into public.%I (%s,user_id) select %s,$2 from jsonb_populate_record(null::public.%I,$1)',entity_name,fields,fields,entity_name) using data,owner;
   if entity_name='goals' then update public.profiles set active_goal_id=target where id=owner;end if;
  else
   if target is null then raise exception 'record id required';end if;
   execute format('select to_jsonb(t) from public.%I t where id=$1 and %I=$2 for update',entity_name,case when entity_name='profiles' then 'id' else 'user_id' end) into current_row using target,owner;
   if current_row is null then raise exception 'record ownership required';end if;
   if current_row is distinct from item->'expected' then raise exception 'record changed; read again';end if;
   if operation='delete' then
    if entity_name='profiles' then raise exception 'profile delete not supported';end if;
    execute format('delete from public.%I where id=$1 and user_id=$2',entity_name) using target,owner;
   else
    select string_agg(format('%1$I=(select %1$I from jsonb_populate_record(null::public.%2$I,$1))',key,entity_name),',') into assignments from jsonb_object_keys(data) key;
    if assignments is null then raise exception 'empty change';end if;
    execute format('update public.%I set %s where id=$2 and %I=$3',entity_name,assignments,case when entity_name='profiles' then 'id' else 'user_id' end) using data,target,owner;
   end if;
  end if;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'expected one affected row';end if;
  saved:=saved+1;
  results:=results||jsonb_build_array(jsonb_build_object('entity',entity_name,'id',target,'action',operation,'name',coalesce(data->>'name',data->>'description',current_row->>'name',current_row->>'description'),'status','applied'));
 end loop;
 result:=jsonb_build_object('status','applied','saved',saved,'records',results);
 insert into public.ai_chat_writes(user_id,request_id,result) values(owner,request,result);
 return result;
end $$;
revoke all on function public.save_ai_chat_batch(uuid,jsonb) from public,anon;
grant execute on function public.save_ai_chat_batch(uuid,jsonb) to authenticated;
