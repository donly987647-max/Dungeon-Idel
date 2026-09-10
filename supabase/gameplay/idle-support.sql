create or replace function public.game_monster_max_hp(p_monster uuid)
returns integer language sql stable set search_path=public as $$
 select greatest(1,round(m.hp_base+(greatest(1,m.level)-1)*9*(case m.growth_grade when 'S' then 1.21 when 'A' then 1.13 when 'B' then 1.06 else 1 end)+greatest(0,m.talent-80)*2+coalesce((select sum(d.hp*(1+q.enhance_level*.08)) from game_monster_equipment q join game_item_defs d on d.id=q.item_id where q.monster_id=m.id),0)))::integer from game_monsters m where m.id=p_monster
$$;
create or replace function public.game_apply_death_xp_penalty(p_monster uuid)
returns integer language sql set search_path=public as $$select 0$$;
create or replace function public.game_boss_roll_for_site(p_player uuid,p_site text,p_chance numeric)
returns boolean language plpgsql set search_path=public as $$
declare p game_stage_progress%rowtype; result boolean;
begin
 select * into p from game_stage_progress where player_id=p_player and site_id=p_site for update;
 if not coalesce(p.boss_ready or p.boss_cleared or p.normal_battles>=500,false) then return false;end if;
 result:=p.boss_misses>=99 or random()<p_chance;
 update game_stage_progress set boss_misses=case when result then 0 else boss_misses+1 end where player_id=p_player and site_id=p_site;
 return result;
end $$;
create or replace function public.game_apply_service(p_expedition uuid)
returns jsonb language plpgsql set search_path=public as $$
declare m record; next_grade text; notices jsonb:='[]'; old_rank integer; new_rank integer;
begin
 for m in select x.* from game_expedition_members em join game_monsters x on x.id=em.monster_id where em.expedition_id=p_expedition order by em.position for update of x loop
  next_grade:=case when m.service_points+1>=2000 then 'S' when m.service_points+1>=800 then 'A' when m.service_points+1>=200 then 'B' else 'C' end;
  old_rank:=array_position(array['C','B','A','S'],m.growth_grade);new_rank:=array_position(array['C','B','A','S'],next_grade);
  update game_monsters set service_points=service_points+1,growth_grade=case when new_rank>old_rank then next_grade else growth_grade end where id=m.id;
  if new_rank>old_rank then notices:=notices||jsonb_build_array(jsonb_build_object('monsterId',m.id,'name',m.name,'grade',next_grade));end if;
 end loop;
 return notices;
end $$;
create or replace function public.game_auto_evolve(p_expedition uuid)
returns jsonb language plpgsql set search_path=public as $$
declare m record; evo game_evolution_defs%rowtype; notices jsonb:='[]';
begin
 for m in select x.* from game_expedition_members em join game_monsters x on x.id=em.monster_id where em.expedition_id=p_expedition order by em.position for update of x loop
  select * into evo from game_evolution_defs where base_family=m.family and from_form_id=m.form_id and required_level<=m.level
  order by (id=coalesce(m.evolution_plan->>m.form_id,'')) desc,id limit 1;
  if not found then continue;end if;
  update game_monsters set form_id=evo.target_form_id,evolution_tier=evo.tier,skill_id=evo.skill_id,name=evo.target_name,
   hp_base=greatest(1,round(hp_base*evo.hp_mult)),atk_base=greatest(1,round(atk_base*evo.atk_mult)),def_base=greatest(0,round(def_base*evo.def_mult)),
   spd_base=greatest(1,round(spd_base*evo.spd_mult)),power_base=greatest(1,round(power_base*evo.power_mult)),
   crit_base=least(.45,crit_base+evo.crit_add),evade_base=least(.35,evade_base+evo.evade_add),evolved_at=now() where id=m.id;
  notices:=notices||jsonb_build_array(jsonb_build_object('monsterId',m.id,'name',evo.target_name,'tier',evo.tier));
 end loop;
 return notices;
