alter table public.goals add column weekly_amount public.cents not null default 0,
 add column high_water public.cents not null default 0,add column purpose text not null default '' check(length(purpose)<=180);
update public.goals set high_water=saved;
alter table public.profiles add column active_goal_id uuid references public.goals(id) on delete set null,
 add column show_journey_points boolean not null default true,
 add column journey_style text not null default 'forest' check(journey_style in ('forest','ocean','sun','berry')),
 add column checkin_frequency text not null default 'weekly' check(checkin_frequency in ('daily','weekly')),
 add column journey_reminders boolean not null default false,add column journey_pause_until date,
 add column reminder_hour integer not null default 18 check(reminder_hour between 9 and 19),
 add column journey_mode text not null default 'steady' check(journey_mode in ('steady','recovery','pause'));
create table public.habit_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('checkin','reflection','message','record','saving')),day date not null,points integer not null check(points between 0 and 10),
 source_key text not null check(length(source_key) between 1 and 500),created_at timestamptz not null default now(),unique(user_id,source_key)
);
create table public.goal_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 goal_id uuid not null references public.goals(id) on delete cascade,delta bigint not null check(delta<>0 and abs(delta)<=9000000000000),
 reason text not null check(reason in ('saving','withdrawal','emergency')),balance_after public.cents not null,
 request_id uuid not null,created_at timestamptz not null default now(),unique(user_id,request_id)
);
alter table public.habit_events enable row level security;
alter table public.goal_events enable row level security;
revoke all on public.habit_events,public.goal_events from anon,authenticated;
grant select on public.habit_events,public.goal_events to authenticated;
create policy habits_owner on public.habit_events for select to authenticated using(user_id=auth.uid() and public.session_assured());
create policy goal_events_owner on public.goal_events for select to authenticated using(user_id=auth.uid() and public.session_assured());
create index habits_owner_day on public.habit_events(user_id,day desc);
create index goal_events_owner_date on public.goal_events(user_id,created_at desc);

create function public.award_habit_for(owner uuid,event_kind text,event_key text) returns integer language plpgsql security definer set search_path='' as $$
declare today date; amount integer; cap integer; enrolled integer; cadence text;
begin
 select (now() at time zone timezone)::date,checkin_frequency into today,cadence from public.profiles where id=owner;
 if today is null or event_kind not in ('checkin','reflection','message','record','saving') then raise exception 'invalid habit';end if;
 amount:=case event_kind when 'checkin' then 5 when 'reflection' then 10 when 'saving' then 10 else 2 end;
 cap:=case when event_kind in ('message','record') then 5 else 1 end;
 perform pg_advisory_xact_lock(hashtext(owner::text||':habit'));
 if exists(select 1 from public.habit_events where user_id=owner and source_key=event_key) then return 0;end if;
 select count(*) into enrolled from public.habit_events where user_id=owner and kind=event_kind
 and day>=case when event_kind='reflection' or (event_kind='checkin' and cadence='weekly') then date_trunc('week',today)::date else today end and day<=today;
 if enrolled>=cap then return 0;end if;
 insert into public.habit_events(user_id,kind,day,points,source_key) values(owner,event_kind,today,amount,event_key);
 return amount;
end $$;
revoke all on function public.award_habit_for(uuid,text,text) from public,anon,authenticated;
grant execute on function public.award_habit_for(uuid,text,text) to service_role;
create function public.journey_checkin(event_kind text,journey_state text default null) returns integer language plpgsql security definer set search_path='' as $$
declare today date;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 if event_kind not in ('checkin','reflection') then raise exception 'unsupported habit';end if;
 if not public.consume_rate_limit(auth.uid(),'journey-checkin',20) then raise exception 'rate limit';end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=auth.uid();
 if journey_state is not null then
  if journey_state not in ('steady','recovery','pause') then raise exception 'invalid journey mode';end if;
  update public.profiles set journey_mode=journey_state,journey_pause_until=case when journey_state='pause' then today+7 else null end where id=auth.uid();
 end if;
 return public.award_habit_for(auth.uid(),event_kind,event_kind||':'||today::text);
end $$;
revoke all on function public.journey_checkin(text,text) from public,anon,authenticated;
grant execute on function public.journey_checkin(text,text) to authenticated;

