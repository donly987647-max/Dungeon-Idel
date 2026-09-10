alter table public.game_craft_jobs drop constraint if exists game_craft_jobs_status_check;
alter table public.game_craft_jobs add constraint game_craft_jobs_status_check check (status = any(array['running'::text,'queued'::text,'ready'::text,'done'::text]));
alter table public.game_sell_jobs drop constraint if exists game_sell_jobs_status_check;
alter table public.game_sell_jobs add constraint game_sell_jobs_status_check check (status = any(array['running'::text,'queued'::text,'ready'::text,'done'::text]));
