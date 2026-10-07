-- Keep the exact choices on retries, without repeating a financial operation.
alter table public.whatsapp_messages_metadata
  add column if not exists reply_buttons jsonb;
