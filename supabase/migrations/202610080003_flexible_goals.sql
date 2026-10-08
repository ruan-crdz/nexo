alter table public.goals alter column deadline drop not null;

create or replace function public.save_journey_goal(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare identifier uuid; current_saved bigint; requested_saved bigint; amount_delta bigint; goal_exists boolean;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 identifier:=(payload->>'id')::uuid;
 if exists(select 1 from public.goals where id=identifier and user_id<>auth.uid()) then raise exception 'goal ownership required';end if;
 select saved into current_saved from public.goals where id=identifier and user_id=auth.uid() for update;
 goal_exists:=found;
 if goal_exists then
  requested_saved:=(payload->>'saved')::bigint;
  if requested_saved is null then raise exception 'saved amount required';end if;
  amount_delta:=requested_saved-current_saved;
  update public.goals set name=payload->>'name',target=(payload->>'target')::bigint,saved=requested_saved,
   monthly_contribution=coalesce((payload->>'monthly_contribution')::bigint,0),deadline=(payload->>'deadline')::date,
   priority=payload->>'priority',weekly_amount=coalesce((payload->>'weekly_amount')::bigint,0),
   purpose=coalesce(payload->>'purpose','') where id=identifier and user_id=auth.uid();
  if amount_delta<>0 then
   insert into public.goal_events(user_id,goal_id,delta,reason,balance_after,request_id)
   values(auth.uid(),identifier,amount_delta,case when amount_delta>0 then 'saving' else 'withdrawal' end,
    requested_saved,gen_random_uuid());
  end if;
 else
  insert into public.goals(id,user_id,name,target,saved,monthly_contribution,deadline,priority,weekly_amount,purpose)
   values(identifier,auth.uid(),payload->>'name',(payload->>'target')::bigint,(payload->>'saved')::bigint,
    coalesce((payload->>'monthly_contribution')::bigint,0),(payload->>'deadline')::date,payload->>'priority',
    coalesce((payload->>'weekly_amount')::bigint,0),coalesce(payload->>'purpose',''));
 end if;
 update public.profiles set active_goal_id=identifier where id=auth.uid();
 return identifier;
end $$;