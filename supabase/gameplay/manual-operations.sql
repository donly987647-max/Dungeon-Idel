create or replace function public.game_process_expedition_action(p_expedition uuid)
returns jsonb language plpgsql set search_path=public as $$
declare e game_expeditions%rowtype;m record;st jsonb;hp jsonb;mx jsonb;result jsonb;at_time timestamptz;max_hp integer;cur_hp integer;remaining integer;revived jsonb:='[]';promotions jsonb:='[]';evolutions jsonb:='[]';next_site text;
begin
 select * into e from game_expeditions where id=p_expedition and active for update;
 if not found then return jsonb_build_object('type','inactive');end if;
 at_time:=e.last_tick_at+interval '2 seconds';
 st:=coalesce(e.battle_state,'{}');hp:=coalesce(st->'partyHp','{}');mx:=coalesce(st->'partyMaxHp','{}');
 for m in select x.* from game_expedition_members em join game_monsters x on x.id=em.monster_id where em.expedition_id=e.id order by em.position for update of x loop
  max_hp:=game_monster_max_hp(m.id);cur_hp:=least(max_hp,coalesce(m.field_hp,(hp->>m.id::text)::integer,max_hp));remaining:=m.recovery_actions;
  if cur_hp<=0 then
   if remaining<=0 then remaining:=12;end if;
   remaining:=remaining-1;
   if remaining=0 then cur_hp:=max_hp;revived:=revived||jsonb_build_array(jsonb_build_object('monsterId',m.id,'name',m.name));end if;
  end if;
  update game_monsters set field_hp=cur_hp,recovery_actions=remaining where id=m.id;
  hp:=jsonb_set(hp,array[m.id::text],to_jsonb(cur_hp),true);mx:=jsonb_set(mx,array[m.id::text],to_jsonb(max_hp),true);
 end loop;
 st:=st||jsonb_build_object('partyHp',hp,'partyMaxHp',mx,'revived',revived);
 update game_expeditions set battle_state=st,idle_actions=idle_actions+1 where id=e.id;
 if e.regroup_remaining>0 then
  remaining:=e.regroup_remaining-1;
  if remaining=0 then
   hp:=mx;
   update game_monsters member_row set field_hp=game_monster_max_hp(member_row.id),recovery_actions=0 from game_expedition_members em where em.monster_id=member_row.id and em.expedition_id=e.id;
  end if;
  result:=jsonb_build_object('type',case when remaining=0 then 'restart' else 'regroup' end,'remaining',remaining,'partyHp',hp,'partyMaxHp',mx,'revived',revived);
  update game_expeditions set regroup_remaining=remaining,phase=case when remaining=0 then '자동 재출정' else '자동 재정비' end,battle_state=st||jsonb_build_object('active',false,'partyHp',hp),event_state=jsonb_build_object('type','regroup','text',case when remaining=0 then '전원 회복 · 박멸조가 자동으로 다시 출발합니다' else '전원 재정비 · '||remaining||'행동 후 자동 재출정' end,'t',at_time),battle_log=(select jsonb_agg(value) from (select value from jsonb_array_elements(jsonb_build_array(result)||e.battle_log) limit 20) x) where id=e.id;
 else
  -- Changes that alter stats happen between fights, with no manual recall needed.
  if not coalesce((st->>'active')::boolean,false) then
   evolutions:=game_auto_evolve(e.id);
  end if;
  result:=game_process_expedition_action_core(e.id);
  select battle_state into st from game_expeditions where id=e.id;
  for m in select x.* from game_expedition_members em join game_monsters x on x.id=em.monster_id where em.expedition_id=e.id loop
   cur_hp:=greatest(0,coalesce((st->'partyHp'->>m.id::text)::integer,m.field_hp,game_monster_max_hp(m.id)));
   update game_monsters set field_hp=cur_hp,recovery_actions=case when cur_hp=0 and m.field_hp>0 then 12 else m.recovery_actions end where id=m.id;
  end loop;
  if result->>'type'='battle-end' then
   promotions:=game_apply_service(e.id);evolutions:=evolutions||game_auto_evolve(e.id);
   if result->>'result'='loss' then
    update game_expeditions set active=true,regroup_remaining=15,phase='자동 재정비',event_state=jsonb_build_object('type','regroup','text','박멸조 전멸 · 15행동 재정비 후 자동 재출정','t',at_time) where id=e.id;
   end if;
  end if;
 end if;
 perform game_finish_idle_jobs(e.player_id,at_time);
 return result||jsonb_build_object('revived',revived,'promotions',promotions,'evolutions',evolutions,'advancedTo',next_site);
end $$;
revoke all on function public.game_process_expedition_action_core(uuid) from public,anon,authenticated;
grant execute on function public.game_process_expedition_action_core(uuid) to service_role;
create or replace function public.game_process_expeditions()
returns integer language plpgsql set search_path=public as $$
declare e record;attempts integer;i integer;n integer:=0;
begin
 for e in select id,last_tick_at from game_expeditions where active order by last_tick_at,id for update skip locked loop
  attempts:=least(20,greatest(0,floor(extract(epoch from(now()-e.last_tick_at))/2)::integer));
  for i in 1..attempts loop
   perform game_process_expedition_action(e.id);
   update game_expeditions set last_tick_at=last_tick_at+interval '2 seconds',updated_at=now() where id=e.id;n:=n+1;
  end loop;
 end loop;
 return n;
end $$;
create or replace function public.game_tick_all()
returns integer language plpgsql set search_path=public as $$
declare n integer:=0;p record;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('game_tick_all',0)) then return 0;end if;
 n:=n+game_spawn_candidates();n:=n+game_process_expeditions();n:=n+game_process_defense();
 -- An active expedition owns its simulation clock. Idle companies still finish jobs.
 for p in select device_id from game_players where not exists(select 1 from game_expeditions e where e.player_id=game_players.device_id and e.active) loop n:=n+game_finish_idle_jobs(p.device_id,now());end loop;
 return n;
end $$;
revoke all on function public.game_process_expedition_action(uuid),public.game_process_expeditions(),public.game_tick_all() from public,anon,authenticated;
grant execute on function public.game_process_expedition_action(uuid),public.game_process_expeditions(),public.game_tick_all() to service_role;

-- Remove the settings API and all autonomous business decisions.
drop function if exists public.game_set_idle_policy(uuid,jsonb);
drop function if exists public.game_auto_equip(uuid);
drop function if exists public.game_equipment_score(text,text,integer);
drop function if exists public.game_run_idle_economy(uuid,timestamptz);
alter table public.game_players drop column if exists idle_automation,
 drop column if exists auto_reinvest,drop column if exists auto_equip,
 drop column if exists auto_advance,drop column if exists idle_last_at;
