-- Retry only failures or abandoned processing leases, never committed writes.
create or replace function public.claim_whatsapp(message_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
 insert into public.whatsapp_messages_metadata(message_id) values(message_key)
 on conflict(message_id) do update set state='processing',updated_at=now()
 where public.whatsapp_messages_metadata.state='failed'
 or (public.whatsapp_messages_metadata.state='processing' and public.whatsapp_messages_metadata.updated_at<now()-interval '5 minutes');
 get diagnostics claimed=row_count; return claimed=1;
end $$;

alter table public.whatsapp_messages_metadata add column sent_at timestamptz;

create or replace function public.audit_business() returns trigger language plpgsql security definer set search_path='' as $$
declare old_json jsonb; new_json jsonb; org uuid;
begin
 if tg_op <> 'INSERT' then old_json=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_json=to_jsonb(new); end if;
 org=coalesce(new_json->>'organization_id',old_json->>'organization_id')::uuid;
 -- Whole-organization erasure cascades through its audit history as documented.
 if not exists(select 1 from public.organizations where id=org) then return coalesce(new,old); end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource,resource_id,before_data,after_data)
 values(org,auth.uid(),tg_op,tg_table_name,coalesce(new_json->>'id',old_json->>'id',new_json->>'user_id',old_json->>'user_id',new_json->>'organization_id',old_json->>'organization_id'),old_json,new_json);
 return coalesce(new,old);
end $$;

create function public.delete_organization(org uuid, confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.org_role(org) is distinct from 'owner' then raise exception 'owner required'; end if;
 if not exists(select 1 from public.organizations where id=org and name=confirmation) then raise exception 'name confirmation required'; end if;
 delete from public.organizations where id=org;
end $$;
revoke all on function public.delete_organization(uuid,text) from public,anon;
grant execute on function public.delete_organization(uuid,text) to authenticated;

create function public.prune_ephemeral_data() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.whatsapp_messages_metadata set pending_payload=null,state='failed' where state='pending' and created_at<now()-interval '10 minutes';
 update public.whatsapp_messages_metadata set reply=null where updated_at<now()-interval '24 hours';
 delete from public.whatsapp_messages_metadata where created_at<now()-interval '30 days';
 delete from public.api_rate_limits where window_start<now()-interval '1 day';
 update public.whatsapp_connections set token_hash=null,token_expires_at=null where token_expires_at<now();
end $$;
revoke all on function public.prune_ephemeral_data() from public,anon,authenticated;
grant execute on function public.prune_ephemeral_data() to service_role;
