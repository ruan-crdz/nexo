alter table public.whatsapp_messages_metadata
 add column reply_kind text not null default 'text' check(reply_kind in ('text','image'));
alter table public.whatsapp_messages_metadata drop constraint whatsapp_messages_metadata_delivery_status_check;
alter table public.whatsapp_messages_metadata add constraint whatsapp_messages_metadata_delivery_status_check
 check(delivery_status in ('accepted','delivered','read','failed','reconcile'));

create table public.whatsapp_reply_media (
 message_id text primary key references public.whatsapp_messages_metadata(message_id) on delete cascade,
 mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 image_base64 text not null check(length(image_base64) between 1 and 6666668),
 expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.whatsapp_reply_media enable row level security;
revoke all on public.whatsapp_reply_media from public,anon,authenticated;
grant all on public.whatsapp_reply_media to service_role;

create function public.claim_whatsapp_reply(message_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
 update public.whatsapp_messages_metadata set delivery_status='reconcile'
 where message_id=message_key and sent_at is null and reply_message_id is null
 and state in ('complete','pending','failed') and (delivery_status is null or delivery_status='failed');
 get diagnostics claimed=row_count;
 return claimed=1;
end $$;
revoke all on function public.claim_whatsapp_reply(text) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_reply(text) to service_role;

create or replace function public.prune_whatsapp_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.whatsapp_chat_sessions where expires_at<now();
 delete from public.whatsapp_chat_requests where expires_at<now() and state<>'applied';
 delete from public.whatsapp_reply_media where expires_at<now();
 return new;
end $$;

create or replace function public.prune_ephemeral_data() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.whatsapp_messages_metadata set pending_payload=null,state='failed' where state='pending' and created_at<now()-interval '10 minutes';
 update public.whatsapp_messages_metadata set reply=null where updated_at<now()-interval '24 hours';
 delete from public.whatsapp_reply_media where expires_at<now();
 delete from public.whatsapp_messages_metadata where created_at<now()-interval '30 days';
 delete from public.api_rate_limits where window_start<now()-interval '1 day';
 update public.whatsapp_connections set token_hash=null,token_expires_at=null where token_expires_at<now();
end $$;