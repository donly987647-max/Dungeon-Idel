alter table public.game_monsters add column if not exists released_at timestamptz;
create index if not exists game_monsters_active_roster_idx on public.game_monsters(player_id, created_at) where released_at is null;

create or replace function public.game_hire_candidate(p_player uuid, p_candidate uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
 p record; c record; current_count int; cap int; new_id uuid;
begin
 select quarters_level into p from public.game_players where device_id=p_player for update;
 if not found then raise exception 'player_missing'; end if;
 select * into c from public.game_candidates where id=p_candidate and player_id=p_player for update;
 if not found then raise exception 'candidate_missing'; end if;
 cap:=3+greatest(0,coalesce(p.quarters_level,1)-1)*2;
 select count(*)::int into current_count from public.game_monsters where player_id=p_player and released_at is null;
 if current_count>=cap then raise exception 'quarters_full'; end if;
 insert into public.game_monsters(player_id,name,family,form_id,evolution_tier,skill_id,level,xp,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base)
 values(p_player,c.name,c.family,c.family,0,null,1,0,c.talent,c.trait,c.power_base,c.personality,c.growth_grade,c.hp_base,c.atk_base,c.def_base,c.spd_base,c.crit_base,c.evade_base)
 returning id into new_id;
 delete from public.game_candidates where id=p_candidate and player_id=p_player;
 return jsonb_build_object('monsterId',new_id,'capacity',cap,'count',current_count+1);
end
$function$;

create or replace function public.game_release_monster(p_player uuid, p_monster uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
 m public.game_monsters%rowtype;
 gear_count int:=0;
begin
 perform 1 from public.game_players where device_id=p_player for update;
 if not found then raise exception 'player_missing'; end if;

 select * into m from public.game_monsters
 where id=p_monster and player_id=p_player and released_at is null
 for update;
 if m.id is null then raise exception 'monster_missing'; end if;

 if exists(
   select 1 from public.game_expedition_members em
   join public.game_expeditions ge on ge.id=em.expedition_id
   where em.monster_id=m.id and ge.active=true
 ) then raise exception 'monster_busy'; end if;

 insert into public.game_inventory(player_id,item_id,qty)
 select p_player,q.item_id,count(*)::bigint
 from public.game_monster_equipment q
 where q.player_id=p_player and q.monster_id=m.id
 group by q.item_id
 on conflict(player_id,item_id) do update
 set qty=public.game_inventory.qty+excluded.qty;
 get diagnostics gear_count = row_count;

 delete from public.game_monster_equipment
 where player_id=p_player and monster_id=m.id;

 update public.game_expeditions
 set pending_xp=coalesce(pending_xp,'{}'::jsonb)-m.id::text,
     updated_at=now()
 where player_id=p_player and coalesce(pending_xp,'{}'::jsonb) ? m.id::text;

 update public.game_monsters
 set released_at=now()
 where id=m.id;

 return jsonb_build_object('monsterId',m.id,'name',m.name,'released',true,'gearReturned',gear_count);
end
$function$;
