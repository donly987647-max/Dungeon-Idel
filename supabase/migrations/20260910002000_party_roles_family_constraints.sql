-- v0.12.6: allow all recruitable monster families.
alter table public.game_candidates drop constraint if exists game_candidates_family_check;
alter table public.game_candidates add constraint game_candidates_family_check
check (family = any(array['slime'::text,'goblin'::text,'troll'::text,'mandrake'::text,'imp'::text,'golem'::text]));

alter table public.game_monsters drop constraint if exists game_monsters_family_check;
alter table public.game_monsters add constraint game_monsters_family_check
check (family = any(array['slime'::text,'goblin'::text,'troll'::text,'mandrake'::text,'imp'::text,'golem'::text]));
