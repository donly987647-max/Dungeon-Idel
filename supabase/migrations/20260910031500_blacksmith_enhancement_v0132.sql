-- v0.13.2 Blacksmith / equipment enhancement
alter table public.game_monster_equipment add column if not exists enhance_level integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='game_monster_equipment_enhance_level_check'
      and conrelid='public.game_monster_equipment'::regclass
  ) then
    alter table public.game_monster_equipment
      add constraint game_monster_equipment_enhance_level_check
      check (enhance_level between 0 and 10);
  end if;
end $$;

create table if not exists public.game_enhanced_inventory(
  player_id uuid not null,
  item_id text not null references public.game_item_defs(id) on update cascade on delete restrict,
  enhance_level integer not null check (enhance_level between 1 and 10),
  qty bigint not null default 0 check (qty>=0),
  updated_at timestamptz not null default now(),
  primary key(player_id,item_id,enhance_level)
);
alter table public.game_enhanced_inventory enable row level security;
create index if not exists game_enhanced_inventory_player_idx on public.game_enhanced_inventory(player_id,item_id);

insert into public.game_item_defs(id,slot,rarity,atk,def,hp,spd,crit,evade,human_damage,description,kind,sale_gold,sell_seconds)
values('강화석',null,'재료',0,0,0,0,0,0,0,'장비 강화에 사용하는 응축 마석. 대장간에서 강화 레벨이 높을수록 더 많이 필요하다.','material',0,0)
on conflict(id) do update set description=excluded.description,kind='material',sale_gold=0,sell_seconds=0;

update public.game_hunt_sites s
set loot=coalesce(s.loot,'[]'::jsonb) ||
  case s.id
    when 'mountain_village' then jsonb_build_array(
      jsonb_build_object('id','강화석','min',1,'max',1,'chance',0.07,'source','kill','enemy','*'),
      jsonb_build_object('id','강화석','min',1,'max',2,'chance',0.30,'source','kill','enemy',s.boss_name))
    when 'farm_road' then jsonb_build_array(
      jsonb_build_object('id','강화석','min',1,'max',1,'chance',0.09,'source','kill','enemy','*'),
      jsonb_build_object('id','강화석','min',1,'max',2,'chance',0.38,'source','kill','enemy',s.boss_name))
    when 'border_outpost' then jsonb_build_array(
      jsonb_build_object('id','강화석','min',1,'max',1,'chance',0.11,'source','kill','enemy','*'),
      jsonb_build_object('id','강화석','min',1,'max',3,'chance',0.48,'source','kill','enemy',s.boss_name))
    else '[]'::jsonb end
where s.id in ('mountain_village','farm_road','border_outpost')
  and not exists(select 1 from jsonb_array_elements(coalesce(s.loot,'[]'::jsonb)) j where j->>'id'='강화석');

create or replace function public.game_equipment_inventory()
returns table(item_id text,enhance_level integer,qty bigint)
language sql security definer set search_path=public as $$
  select i.item_id,0::integer,i.qty
  from public.game_inventory i
  join public.game_item_defs d on d.id=i.item_id and d.slot is not null
  where i.player_id=auth.uid() and i.qty>0
  union all
  select e.item_id,e.enhance_level,e.qty
  from public.game_enhanced_inventory e
  where e.player_id=auth.uid() and e.qty>0
  order by item_id,enhance_level desc;
$$;
revoke all on function public.game_equipment_inventory() from public,anon;
grant execute on function public.game_equipment_inventory() to authenticated;

