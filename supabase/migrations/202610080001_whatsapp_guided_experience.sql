-- Native navigation state is private. Advancing a form and committing its final
-- financial write share one transaction, so old/double clicks cannot write twice.
create table public.whatsapp_guided_sessions (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 state jsonb not null check(jsonb_typeof(state)='object'),
 expires_at timestamptz not null default now()+interval '30 minutes'
);
alter table public.whatsapp_guided_sessions enable row level security;
revoke all on public.whatsapp_guided_sessions from public,anon,authenticated;
grant all on public.whatsapp_guided_sessions to service_role;
alter table public.whatsapp_messages_metadata add column followup_key text;

create function public.advance_whatsapp_guide(owner uuid,sender text,message_key text,
 flow_key uuid,expected_version integer,next_state jsonb,changes jsonb,
 response_text text,response_buttons jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_state jsonb; result jsonb; actual_reply text:=response_text;
begin
 if not exists(select 1 from public.whatsapp_connections where user_id=owner and phone=sender and consent_at is not null)
 then raise exception 'whatsapp connection required';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 perform 1 from public.whatsapp_messages_metadata where message_id=message_key and user_id=owner for update;
 if not found then raise exception 'claimed message ownership required';end if;
 select state into current_state from public.whatsapp_guided_sessions where user_id=owner and expires_at>now() for update;
 if expected_version>=0 and (current_state is null or current_state->>'id' is distinct from flow_key::text
   or (current_state->>'version')::integer is distinct from expected_version)
 then return jsonb_build_object('status','stale');end if;
 if changes is not null then
  if expected_version<0 or next_state is not null then raise exception 'completion requires active guide';end if;
  result:=public.save_whatsapp_batch(owner,sender,message_key,changes);
  if (result->>'saved')::integer=0 then actual_reply:='Esse registro já estava no Nexo. Não criei uma cópia.'||E'\n\nO que deseja fazer a seguir?';end if;
 end if;
 if next_state is null then delete from public.whatsapp_guided_sessions where user_id=owner;
 else
  if next_state->>'id' is distinct from flow_key::text or (next_state->>'version')::integer is distinct from expected_version+1
   then raise exception 'invalid guide version';end if;
  insert into public.whatsapp_guided_sessions(user_id,state,expires_at) values(owner,next_state,now()+interval '30 minutes')
   on conflict(user_id) do update set state=excluded.state,expires_at=excluded.expires_at;
 end if;
 -- A deterministic response is durable before the network send, including forms.
 update public.whatsapp_messages_metadata set state='complete',reply=actual_reply,reply_buttons=response_buttons,updated_at=now()
  where message_id=message_key;
 return jsonb_build_object('status',case when changes is null then 'advanced' else 'applied' end,'reply',actual_reply);
end $$;
revoke all on function public.advance_whatsapp_guide(uuid,text,text,uuid,integer,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.advance_whatsapp_guide(uuid,text,text,uuid,integer,jsonb,jsonb,text,jsonb) to service_role;
