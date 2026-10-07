create or replace function public.save_whatsapp_batch(owner uuid, sender text, message_key text, changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; data jsonb; entity_name text; operation text; fields text; assignments text; allowed text[]; field text;
 target uuid; current_row jsonb; saved integer:=0; skipped integer:=0; results jsonb:='[]';
 previous jsonb; message_owner uuid; affected integer;
begin
 if not exists(select 1 from public.whatsapp_connections where user_id=owner and phone=sender and consent_at is not null) then raise exception 'whatsapp connection required';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select user_id,batch_result into message_owner,previous from public.whatsapp_messages_metadata where message_id=message_key for update;
 if message_owner is distinct from owner then raise exception 'claimed message ownership required';end if;
 if previous is not null then return previous;end if;
 perform 1 from public.whatsapp_chat_requests where user_id=owner and state='pending' order by id for update;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 30 then raise exception 'invalid batch';end if;
 for item in select value from jsonb_array_elements(changes) loop
  current_row:=null;
  entity_name:=item->>'entity'; operation:=coalesce(item->>'action','create');data:=item->'payload';
  if entity_name is null or entity_name not in ('transactions','financial_accounts','goals','budgets','debts','assets','recurring_rules','profiles') then raise exception 'unsupported entity';end if;
  if operation not in ('create','update','delete') then raise exception 'unsupported action';end if;
  target:=(item->>'id')::uuid;
  if entity_name='profiles' and (operation<>'update' or target is distinct from owner) then raise exception 'profile scope';end if;
  if data is null or jsonb_typeof(data)<>'object' then raise exception 'invalid payload';end if;
  allowed:=case entity_name
   when 'transactions' then array['id','description','amount','type','category','date','status','source','account_id']
   when 'financial_accounts' then array['id','name','kind','opening_balance','closing_day','due_day','credit_limit']
   when 'goals' then array['id','name','target','monthly_contribution','deadline','priority','weekly_amount','purpose']
   when 'budgets' then array['id','category','limit_amount','month']
   when 'debts' then array['id','name','balance','rate_bps','minimum','due_date','overdue']
   when 'assets' then array['id','name','value','kind']
   when 'recurring_rules' then array['id','description','amount','category','start_date','active','type','frequency','end_date','annual_adjustment_bps']
   when 'profiles' then array['name','objective','monthly_income','fixed_expenses','dependents','variable_income','insured','timezone','active_goal_id','show_journey_points','checkin_frequency','journey_pause_until','journey_mode'] end;
  for field in select jsonb_object_keys(data) loop
   if not field=any(allowed) or (operation<>'create' and field='id') then raise exception 'unsupported field';end if;
  end loop;
  if operation='create' then
   if entity_name='transactions' then data:=jsonb_set(data,'{source}','"whatsapp"');end if;
   execute format('select id from public.%I t where user_id=$1 and to_jsonb(t) @> $2 order by id limit 1',entity_name)
    into target using owner,data-'id'-'source';
   if target is not null then
    skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('entity',entity_name,'id',target,'status','already_exists'));continue;
   end if;
   target:=gen_random_uuid();data:=jsonb_set(data,'{id}',to_jsonb(target));
   select string_agg(format('%I',key),',') into fields from jsonb_object_keys(data) key;
   execute format('insert into public.%I (%s,user_id) select %s,$2 from jsonb_populate_record(null::public.%I,$1)',entity_name,fields,fields,entity_name) using data,owner;
  else
   execute format('select to_jsonb(t) from public.%I t where id=$1 and %I=$2 for update',entity_name,case when entity_name='profiles' then 'id' else 'user_id' end)
    into current_row using target,owner;
   if current_row is null then raise exception 'record ownership required';end if;
   if current_row is distinct from item->'expected' then raise exception 'record changed; read again';end if;
   if operation='delete' then
    execute format('delete from public.%I where id=$1 and user_id=$2',entity_name) using target,owner;
   else
    select string_agg(format('%1$I=(select %1$I from jsonb_populate_record(null::public.%2$I,$1))',key,entity_name),',') into assignments from jsonb_object_keys(data) key;
    if assignments is null then raise exception 'empty change';end if;
    execute format('update public.%I set %s where id=$2 and %I=$3',entity_name,assignments,case when entity_name='profiles' then 'id' else 'user_id' end) using data,target,owner;
   end if;
  end if;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'expected one affected record';end if;
  saved:=saved+1;
  results:=results||jsonb_build_array(jsonb_build_object('entity',entity_name,'id',target,'action',operation,'description',coalesce(data->>'description',data->>'name',current_row->>'description',current_row->>'name'),'status','applied'));
 end loop;
 previous:=jsonb_build_object('status','applied','saved',saved,'already_exists',skipped,'records',results);
 update public.whatsapp_chat_requests set state='cancelled' where user_id=owner and state='pending';
 update public.whatsapp_messages_metadata set state='complete',batch_result=previous,
  reply=format('Pronto! %s alteração(ões) concluída(s); %s registro(s) já existia(m). Confira no app.',saved,skipped),updated_at=now() where message_id=message_key;
 return previous;
end $$;