create or replace function public.game_equip_item_level(p_monster uuid,p_item text,p_level integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_player uuid:=auth.uid();v_slot text;v_old_item text;v_old_level integer:=0;v_qty bigint;
begin
  if v_player is null then raise exception 'unauthorized'; end if;
  if coalesce(p_level,0) not between 0 and 10 then raise exception 'invalid_level'; end if;
  select slot into v_slot from public.game_item_defs where id=p_item;
  if v_slot is null then raise exception 'not_equipment'; end if;
  if not exists(select 1 from public.game_monsters where id=p_monster and player_id=v_player and released_at is null) then raise exception 'monster_missing'; end if;
  select item_id,enhance_level into v_old_item,v_old_level from public.game_monster_equipment where monster_id=p_monster and player_id=v_player and slot=v_slot for update;
  if v_old_item=p_item and coalesce(v_old_level,0)=coalesce(p_level,0) then return true; end if;
  if coalesce(p_level,0)=0 then select qty into v_qty from public.game_inventory where player_id=v_player and item_id=p_item for update;
  else select qty into v_qty from public.game_enhanced_inventory where player_id=v_player and item_id=p_item and enhance_level=p_level for update; end if;
  if coalesce(v_qty,0)<=0 then raise exception 'item_missing'; end if;
  if v_old_item is not null then
    if coalesce(v_old_level,0)>0 then
      insert into public.game_enhanced_inventory(player_id,item_id,enhance_level,qty) values(v_player,v_old_item,v_old_level,1)
      on conflict(player_id,item_id,enhance_level) do update set qty=public.game_enhanced_inventory.qty+1,updated_at=now();
    else
      insert into public.game_inventory(player_id,item_id,qty) values(v_player,v_old_item,1)
      on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+1;
    end if;
  end if;
  if coalesce(p_level,0)=0 then
    if v_qty=1 then delete from public.game_inventory where player_id=v_player and item_id=p_item;
    else update public.game_inventory set qty=qty-1 where player_id=v_player and item_id=p_item; end if;
  else
    if v_qty=1 then delete from public.game_enhanced_inventory where player_id=v_player and item_id=p_item and enhance_level=p_level;
    else update public.game_enhanced_inventory set qty=qty-1,updated_at=now() where player_id=v_player and item_id=p_item and enhance_level=p_level; end if;
  end if;
  insert into public.game_monster_equipment(monster_id,player_id,slot,item_id,enhance_level,equipped_at)
  values(p_monster,v_player,v_slot,p_item,coalesce(p_level,0),now())
  on conflict(monster_id,slot) do update set item_id=excluded.item_id,enhance_level=excluded.enhance_level,player_id=excluded.player_id,equipped_at=excluded.equipped_at;
  return true;
end $$;
revoke all on function public.game_equip_item_level(uuid,text,integer) from public,anon;
grant execute on function public.game_equip_item_level(uuid,text,integer) to authenticated;

create or replace function public.game_equip_item(p_player uuid,p_monster uuid,p_item text)
returns boolean language plpgsql set search_path=public as $$
declare v_slot text;v_old text;v_old_level integer:=0;v_qty bigint;
begin
  select slot into v_slot from public.game_item_defs where id=p_item;
  if v_slot is null then raise exception 'not_equipment'; end if;
  if not exists(select 1 from public.game_monsters where id=p_monster and player_id=p_player and released_at is null) then raise exception 'monster_missing'; end if;
  select qty into v_qty from public.game_inventory where player_id=p_player and item_id=p_item for update;
  if coalesce(v_qty,0)<=0 then raise exception 'item_missing'; end if;
  select item_id,enhance_level into v_old,v_old_level from public.game_monster_equipment where monster_id=p_monster and slot=v_slot for update;
  if v_old=p_item and coalesce(v_old_level,0)=0 then return true; end if;
  if v_old is not null then
    if coalesce(v_old_level,0)>0 then
      insert into public.game_enhanced_inventory(player_id,item_id,enhance_level,qty) values(p_player,v_old,v_old_level,1)
      on conflict(player_id,item_id,enhance_level) do update set qty=public.game_enhanced_inventory.qty+1,updated_at=now();
    else
      insert into public.game_inventory(player_id,item_id,qty) values(p_player,v_old,1)
      on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+1;
    end if;
  end if;
  if v_qty=1 then delete from public.game_inventory where player_id=p_player and item_id=p_item;
  else update public.game_inventory set qty=qty-1 where player_id=p_player and item_id=p_item; end if;
  insert into public.game_monster_equipment(monster_id,player_id,slot,item_id,enhance_level,equipped_at)
  values(p_monster,p_player,v_slot,p_item,0,now())
  on conflict(monster_id,slot) do update set item_id=excluded.item_id,enhance_level=0,player_id=excluded.player_id,equipped_at=excluded.equipped_at;
  return true;
end $$;

create or replace function public.game_unequip_item(p_player uuid,p_monster uuid,p_slot text)
returns boolean language plpgsql set search_path=public as $$
declare v_old text;v_level integer:=0;
begin
  if p_slot not in ('weapon','armor','accessory') then raise exception 'invalid_slot'; end if;
  select item_id,enhance_level into v_old,v_level from public.game_monster_equipment where monster_id=p_monster and player_id=p_player and slot=p_slot for update;
  if v_old is null then return true; end if;
  delete from public.game_monster_equipment where monster_id=p_monster and player_id=p_player and slot=p_slot;
  if coalesce(v_level,0)>0 then
    insert into public.game_enhanced_inventory(player_id,item_id,enhance_level,qty) values(p_player,v_old,v_level,1)
    on conflict(player_id,item_id,enhance_level) do update set qty=public.game_enhanced_inventory.qty+1,updated_at=now();
  else
    insert into public.game_inventory(player_id,item_id,qty) values(p_player,v_old,1)
    on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+1;
  end if;
  return true;
end $$;

create or replace function public.game_enhance_equipped(p_monster uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_player uuid:=auth.uid();v_item text;v_level integer;v_cost integer;v_success numeric;v_down numeric;v_destroy numeric;v_fail numeric;v_stones bigint;v_roll numeric;v_result text;v_new_level integer;
begin
  if v_player is null then raise exception 'unauthorized'; end if;
  if p_slot not in ('weapon','armor','accessory') then raise exception 'invalid_slot'; end if;
  if exists(select 1 from public.game_expedition_members em join public.game_expeditions ge on ge.id=em.expedition_id where em.monster_id=p_monster and ge.active=true) then raise exception 'monster_busy'; end if;
  select item_id,enhance_level into v_item,v_level from public.game_monster_equipment where player_id=v_player and monster_id=p_monster and slot=p_slot for update;
  if v_item is null then raise exception 'equipment_missing'; end if;
  if v_level>=10 then raise exception 'enhance_max'; end if;
  v_cost:=case v_level when 0 then 1 when 1 then 2 when 2 then 3 when 3 then 4 when 4 then 6 when 5 then 8 when 6 then 11 when 7 then 15 when 8 then 20 else 28 end;
  v_success:=case v_level when 0 then 1.00 when 1 then 0.90 when 2 then 0.80 when 3 then 0.70 when 4 then 0.60 when 5 then 0.52 when 6 then 0.44 when 7 then 0.36 when 8 then 0.28 else 0.20 end;
  v_down:=case v_level when 3 then 0.05 when 4 then 0.10 when 5 then 0.13 when 6 then 0.17 when 7 then 0.20 when 8 then 0.24 when 9 then 0.27 else 0 end;
  v_destroy:=case v_level when 4 then 0.05 when 5 then 0.07 when 6 then 0.09 when 7 then 0.12 when 8 then 0.15 when 9 then 0.18 else 0 end;
  v_fail:=greatest(0,1-v_success-v_down-v_destroy);
  select qty into v_stones from public.game_inventory where player_id=v_player and item_id='강화석' for update;
  if coalesce(v_stones,0)<v_cost then raise exception 'stone_short'; end if;
  if v_stones=v_cost then delete from public.game_inventory where player_id=v_player and item_id='강화석'; else update public.game_inventory set qty=qty-v_cost where player_id=v_player and item_id='강화석'; end if;
  v_roll:=random();v_new_level:=v_level;
  if v_roll<v_success then v_result:='success';v_new_level:=v_level+1;update public.game_monster_equipment set enhance_level=v_new_level where player_id=v_player and monster_id=p_monster and slot=p_slot;
  elsif v_roll<v_success+v_destroy then v_result:='destroy';v_new_level:=-1;delete from public.game_monster_equipment where player_id=v_player and monster_id=p_monster and slot=p_slot;
  elsif v_roll<v_success+v_destroy+v_down then v_result:='down';v_new_level:=greatest(0,v_level-1);update public.game_monster_equipment set enhance_level=v_new_level where player_id=v_player and monster_id=p_monster and slot=p_slot;
  else v_result:='fail'; end if;
  return jsonb_build_object('result',v_result,'itemId',v_item,'previousLevel',v_level,'newLevel',v_new_level,'cost',v_cost,'successRate',v_success,'failRate',v_fail,'downRate',v_down,'destroyRate',v_destroy);
end $$;
revoke all on function public.game_enhance_equipped(uuid,text) from public,anon;
grant execute on function public.game_enhance_equipped(uuid,text) to authenticated;

create or replace function public.game_release_monster(p_player uuid,p_monster uuid)
returns jsonb language plpgsql set search_path=public as $$
declare m public.game_monsters%rowtype;gear_count int:=0;
begin
  perform 1 from public.game_players where device_id=p_player for update;if not found then raise exception 'player_missing';end if;
  select * into m from public.game_monsters where id=p_monster and player_id=p_player and released_at is null for update;if m.id is null then raise exception 'monster_missing';end if;
  if exists(select 1 from public.game_expedition_members em join public.game_expeditions ge on ge.id=em.expedition_id where em.monster_id=m.id and ge.active=true) then raise exception 'monster_busy';end if;
  select count(*) into gear_count from public.game_monster_equipment q where q.player_id=p_player and q.monster_id=m.id;
  insert into public.game_inventory(player_id,item_id,qty) select p_player,q.item_id,count(*)::bigint from public.game_monster_equipment q where q.player_id=p_player and q.monster_id=m.id and coalesce(q.enhance_level,0)=0 group by q.item_id on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;
  insert into public.game_enhanced_inventory(player_id,item_id,enhance_level,qty) select p_player,q.item_id,q.enhance_level,count(*)::bigint from public.game_monster_equipment q where q.player_id=p_player and q.monster_id=m.id and q.enhance_level>0 group by q.item_id,q.enhance_level on conflict(player_id,item_id,enhance_level) do update set qty=public.game_enhanced_inventory.qty+excluded.qty,updated_at=now();
  delete from public.game_monster_equipment where player_id=p_player and monster_id=m.id;
  update public.game_expeditions set pending_xp=coalesce(pending_xp,'{}'::jsonb)-m.id::text,updated_at=now() where player_id=p_player and coalesce(pending_xp,'{}'::jsonb) ? m.id::text;
  update public.game_monsters set released_at=now() where id=m.id;
  return jsonb_build_object('monsterId',m.id,'name',m.name,'released',true,'gearReturned',gear_count);
end $$;

-- Apply +8% of item base stats per enhancement level to server combat calculations.
do $$
declare f text;
begin
  select pg_get_functiondef(p.oid) into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='game_process_expedition_action';
  if f is null then raise exception 'game_process_expedition_action missing';end if;
  f:=replace(f,'sum(d.hp) eq_hp,sum(d.spd) eq_spd,sum(d.evade) eq_evade','sum(d.hp*(1+coalesce(q.enhance_level,0)*0.08)) eq_hp,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade');
  f:=replace(f,'sum(d.atk) eq_atk,sum(d.def) eq_def,sum(d.hp) eq_hp,sum(d.spd) eq_spd,sum(d.crit) eq_crit,sum(d.evade) eq_evade,sum(d.human_damage) human_damage','sum(d.atk*(1+coalesce(q.enhance_level,0)*0.08)) eq_atk,sum(d.def*(1+coalesce(q.enhance_level,0)*0.08)) eq_def,sum(d.hp*(1+coalesce(q.enhance_level,0)*0.08)) eq_hp,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.crit*(1+coalesce(q.enhance_level,0)*0.08)) eq_crit,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade,sum(d.human_damage*(1+coalesce(q.enhance_level,0)*0.08)) human_damage');
  f:=replace(f,'sum(d.def) eq_def,sum(d.spd) eq_spd,sum(d.evade) eq_evade','sum(d.def*(1+coalesce(q.enhance_level,0)*0.08)) eq_def,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade');
  execute f;
end $$;
