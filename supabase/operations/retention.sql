-- Supabase hosted operation; pg_cron is unavailable in the PGlite test database.
-- Run after migrations. The job name makes repeated scheduling idempotent.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('nexo-prune-ephemeral', '15 6 * * *', 'select public.prune_ephemeral_data();');
