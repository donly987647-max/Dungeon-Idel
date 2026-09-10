-- v0.13.14 — extend blacksmith enhancement to +20.
-- Existing +0~+10 balance is preserved; +10~+20 becomes the high-risk endgame band.

alter table public.game_monster_equipment
  drop constraint if exists game_monster_equipment_enhance_level_check;

alter table public.game_monster_equipment
  add constraint game_monster_equipment_enhance_level_check
  check (enhance_level >= 0 and enhance_level <= 20);

create or replace function public.game_enhance_equipped(p_monster uuid, p_slot text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player uuid:=auth.uid();
  v_item text;
  v_level integer;
  v_cost integer;
  v_success numeric;
  v_down numeric;
  v_destroy numeric;
  v_fail numeric;
  v_stones bigint;
  v_roll numeric;
  v_result text;
  v_new_level integer;
begin
  if v_player is null then raise exception 'unauthorized'; end if;
  if p_slot not in ('weapon','armor','accessory') then raise exception 'invalid_slot'; end if;
  if exists(select 1 from public.game_expedition_members em join public.game_expeditions ge on ge.id=em.expedition_id where em.monster_id=p_monster and ge.active=true) then raise exception 'monster_busy'; end if;
  select item_id,enhance_level into v_item,v_level from public.game_monster_equipment where player_id=v_player and monster_id=p_monster and slot=p_slot for update;
  if v_item is null then raise exception 'equipment_missing'; end if;
  if v_level>=20 then raise exception 'enhance_max'; end if;

  v_cost:=case v_level when 0 then 1 when 1 then 2 when 2 then 3 when 3 then 4 when 4 then 6 when 5 then 8 when 6 then 11 when 7 then 15 when 8 then 20 when 9 then 28 when 10 then 38 when 11 then 50 when 12 then 65 when 13 then 82 when 14 then 102 when 15 then 125 when 16 then 152 when 17 then 184 when 18 then 220 else 260 end;
  v_success:=case v_level when 0 then 1.00 when 1 then 0.85 when 2 then 0.75 when 3 then 0.65 when 4 then 0.55 when 5 then 0.47 when 6 then 0.39 when 7 then 0.32 when 8 then 0.25 when 9 then 0.18 when 10 then 0.16 when 11 then 0.15 when 12 then 0.14 when 13 then 0.13 when 14 then 0.12 when 15 then 0.11 when 16 then 0.10 when 17 then 0.09 when 18 then 0.08 else 0.07 end;
  v_down:=case v_level when 3 then 0.07 when 4 then 0.12 when 5 then 0.15 when 6 then 0.19 when 7 then 0.22 when 8 then 0.26 when 9 then 0.30 when 10 then 0.31 when 11 then 0.32 when 12 then 0.33 when 13 then 0.34 when 14 then 0.35 when 15 then 0.36 when 16 then 0.37 when 17 then 0.38 when 18 then 0.39 when 19 then 0.40 else 0 end;
  v_destroy:=case v_level when 4 then 0.05 when 5 then 0.07 when 6 then 0.09 when 7 then 0.12 when 8 then 0.15 when 9 then 0.18 when 10 then 0.19 when 11 then 0.20 when 12 then 0.21 when 13 then 0.22 when 14 then 0.23 when 15 then 0.24 when 16 then 0.25 when 17 then 0.26 when 18 then 0.27 when 19 then 0.28 else 0 end;
  v_fail:=greatest(0,1-v_success-v_down-v_destroy);

  select qty into v_stones from public.game_inventory where player_id=v_player and item_id='강화석' for update;
  if coalesce(v_stones,0)<v_cost then raise exception 'stone_short'; end if;
  if v_stones=v_cost then delete from public.game_inventory where player_id=v_player and item_id='강화석'; else update public.game_inventory set qty=qty-v_cost where player_id=v_player and item_id='강화석'; end if;

  v_roll:=random();
  v_new_level:=v_level;
  if v_roll<v_success then
    v_result:='success';v_new_level:=v_level+1;
    update public.game_monster_equipment set enhance_level=v_new_level where player_id=v_player and monster_id=p_monster and slot=p_slot;
  elsif v_roll<v_success+v_destroy then
    v_result:='destroy';v_new_level:=-1;
    delete from public.game_monster_equipment where player_id=v_player and monster_id=p_monster and slot=p_slot;
  elsif v_roll<v_success+v_destroy+v_down then
    v_result:='down';v_new_level:=greatest(0,v_level-1);
    update public.game_monster_equipment set enhance_level=v_new_level where player_id=v_player and monster_id=p_monster and slot=p_slot;
  else
    v_result:='fail';
  end if;

  return jsonb_build_object('result',v_result,'itemId',v_item,'previousLevel',v_level,'newLevel',v_new_level,'cost',v_cost,'successRate',v_success,'failRate',v_fail,'downRate',v_down,'destroyRate',v_destroy);
end
$function$;