-- Keep delivery diagnostics separate from committed financial writes.
alter table public.whatsapp_messages_metadata
 add column reply_message_id text,
 add column reply_error_code integer,
 add column delivery_status text check (delivery_status in ('accepted','delivered','read','failed'));
create index whatsapp_reply_message_idx on public.whatsapp_messages_metadata(reply_message_id)
 where reply_message_id is not null;