end $$;
create or replace function public.game_set_idle_policy(p_player uuid,p_settings jsonb)
returns boolean language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
 if jsonb_typeof(p_settings)<>'object' then raise exception 'invalid_settings';end if;
 update game_players set idle_automation=coalesce((p_settings->>'idle_automation')::boolean,idle_automation),
 auto_reinvest=coalesce((p_settings->>'auto_reinvest')::boolean,auto_reinvest),auto_advance=coalesce((p_settings->>'auto_advance')::boolean,auto_advance),auto_equip=coalesce((p_settings->>'auto_equip')::boolean,auto_equip) where device_id=p_player;
 return found;
end $$;
create or replace function public.game_plan_evolution(p_player uuid,p_monster uuid,p_evolution text)
returns boolean language plpgsql set search_path=public as $$
declare evo game_evolution_defs%rowtype;
begin
 select d.* into evo from game_evolution_defs d join game_monsters m on m.family=d.base_family where m.id=p_monster and m.player_id=p_player and d.id=p_evolution;
 if not found then raise exception 'evolution_invalid';end if;
 update game_monsters set evolution_plan=jsonb_set(evolution_plan,array[evo.from_form_id],to_jsonb(p_evolution),true) where id=p_monster and player_id=p_player;
 return true;
end $$;
create or replace function public.game_equipment_score(p_item text,p_family text,p_level integer default 0)
returns numeric language sql stable set search_path=public as $$
 select (atk*(case when p_family in ('golem','mimic','mandrake','pixie') then 1.5 else 3 end)+hp*(case when p_family in ('golem','mimic') then .3 else .15 end)+def*(case when p_family in ('golem','mimic') then 3 else 1.5 end)+spd*2+crit*100+evade*100+human_damage*160)*(1+greatest(0,p_level)*.08) from game_item_defs where id=p_item
$$;
create or replace function public.game_auto_equip(p_expedition uuid)
returns void language plpgsql set search_path=public as $$
declare m record; slot_name text; chosen text; old_item text; old_level integer; old_score numeric; new_score numeric;
begin
 for m in select x.* from game_expedition_members em join game_monsters x on x.id=em.monster_id join game_players p on p.device_id=x.player_id where em.expedition_id=p_expedition and p.auto_equip order by em.position loop
  foreach slot_name in array array['weapon','armor','accessory'] loop
   select item_id,enhance_level into old_item,old_level from game_monster_equipment where monster_id=m.id and slot=slot_name;
   old_score:=coalesce(game_equipment_score(old_item,m.family,old_level),0);
   select d.id,game_equipment_score(d.id,m.family,0) into chosen,new_score from game_inventory i join game_item_defs d on d.id=i.item_id where i.player_id=m.player_id and i.qty>0 and d.kind='equipment' and d.slot=slot_name order by game_equipment_score(d.id,m.family,0) desc,d.id limit 1;
   if chosen is not null and new_score>old_score*1.05 and (old_item is null or game_inventory_accepts(m.player_id,old_item)) then perform game_equip_item(m.player_id,m.id,chosen);end if;
  end loop;
 end loop;
end $$;
-- Internal helpers can only be called by the authenticated Edge service / cron.
revoke all on function public.game_monster_max_hp(uuid),public.game_boss_roll_for_site(uuid,text,numeric),public.game_apply_service(uuid),public.game_auto_evolve(uuid),public.game_set_idle_policy(uuid,jsonb),public.game_plan_evolution(uuid,uuid,text),public.game_equipment_score(text,text,integer),public.game_auto_equip(uuid) from public,anon,authenticated;
grant execute on function public.game_monster_max_hp(uuid),public.game_boss_roll_for_site(uuid,text,numeric),public.game_apply_service(uuid),public.game_auto_evolve(uuid),public.game_set_idle_policy(uuid,jsonb),public.game_plan_evolution(uuid,uuid,text),public.game_equipment_score(text,text,integer),public.game_auto_equip(uuid) to service_role;
