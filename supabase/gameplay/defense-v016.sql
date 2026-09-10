-- Separate idle defense: stationed employees intercept non-attacking heroes.
create table if not exists public.game_defense (
 player_id uuid primary key references public.game_players(device_id) on delete cascade,
 stage integer not null default 1 check(stage between 1 and 50),highest_stage integer not null default 1 check(highest_stage between 1 and 50),
 boss_auto boolean not null default false,wave_number bigint not null default 0,wins bigint not null default 0,losses bigint not null default 0,
 traps integer not null default 0 check(traps between 0 and 25),gas integer not null default 0 check(gas between 0 and 25),slow integer not null default 0 check(slow between 0 and 25),arcane integer not null default 0 check(arcane between 0 and 25),
 wave jsonb not null default '{}'::jsonb,last_event jsonb not null default '{}'::jsonb,reward_vault jsonb not null default '{}'::jsonb,last_tick_at timestamptz not null default now()
);
alter table public.game_defense enable row level security;
revoke all on public.game_defense from anon,authenticated;
grant all on public.game_defense to service_role;
insert into public.game_defense(player_id) select device_id from public.game_players on conflict do nothing;
create or replace function public.game_defense_snapshot(p_player uuid)
returns jsonb language sql stable set search_path=public as $$
 select coalesce((select to_jsonb(d) from game_defense d where d.player_id=p_player),jsonb_build_object('stage',1,'highest_stage',1,'boss_auto',false,'wave',jsonb_build_object(),'traps',0,'gas',0,'slow',0,'arcane',0,'wins',0,'losses',0))
$$;
create or replace function public.game_defense_upgrade(p_player uuid,p_kind text,p_expected integer)
returns jsonb language plpgsql set search_path=public as $$
declare d game_defense%rowtype;lv integer;price bigint;gold_now bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
 if p_kind not in ('traps','gas','slow','arcane') then raise exception 'facility';end if;
 insert into game_defense(player_id) values(p_player) on conflict do nothing;
 select * into d from game_defense where player_id=p_player for update;lv:=(to_jsonb(d)->>p_kind)::integer;
 if lv<>p_expected then raise exception 'facility_changed';end if;if lv>=25 then raise exception 'max_level';end if;
 price:=ceil((case p_kind when 'traps' then 120 when 'gas' then 180 when 'slow' then 240 else 300 end)*power(1.28::numeric,lv));
 select gold into gold_now from game_players where device_id=p_player for update;if gold_now<price then raise exception 'gold_short';end if;
 update game_players set gold=gold-price where device_id=p_player;
 execute format('update game_defense set %I=$1 where player_id=$2',p_kind) using lv+1,p_player;
 return jsonb_build_object('kind',p_kind,'level',lv+1,'cost',price);
end $$;
create or replace function public.game_defense_command(p_player uuid,p_action text,p_stage integer default null)
returns boolean language plpgsql set search_path=public as $$
declare d game_defense%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));insert into game_defense(player_id) values(p_player) on conflict do nothing;
 select * into d from game_defense where player_id=p_player for update;
 if p_action='boss-auto' then update game_defense set boss_auto=true,wave='{}',last_event=jsonb_build_object('type','challenge','text','보스 연속 도전 시작 · 실패할 때까지 다음 단계 도전') where player_id=p_player;
 elsif p_action='stop-boss' then update game_defense set boss_auto=false,wave='{}' where player_id=p_player;
 elsif p_action='stage' then
  if p_stage is null or p_stage<1 or p_stage>d.highest_stage then raise exception 'locked';end if;
  update game_defense set stage=p_stage,boss_auto=false,wave='{}',last_event=jsonb_build_object('type','stage','text',p_stage||'단계 반복 방어') where player_id=p_player;
 else raise exception 'invalid_action';end if;
 return true;
