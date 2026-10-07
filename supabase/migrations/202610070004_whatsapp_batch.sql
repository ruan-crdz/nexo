alter table public.whatsapp_messages_metadata add column batch_result jsonb;

-- One transaction for the whole user request. The inbound message is the retry key.
create function public.save_whatsapp_batch(owner uuid, sender text, message_key text, changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; data jsonb; entity_name text; fields text; allowed text[]; field text;
 existing_id uuid; new_id uuid; saved integer:=0; skipped integer:=0; results jsonb:='[]';
 previous jsonb; message_owner uuid;
begin
 if not exists(select 1 from public.whatsapp_connections where user_id=owner and phone=sender and consent_at is not null) then
  raise exception 'whatsapp connection required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select user_id,batch_result into message_owner,previous from public.whatsapp_messages_metadata where message_id=message_key for update;
 if message_owner is distinct from owner then raise exception 'claimed message ownership required'; end if;
 if previous is not null then return previous; end if;
 -- Serialize against old confirmation buttons before checking for existing records.
 perform 1 from public.whatsapp_chat_requests where user_id=owner and state='pending' order by id for update;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 30 then raise exception 'invalid batch'; end if;
 for item in select value from jsonb_array_elements(changes) loop
  entity_name:=item->>'entity'; data:=item->'payload';
  if entity_name not in ('transactions','recurring_rules') or entity_name is null then raise exception 'unsupported batch entity';end if;
  if data is null or jsonb_typeof(data)<>'object' then raise exception 'invalid payload';end if;
  allowed:=case entity_name
   when 'transactions' then array['id','description','amount','type','category','date','status','source','account_id']
   else array['id','description','amount','category','start_date','active','type','frequency','end_date','annual_adjustment_bps'] end;
  for field in select jsonb_object_keys(data) loop
   if not field=any(allowed) then raise exception 'unsupported field';end if;
  end loop;
  if entity_name='transactions' then data:=jsonb_set(data,'{source}','"whatsapp"');end if;
  -- Exact existing records are reported, never silently inserted again on "continue".
  execute format('select id from public.%I t where user_id=$1 and to_jsonb(t) @> $2 order by id limit 1',entity_name)
   into existing_id using owner,data-'id'-'source';
  if existing_id is not null then
   skipped:=skipped+1;
   results:=results||jsonb_build_array(jsonb_build_object('entity',entity_name,'id',existing_id,'description',data->>'description','status','already_exists'));
   continue;
  end if;
  new_id:=gen_random_uuid();data:=jsonb_set(data,'{id}',to_jsonb(new_id));
  select string_agg(format('%I',key),',') into fields from jsonb_object_keys(data) key;
  execute format('insert into public.%I (%s,user_id) select %s,$2 from jsonb_populate_record(null::public.%I,$1)',entity_name,fields,fields,entity_name)
   using data,owner;
  saved:=saved+1;
  results:=results||jsonb_build_array(jsonb_build_object('entity',entity_name,'id',new_id,'description',data->>'description','amount',data->'amount','status','saved'));
 end loop;
 previous:=jsonb_build_object('status','applied','saved',saved,'already_exists',skipped,'records',results);
 update public.whatsapp_chat_requests set state='cancelled' where user_id=owner and state='pending' and action='create' and entity in ('transactions','recurring_rules');
 update public.whatsapp_messages_metadata set state='complete',batch_result=previous,
  reply=format('Pronto! %s registro(s) salvo(s); %s já existia(m). Confira no app.',saved,skipped),updated_at=now()
  where message_id=message_key;
 return previous;
end $$;
revoke all on function public.save_whatsapp_batch(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_whatsapp_batch(uuid,text,text,jsonb) to service_role;
