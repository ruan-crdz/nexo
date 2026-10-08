alter table public.profiles add column feature_tour_completed boolean not null default true;
alter table public.profiles alter column feature_tour_completed set default false;