end $$;
create or replace function public.game_defense_action(p_player uuid)
returns jsonb language plpgsql set search_path=public as $$
declare d game_defense%rowtype;w jsonb;heroes jsonb;hero jsonb;foe jsonb;next_heroes jsonb:='[]';attacks jsonb:='[]';m record;total_damage numeric:=0;damage numeric;hp numeric;pos numeric;progress numeric;remaining integer;target integer;wave_stage integer;is_boss boolean;escaped boolean:=false;all_dead boolean:=true;site game_hunt_sites%rowtype;loot_row jsonb;drops jsonb:='{}';entry record;qty integer;result jsonb;clock_at timestamptz;
begin
 select * into d from game_defense where player_id=p_player for update;if not found then return '{}';end if;
 clock_at:=d.last_tick_at+interval '2 seconds';w:=d.wave;
 -- Attack power deliberately depends on evolution, grade and level, not expedition gear.
 for m in select * from game_monsters x where x.player_id=p_player and x.released_at is null and not exists(select 1 from game_expedition_members em join game_expeditions e on e.id=em.expedition_id where em.monster_id=x.id and e.active) order by x.created_at loop
  damage:=(8+m.level*3)*(1+coalesce(m.evolution_tier,0)*.75)*(case m.growth_grade when 'S' then 1.65 when 'A' then 1.35 when 'B' then 1.15 else 1 end);
  total_damage:=total_damage+damage;attacks:=attacks||jsonb_build_array(jsonb_build_object('monsterId',m.id,'family',m.family,'damage',round(damage)));
 end loop;
 if coalesce((w->>'active')::boolean,false)=false then
  is_boss:=d.boss_auto;wave_stage:=case when is_boss then least(50,d.stage+1) else d.stage end;
  select * into site from game_hunt_sites where unlock_order=least(5,1+(wave_stage-1)/10);
  heroes:='[]';
  for target in 1..(case when is_boss then 1 else 3 end) loop
   hp:=round((120+wave_stage*18)*power(1.095::numeric,wave_stage-1)*(case when is_boss then 5 else 1 end));
   heroes:=heroes||jsonb_build_array(jsonb_build_object('id',target,'name',case when is_boss then site.boss_name else site.enemy_names[1+((d.wave_number+target)::integer%4)] end,'hp',hp,'maxHp',hp,'position',-(target-1)*.12));
  end loop;
  w:=jsonb_build_object('active',true,'boss',is_boss,'stage',wave_stage,'site',site.id,'heroes',heroes,'tick',0,'at',clock_at,'duration',60);
  update game_defense set wave=w,wave_number=wave_number+1,last_event=jsonb_build_object('type','wave','text',case when is_boss then wave_stage||'단계 보스 침입' else wave_stage||'단계 용사 침입' end,'at',clock_at) where player_id=p_player;
  return w;
 end if;
 heroes:=w->'heroes';is_boss:=(w->>'boss')::boolean;wave_stage:=(w->>'stage')::integer;
 progress:=1.0/(30+least(20,d.slow));target:=null;pos:=-999;
 -- Focus the living hero nearest the throne; poison continues on every invader.
 for hero in select value from jsonb_array_elements(heroes) loop if (hero->>'hp')::numeric>0 and (hero->>'position')::numeric>=pos then target:=(hero->>'id')::integer;pos:=(hero->>'position')::numeric;end if;end loop;
 for hero in select value from jsonb_array_elements(heroes) loop
  hp:=(hero->>'hp')::numeric;pos:=(hero->>'position')::numeric;
  if hp>0 then
   pos:=pos+progress;damage:=d.gas*(3+wave_stage*.3);
   if (hero->>'id')::integer=target and pos>=0 then damage:=damage+total_damage+d.arcane*10;end if;
   if floor(greatest(0,pos-progress)*4)<floor(greatest(0,pos)*4) then damage:=damage+d.traps*(20+wave_stage);end if;
   hp:=greatest(0,hp-damage);
   if hp>0 then all_dead:=false;if pos>=1 then escaped:=true;end if;end if;
  end if;
  next_heroes:=next_heroes||jsonb_build_array(hero||jsonb_build_object('hp',round(hp),'position',least(1,pos)));
 end loop;
 w:=w||jsonb_build_object('heroes',next_heroes,'tick',(w->>'tick')::integer+1,'at',clock_at,'attacks',attacks);
 if escaped or all_dead then
  w:=w||jsonb_build_object('active',false,'result',case when escaped then 'loss' else 'win' end);
  if escaped then
   update game_defense set losses=losses+1,boss_auto=case when is_boss then false else boss_auto end,last_event=jsonb_build_object('type','loss','boss',is_boss,'text',case when is_boss then '보스 돌파 · 연속 도전 중단, 직전 단계 반복' else '용사 도달 · 이번 웨이브 보상 없음' end,'at',clock_at) where player_id=p_player;
  else
   select * into site from game_hunt_sites where id=w->>'site';
   -- A defense wave rolls one encounter table at 25% of exploration probabilities.
   select jsonb_agg(value||jsonb_build_object('chance',(value->>'chance')::numeric*.25)) into loot_row from jsonb_array_elements(site.loot);
   drops:=game_roll_campaign_drops(loot_row,case when is_boss then site.boss_name else heroes->0->>'name' end,0);
   update game_defense set wins=wins+1,stage=case when is_boss then wave_stage else stage end,highest_stage=greatest(highest_stage,wave_stage),boss_auto=case when is_boss and wave_stage=50 then false else boss_auto end,last_event=jsonb_build_object('type','win','boss',is_boss,'text',case when is_boss then wave_stage||'단계 보스 격퇴 · 다음 보스 도전' else '용사 격퇴 · 전리품 확인' end,'drops',drops,'at',clock_at) where player_id=p_player;
   for entry in select key,value::integer qty from jsonb_each_text(drops) loop update game_defense set reward_vault=jsonb_set(reward_vault,array[entry.key],to_jsonb(coalesce((reward_vault->>entry.key)::integer,0)+entry.qty),true) where player_id=p_player;end loop;
  end if;
 end if;
 update game_defense set wave=w where player_id=p_player;
 -- Completed rewards stay in a vault when the warehouse is full, without rerolls.
 for entry in select key,value::integer qty from game_defense d2 cross join lateral jsonb_each_text(d2.reward_vault) where d2.player_id=p_player loop
  if game_inventory_accepts(p_player,entry.key) then
   insert into game_inventory(player_id,item_id,qty) values(p_player,entry.key,entry.qty) on conflict(player_id,item_id) do update set qty=game_inventory.qty+excluded.qty;
   update game_defense set reward_vault=reward_vault-entry.key where player_id=p_player;
  end if;
 end loop;
 return w;
end $$;
create or replace function public.game_process_defense()
returns integer language plpgsql set search_path=public as $$
declare d record;n integer:=0;steps integer;i integer;
begin
 insert into game_defense(player_id) select device_id from game_players on conflict do nothing;
 for d in select player_id,last_tick_at from game_defense order by last_tick_at for update skip locked loop
  steps:=least(20,greatest(0,floor(extract(epoch from(now()-d.last_tick_at))/2)::integer));
  for i in 1..steps loop perform game_defense_action(d.player_id);update game_defense set last_tick_at=last_tick_at+interval '2 seconds' where player_id=d.player_id;n:=n+1;end loop;
 end loop;
 return n;
end $$;
revoke all on function public.game_defense_snapshot(uuid),public.game_defense_upgrade(uuid,text,integer),public.game_defense_command(uuid,text,integer),public.game_defense_action(uuid),public.game_process_defense() from public,anon,authenticated;
grant execute on function public.game_defense_snapshot(uuid),public.game_defense_upgrade(uuid,text,integer),public.game_defense_command(uuid,text,integer),public.game_defense_action(uuid),public.game_process_defense() to service_role;