create function public.journey_goal_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.high_water:=new.saved;else new.high_water:=greatest(old.high_water,old.saved,new.saved);end if;
 return new;
end $$;
revoke all on function public.journey_goal_guard() from public,anon,authenticated;
create trigger journey_goal_peak before insert or update on public.goals for each row execute function public.journey_goal_guard();
create function public.journey_profile_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active_goal_id is not null and not exists(select 1 from public.goals where id=new.active_goal_id and user_id=new.id) then raise exception 'goal ownership required';end if;
 if new.journey_style<>'forest' and (select coalesce(sum(points),0) from public.habit_events where user_id=new.id)<75 then raise exception 'journey style not unlocked';end if;
 return new;
end $$;
revoke all on function public.journey_profile_guard() from public,anon,authenticated;
create trigger journey_profile_scope before insert or update on public.profiles for each row execute function public.journey_profile_guard();

create function public.save_journey_goal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare identifier uuid;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 identifier:=(payload->>'id')::uuid;
 if exists(select 1 from public.goals where id=identifier and user_id<>auth.uid()) then raise exception 'goal ownership required';end if;
 insert into public.goals(id,user_id,name,target,saved,monthly_contribution,deadline,priority,weekly_amount,purpose)
 values(identifier,auth.uid(),payload->>'name',(payload->>'target')::bigint,(payload->>'saved')::bigint,coalesce((payload->>'monthly_contribution')::bigint,0),(payload->>'deadline')::date,payload->>'priority',coalesce((payload->>'weekly_amount')::bigint,0),coalesce(payload->>'purpose',''))
 on conflict(id) do update set name=excluded.name,target=excluded.target,saved=excluded.saved,monthly_contribution=excluded.monthly_contribution,deadline=excluded.deadline,priority=excluded.priority,weekly_amount=excluded.weekly_amount,purpose=excluded.purpose;
 update public.profiles set active_goal_id=identifier where id=auth.uid();return identifier;
end $$;
create function public.update_goal_progress(goal uuid,amount_delta bigint,event_reason text,request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare row record; previous record; award integer:=0; balance bigint;
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 if amount_delta=0 or abs(amount_delta)>9000000000000 or event_reason not in ('saving','withdrawal','emergency')
 or (event_reason='saving' and amount_delta<0) or (event_reason<>'saving' and amount_delta>0) then raise exception 'invalid progress';end if;
 select * into row from public.goals where id=goal and user_id=auth.uid() for update;
 if not found then raise exception 'goal ownership required';end if;
 select * into previous from public.goal_events where user_id=auth.uid() and request_id=request;
 if found then
  if previous.goal_id<>goal or previous.delta<>amount_delta or previous.reason<>event_reason then raise exception 'request changed';end if;
  return jsonb_build_object('saved',previous.balance_after,'points',0,'repeated',true);
 end if;
 balance:=row.saved+amount_delta;
 if balance<0 or balance>9000000000000 then raise exception 'invalid balance';end if;
 update public.goals set saved=balance where id=goal and user_id=auth.uid();
 insert into public.goal_events(user_id,goal_id,delta,reason,balance_after,request_id) values(auth.uid(),goal,amount_delta,event_reason,balance,request);
 if amount_delta>0 then award:=public.award_habit_for(auth.uid(),'saving','saving:'||request::text);end if;
 return jsonb_build_object('saved',balance,'points',award,'repeated',false);
end $$;
revoke all on function public.save_journey_goal(jsonb),public.update_goal_progress(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.save_journey_goal(jsonb),public.update_goal_progress(uuid,bigint,text,uuid) to authenticated;

create function public.award_manual_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source='manual' and new.status='paid' then perform public.award_habit_for(new.user_id,'record','record:'||new.id::text);end if;
 return new;
end $$;
revoke all on function public.award_manual_record() from public,anon,authenticated;
create trigger journey_manual_record after insert on public.transactions for each row execute function public.award_manual_record();
alter table public.financial_notifications drop constraint financial_notifications_kind_check;
alter table public.financial_notifications add constraint financial_notifications_kind_check check(kind in ('bill','budget','weekly','journey'));