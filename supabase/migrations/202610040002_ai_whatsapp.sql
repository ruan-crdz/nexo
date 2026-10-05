create table public.knowledge_documents (
 id uuid primary key default gen_random_uuid(), title text not null, author text, organization text not null,
 source_type text not null, source_url text not null check(source_url like 'https://%'), publication_year integer,
 jurisdiction text not null default 'BR', topic text not null, subtopic text, content text not null, summary text not null,
 evidence_level text not null check(evidence_level in ('A','B','C','D')), license text not null,
 verified boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(source_url,topic)
);
create table public.knowledge_chunks (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.knowledge_documents(id) on delete cascade,
 content text not null, ordinal integer not null, embedding extensions.vector(1536),
 created_at timestamptz not null default now(), unique(document_id,ordinal)
);
create index knowledge_embedding_idx on public.knowledge_chunks using hnsw(embedding extensions.vector_cosine_ops);
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
create policy verified_knowledge on public.knowledge_documents for select to authenticated using(verified);
create policy verified_chunks on public.knowledge_chunks for select to authenticated using(exists(select 1 from public.knowledge_documents d where d.id=document_id and d.verified));
grant select on public.knowledge_documents,public.knowledge_chunks to authenticated;

create function public.match_knowledge(query_embedding extensions.vector(1536), match_count integer default 5)
returns table(id uuid,title text,source_url text,evidence_level text,content text,similarity double precision)
language sql stable security invoker set search_path='' as $$
 select c.id,d.title,d.source_url,d.evidence_level,c.content,1-(c.embedding operator(extensions.<=>) query_embedding)
 from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
 where d.verified and c.embedding is not null and (1-(c.embedding operator(extensions.<=>) query_embedding))>0.30
 order by (c.embedding operator(extensions.<=>) query_embedding) + case d.evidence_level when 'A' then 0 when 'B' then 0.02 when 'C' then 0.07 else 0.12 end
 limit least(greatest(match_count,1),8)
$$;
revoke all on function public.match_knowledge(extensions.vector,integer) from public;
grant execute on function public.match_knowledge(extensions.vector,integer) to authenticated,service_role;

create table public.ai_messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null check(length(content)<=16000),
 sources jsonb not null default '[]', created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;
create policy own_messages on public.ai_messages for select to authenticated using(user_id=(select auth.uid()));
create policy delete_own_messages on public.ai_messages for delete to authenticated using(user_id=(select auth.uid()));
grant select,delete on public.ai_messages to authenticated;
create index ai_messages_user_idx on public.ai_messages(user_id,created_at desc);

create table public.api_rate_limits (
 user_id uuid not null references auth.users(id) on delete cascade, bucket text not null,
 window_start timestamptz not null, requests integer not null, primary key(user_id,bucket)
);
alter table public.api_rate_limits enable row level security;
create function public.consume_rate_limit(subject uuid, bucket_name text, max_requests integer default 20) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
 insert into public.api_rate_limits(user_id,bucket,window_start,requests) values(subject,bucket_name,date_trunc('minute',now()),1)
 on conflict(user_id,bucket) do update set requests=case when public.api_rate_limits.window_start<date_trunc('minute',now()) then 1 else public.api_rate_limits.requests+1 end,window_start=date_trunc('minute',now()) returning requests into count_now;
 return count_now<=least(max_requests,100);
end $$;
revoke all on function public.consume_rate_limit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(uuid,text,integer) to service_role;

create table public.whatsapp_connections (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 phone text unique check(phone ~ '^\d{8,15}$'), consent_at timestamptz,
 token_hash text unique, token_expires_at timestamptz, created_at timestamptz not null default now()
);
alter table public.whatsapp_connections enable row level security;
create policy own_connection on public.whatsapp_connections for select to authenticated using(user_id=(select auth.uid()));
create policy revoke_connection on public.whatsapp_connections for delete to authenticated using(user_id=(select auth.uid()));
grant select,delete on public.whatsapp_connections to authenticated;

create table public.whatsapp_messages_metadata (
 message_id text primary key, user_id uuid references public.profiles(id) on delete cascade,
 state text not null default 'processing' check(state in ('processing','pending','complete','failed')),
 pending_payload jsonb, transaction_ids uuid[] not null default '{}', reply text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.whatsapp_messages_metadata enable row level security;
create policy own_metadata on public.whatsapp_messages_metadata for select to authenticated using(user_id=(select auth.uid()));
grant select on public.whatsapp_messages_metadata to authenticated;
create index whatsapp_metadata_user_idx on public.whatsapp_messages_metadata(user_id,created_at desc);

-- Atomic claim: concurrent retries cannot execute a message twice.
create function public.claim_whatsapp(message_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 insert into public.whatsapp_messages_metadata(message_id) values(message_key) on conflict do nothing;
 get diagnostics inserted=row_count; return inserted=1;
end $$;
revoke all on function public.claim_whatsapp(text) from public,anon,authenticated;
grant execute on function public.claim_whatsapp(text) to service_role;

create function public.link_whatsapp(hash text, sender text) returns uuid language plpgsql security definer set search_path='' as $$
declare linked uuid;
begin
 update public.whatsapp_connections set phone=sender,consent_at=now(),token_hash=null,token_expires_at=null
 where token_hash=hash and token_expires_at>now() returning user_id into linked;
 return linked;
end $$;
revoke all on function public.link_whatsapp(text,text) from public,anon,authenticated;
grant execute on function public.link_whatsapp(text,text) to service_role;

create function public.commit_whatsapp(message_key text, owner uuid, payload jsonb) returns uuid[] language plpgsql security definer set search_path='' as $$
declare item jsonb; ids uuid[]='{}'; new_id uuid; current_state text;
begin
 select state into current_state from public.whatsapp_messages_metadata where message_id=message_key for update;
 if current_state is null then raise exception 'message must be claimed'; end if;
 if current_state='complete' then select transaction_ids into ids from public.whatsapp_messages_metadata where message_id=message_key; return ids; end if;
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload) not between 1 and 20 then raise exception 'invalid batch'; end if;
 for item in select * from jsonb_array_elements(payload) loop
  insert into public.transactions(user_id,description,amount,type,category,date,status,source,external_id)
  values(owner,item->>'description',(item->>'amount')::bigint,item->>'type',item->>'category',(item->>'date')::date,coalesce(item->>'status','paid'),'whatsapp',message_key||':'||cardinality(ids)) returning id into new_id;
  ids=array_append(ids,new_id);
 end loop;
 update public.whatsapp_messages_metadata set user_id=owner,state='complete',pending_payload=null,transaction_ids=ids,updated_at=now() where message_id=message_key;
 return ids;
end $$;
revoke all on function public.commit_whatsapp(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_whatsapp(text,uuid,jsonb) to service_role;

create function public.undo_whatsapp(owner uuid) returns integer language plpgsql security definer set search_path='' as $$
declare message_key text; ids uuid[]; removed integer;
begin
 select message_id,transaction_ids into message_key,ids from public.whatsapp_messages_metadata
 where user_id=owner and state='complete' and cardinality(transaction_ids)>0 and created_at>now()-interval '24 hours'
 order by created_at desc limit 1 for update;
 if message_key is null then return 0; end if;
 delete from public.transactions where user_id=owner and id=any(ids) and source='whatsapp';
 get diagnostics removed=row_count;
 update public.whatsapp_messages_metadata set transaction_ids='{}',updated_at=now() where message_id=message_key;
 return removed;
end $$;
revoke all on function public.undo_whatsapp(uuid) from public,anon,authenticated;
grant execute on function public.undo_whatsapp(uuid) to service_role;
