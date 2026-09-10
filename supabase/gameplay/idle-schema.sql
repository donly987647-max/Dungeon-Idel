-- Existing balances and possessions are untouched. Only new companies start at 0.
alter table public.game_players alter column gold set default 0;
alter table public.game_players add column if not exists idle_automation boolean not null default true;
alter table public.game_players add column if not exists auto_reinvest boolean not null default true;
alter table public.game_players add column if not exists auto_advance boolean not null default true;
alter table public.game_players add column if not exists auto_equip boolean not null default true;
alter table public.game_players add column if not exists idle_last_at timestamptz;
alter table public.game_players add column if not exists idle_receipt jsonb not null default '{}'::jsonb;
alter table public.game_monsters add column if not exists field_hp integer check(field_hp>=0);
alter table public.game_monsters add column if not exists recovery_actions integer not null default 0 check(recovery_actions between 0 and 15);
alter table public.game_monsters add column if not exists service_points bigint not null default 0 check(service_points>=0);
alter table public.game_monsters add column if not exists evolution_plan jsonb not null default '{}'::jsonb;
alter table public.game_expeditions add column if not exists idle_actions bigint not null default 0;
alter table public.game_expeditions add column if not exists regroup_remaining integer not null default 0;
alter table public.game_stage_progress add column if not exists boss_misses integer not null default 0;
-- Carry current expedition injuries into the persistent employee health record.
update public.game_monsters m set field_hp=greatest(0,(e.battle_state->'partyHp'->>m.id::text)::int),
 recovery_actions=case when (e.battle_state->'partyHp'->>m.id::text)::int=0 then 12 else 0 end
from public.game_expedition_members em join public.game_expeditions e on e.id=em.expedition_id
where em.monster_id=m.id and e.active and m.field_hp is null and e.battle_state->'partyHp' ? m.id::text;
-- Equipment recipes produce assets, not sale goods.
alter table public.game_recipes drop constraint if exists game_recipes_sale_gold_check;
alter table public.game_recipes drop constraint if exists game_recipes_sell_seconds_check;
alter table public.game_recipes add constraint game_recipes_sale_gold_check check(sale_gold>=0);
alter table public.game_recipes add constraint game_recipes_sell_seconds_check check((sale_gold=0 and sell_seconds=0) or (sale_gold>0 and sell_seconds>0));
