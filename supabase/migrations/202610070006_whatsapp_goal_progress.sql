create function public.update_goal_progress_for(owner uuid, goal uuid, amount_delta bigint, event_reason text, request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row record; previous record; award integer:=0; balance bigint;
begin
 if amount_delta is null or amount_delta=0 or abs(amount_delta)>9000000000000 or event_reason is null or event_reason not in ('saving','withdrawal','emergency')
 or (event_reason='saving' and amount_delta<0) or (event_reason<>'saving' and amount_delta>0) or request is null then raise exception 'invalid progress';end if;
 select * into row from public.goals where id=goal and user_id=owner for update;
 if not found then raise exception 'goal ownership required';end if;
 select * into previous from public.goal_events where user_id=owner and request_id=request;
 if found then
  if previous.goal_id<>goal or previous.delta<>amount_delta or previous.reason<>event_reason then raise exception 'request changed';end if;
  return jsonb_build_object('saved',previous.balance_after,'points',0,'repeated',true);
 end if;
 balance:=row.saved+amount_delta;
 if balance<0 or balance>9000000000000 then raise exception 'invalid balance';end if;
 update public.goals set saved=balance where id=goal and user_id=owner;
 insert into public.goal_events(user_id,goal_id,delta,reason,balance_after,request_id) values(owner,goal,amount_delta,event_reason,balance,request);
 if amount_delta>0 then award:=public.award_habit_for(owner,'saving','saving:'||request::text);end if;
 return jsonb_build_object('saved',balance,'points',award,'repeated',false);
end $$;
revoke all on function public.update_goal_progress_for(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.update_goal_progress_for(uuid,uuid,bigint,text,uuid) to service_role;

create or replace function public.update_goal_progress(goal uuid,amount_delta bigint,event_reason text,request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 return public.update_goal_progress_for(auth.uid(),goal,amount_delta,event_reason,request);
end $$;

create function public.save_whatsapp_goal_progress(owner uuid,sender text,message_key text,selected_goal uuid,amount_delta bigint,event_reason text,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare goal_identifier uuid; candidates integer; previous jsonb; message_owner uuid; result jsonb; goal_name text;
begin
 if not exists(select 1 from public.whatsapp_connections where user_id=owner and phone=sender and consent_at is not null) then raise exception 'whatsapp connection required';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select user_id,batch_result into message_owner,previous from public.whatsapp_messages_metadata where message_id=message_key for update;
 if message_owner is distinct from owner then raise exception 'claimed message ownership required';end if;
 if previous is not null then
  if previous->>'kind' is distinct from 'goal_progress' or (selected_goal is not null and previous->>'goal_id' is distinct from selected_goal::text)
   or (previous->>'amount_delta')::bigint is distinct from amount_delta or previous->>'reason' is distinct from event_reason then raise exception 'message already used with different action';end if;
  return previous;
 end if;
 goal_identifier:=selected_goal;
 if goal_identifier is null then
    select g.id into goal_identifier from public.profiles p join public.goals g on g.id=p.active_goal_id and g.user_id=p.id where p.id=owner;
 end if;
 if goal_identifier is null then
  select count(*) into candidates from public.goals where user_id=owner and saved<target;
    if candidates=1 then select id into goal_identifier from public.goals where user_id=owner and saved<target;
  else
   select count(*) into candidates from public.goals where user_id=owner;
     if candidates=1 then select id into goal_identifier from public.goals where user_id=owner;
   else return jsonb_build_object('status','needs_goal','message','Diga em qual meta quer registrar esse valor. Nenhuma alteração foi salva.');end if;
  end if;
 end if;
 select name into goal_name from public.goals where id=goal_identifier and user_id=owner;
 if not found then raise exception 'goal ownership required';end if;
 result:=public.update_goal_progress_for(owner,goal_identifier,amount_delta,event_reason,request_id);
 result:=jsonb_build_object('status','applied','kind','goal_progress','goal_id',goal_identifier,'goal_name',goal_name,'amount_delta',amount_delta,'reason',event_reason,
  'goal_saved',result->'saved','points',result->'points','repeated',result->'repeated','no_transaction_created',true);
 update public.whatsapp_messages_metadata set state='complete',batch_result=result,
  reply='Progresso da meta atualizado. Nenhum gasto ou transferência foi criado.',updated_at=now() where message_id=message_key;
 return result;
end $$;
revoke all on function public.save_whatsapp_goal_progress(uuid,text,text,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.save_whatsapp_goal_progress(uuid,text,text,uuid,bigint,text,uuid) to service_role;