-- v0.12.6 party roles: healer / mage / tank
alter table public.game_skill_defs add column if not exists effect_type text not null default 'damage';
alter table public.game_skill_defs add column if not exists heal_ratio numeric not null default 0;
alter table public.game_skill_defs add column if not exists damage_reduction numeric not null default 0;
alter table public.game_skill_defs add column if not exists taunt_weight numeric not null default 1;

insert into public.game_skill_defs(id,name,trigger_type,trigger_value,trigger_count,condition_value,damage_multiplier,defense_ignore,effect_type,heal_ratio,damage_reduction,taunt_weight,description) values
('healing_spore','치유 포자','every_n',0,3,0,0.9,0,'heal',0.16,0,1,'3번째 공격마다 가장 다친 아군의 최대 HP 16%를 회복합니다.'),
('arcane_bolt','마력탄','every_n',0,3,0,1.6,0.55,'magic',0,0,1,'3번째 공격마다 방어를 크게 관통하는 마력탄을 발사합니다.'),
('guardian_slam','수호 강타','every_n',0,4,0,1.35,0.15,'tank',0,0.24,3.2,'상시 도발과 피해 감소를 유지하고 4번째 공격마다 수호 강타를 사용합니다.'),
('moon_dew','달빛 수액','every_n',0,2,0,0.85,0,'heal',0.18,0,1,'2번째 공격마다 가장 다친 아군의 최대 HP 18%를 회복합니다.'),
('blood_pollen','핏빛 꽃가루','hp_below_chance',0.4,0,0.7,1.1,0.05,'heal',0.18,0,1,'파티 HP가 70% 이하일 때 40% 확률로 18% 회복과 강화 공격을 함께 수행합니다.'),
('sacred_bloom','성화 개화','every_n',0,2,0,0.8,0,'heal',0.24,0,1,'2번째 공격마다 최대 HP 24%를 회복하는 순수 치유 특화 스킬입니다.'),
('spirit_root','정령 뿌리','chance',0.35,0,0,0.95,0,'heal',0.2,0,1,'공격 시 35% 확률로 가장 다친 아군을 최대 HP 20%만큼 회복합니다.'),
('crimson_sap','진홍 수액','hp_below_chance',0.5,0,0.65,1.2,0.1,'heal',0.22,0,1,'파티 HP가 65% 이하일 때 50% 확률로 22% 회복하며 공격도 강화합니다.'),
('thorn_requiem','가시 진혼곡','every_n',0,3,0,1.35,0.15,'heal',0.16,0,1,'3번째 공격마다 16%를 회복하면서 높은 공격 배율을 유지하는 전투 힐러 스킬입니다.'),
('fire_orb','화염구','every_n',0,3,0,1.9,0.3,'magic',0,0,1,'3번째 공격마다 강한 화염 마법을 사용합니다.'),
('void_lance','공허 창','every_n',0,3,0,1.65,0.7,'magic',0,0,1,'3번째 공격마다 적 방어의 70%를 무시하는 공허 마법을 사용합니다.'),
('inferno_meteor','인페르노 메테오','every_n',0,4,0,2.6,0.35,'magic',0,0,1,'4번째 공격마다 매우 강한 화염 운석을 떨어뜨립니다.'),
('chain_flare','연쇄 화염','chance',0.25,0,0,2.0,0.25,'magic',0,0,1,'공격 시 25% 확률로 화염이 연쇄 폭발합니다.'),
('abyss_ray','심연 광선','every_n',0,3,0,2.1,0.75,'magic',0,0,1,'3번째 공격마다 방어 75%를 무시하는 심연 광선을 발사합니다.'),
('null_burst','무효 폭발','chance',0.22,0,0,2.3,0.65,'magic',0,0,1,'공격 시 22% 확률로 방어를 크게 무시하는 무효 폭발을 일으킵니다.'),
('iron_guard','철갑 수호','every_n',0,4,0,1.45,0.2,'tank',0,0.28,3.7,'상시 피해 28% 감소와 높은 도발을 유지하며 4번째 공격마다 반격합니다.'),
('guardian_wall','수호벽','every_n',0,5,0,1.25,0.25,'tank',0,0.32,4.2,'상시 피해 32% 감소와 강한 도발로 아군 대신 공격을 받아냅니다.'),
('fortress_crush','요새 분쇄','every_n',0,4,0,1.65,0.35,'tank',0,0.36,4.5,'상시 피해 36% 감소를 유지하며 4번째 공격마다 방어 파괴 강타를 가합니다.'),
('obsidian_counter','흑요 반격','hp_below_chance',0.35,0,0.6,1.9,0.3,'tank',0,0.32,4.0,'HP가 60% 이하일 때 35% 확률로 강한 반격을 가하며 상시 피해 32% 감소를 유지합니다.'),
('sentinel_bash','파수 강타','every_n',0,3,0,1.45,0.4,'tank',0,0.34,4.8,'도발이 매우 높고 3번째 공격마다 방어를 관통하는 방패 강타를 사용합니다.'),
('aegis_core','이지스 코어','every_n',0,5,0,1.3,0.5,'tank',0,0.4,5.2,'상시 피해 40% 감소와 최고 수준의 도발을 유지하는 극방어 스킬입니다.')
on conflict(id) do update set name=excluded.name,trigger_type=excluded.trigger_type,trigger_value=excluded.trigger_value,trigger_count=excluded.trigger_count,condition_value=excluded.condition_value,damage_multiplier=excluded.damage_multiplier,defense_ignore=excluded.defense_ignore,effect_type=excluded.effect_type,heal_ratio=excluded.heal_ratio,damage_reduction=excluded.damage_reduction,taunt_weight=excluded.taunt_weight,description=excluded.description;

insert into public.game_evolution_defs(id,base_family,from_form_id,target_form_id,target_name,tier,required_level,hp_mult,atk_mult,def_mult,spd_mult,power_mult,crit_add,evade_add,skill_id,description) values
('mandrake_moon','mandrake','mandrake','moon_mandrake','문 만드라고라',1,20,1.18,1.02,1.15,1.1,1.15,0.0,0.02,'moon_dew','회복 주기를 짧게 가져가는 순수 힐러 계열입니다.'),
('mandrake_thorn','mandrake','mandrake','thorn_mandrake','쏜 만드라고라',1,20,1.1,1.16,1.08,1.08,1.15,0.02,0.01,'blood_pollen','회복과 공격을 함께 수행하는 전투 힐러 계열입니다.'),
('moon_sacred','mandrake','moon_mandrake','sacred_bloom_mandrake','세이크리드 블룸',2,30,1.22,1.0,1.18,1.08,1.2,0.0,0.03,'sacred_bloom','파티 유지력에 모든 성능을 집중한 최상급 치유종입니다.'),
('moon_spirit','mandrake','moon_mandrake','spiritroot_mandrake','스피릿 루트',2,30,1.16,1.08,1.15,1.12,1.2,0.01,0.03,'spirit_root','확률형 고빈도 회복으로 불규칙한 피해에 대응합니다.'),
('thorn_crimson','mandrake','thorn_mandrake','bloodvine_mandrake','블러드바인',2,30,1.2,1.18,1.1,1.06,1.21,0.03,0.01,'crimson_sap','위기 상황에서 강한 회복과 공격을 동시에 수행합니다.'),
('thorn_requiem_evo','mandrake','thorn_mandrake','thorn_requiem_mandrake','리퀴엠 만드라고라',2,30,1.12,1.24,1.08,1.12,1.21,0.04,0.02,'thorn_requiem','힐러 중 가장 높은 공격 기여도를 가진 공격지원형입니다.'),
('imp_flame','imp','imp','flame_imp','플레임 임프',1,20,1.05,1.25,1.02,1.08,1.17,0.03,0.01,'fire_orb','마법 관통보다 순수 폭발 화력에 집중합니다.'),
('imp_void','imp','imp','void_imp','보이드 임프',1,20,1.08,1.18,1.05,1.12,1.17,0.02,0.03,'void_lance','중장갑 적을 상대하는 방어 관통 마법사입니다.'),
('flame_inferno','imp','flame_imp','inferno_imp','인페르노 임프',2,30,1.08,1.3,1.04,1.08,1.22,0.04,0.01,'inferno_meteor','긴 주기 대신 가장 높은 단발 마법 화력을 얻습니다.'),
('flame_chain','imp','flame_imp','emberlord_imp','엠버로드 임프',2,30,1.1,1.24,1.06,1.14,1.21,0.04,0.02,'chain_flare','확률형 연속 폭발로 평균 화력을 높입니다.'),
('void_abyss','imp','void_imp','abyss_imp','어비스 임프',2,30,1.1,1.25,1.06,1.12,1.22,0.03,0.03,'abyss_ray','매우 높은 방어 관통과 안정적인 주기 공격을 가집니다.'),
('void_null','imp','void_imp','null_imp','널 임프',2,30,1.12,1.22,1.08,1.15,1.21,0.03,0.04,'null_burst','확률형 고배율 관통 마법으로 폭발적인 변수를 만듭니다.'),
('golem_iron','golem','golem','iron_golem','아이언 골렘',1,20,1.25,1.1,1.25,0.96,1.17,0.0,0.0,'iron_guard','체력과 방어를 동시에 끌어올린 정통 탱커입니다.'),
('golem_guardian','golem','golem','guardian_golem','가디언 골렘',1,20,1.18,1.05,1.32,0.95,1.17,0.0,0.0,'guardian_wall','화력보다 도발과 피해 감소에 더 집중합니다.'),
('iron_fortress_golem','golem','iron_golem','fortress_golem','포트리스 골렘',2,30,1.3,1.12,1.28,0.95,1.22,0.0,0.0,'fortress_crush','강한 생존력과 방어 파괴 반격을 함께 보유합니다.'),
('iron_obsidian_golem','golem','iron_golem','obsidian_golem','옵시디언 골렘',2,30,1.24,1.18,1.24,0.98,1.21,0.01,0.0,'obsidian_counter','체력이 낮아질수록 반격 화력이 살아나는 탱커입니다.'),
('guardian_sentinel','golem','guardian_golem','sentinel_golem','센티널 골렘',2,30,1.26,1.1,1.3,0.96,1.22,0.0,0.0,'sentinel_bash','가장 높은 수준의 도발로 파티의 공격을 대신 받습니다.'),
('guardian_aegis','golem','guardian_golem','aegis_golem','이지스 골렘',2,30,1.34,1.04,1.34,0.92,1.23,0.0,0.0,'aegis_core','최고 수준의 피해 감소를 가진 극방어 최종종입니다.')
on conflict(id) do update set base_family=excluded.base_family,from_form_id=excluded.from_form_id,target_form_id=excluded.target_form_id,target_name=excluded.target_name,tier=excluded.tier,required_level=excluded.required_level,hp_mult=excluded.hp_mult,atk_mult=excluded.atk_mult,def_mult=excluded.def_mult,spd_mult=excluded.spd_mult,power_mult=excluded.power_mult,crit_add=excluded.crit_add,evade_add=excluded.evade_add,skill_id=excluded.skill_id,description=excluded.description;

create or replace function public.game_trigger_monster_skill(p_monster uuid,p_attack_count integer,p_hp_ratio numeric)
returns jsonb language plpgsql set search_path to 'public' as $$
declare r record; fired boolean:=false;
begin
 select m.id monster_id,m.name owner_name,s.* into r from public.game_monsters m join public.game_skill_defs s on s.id=m.skill_id where m.id=p_monster;
 if not found then return '{}'::jsonb; end if;
 fired:=case r.trigger_type when 'chance' then random()<r.trigger_value when 'every_n' then r.trigger_count>0 and mod(greatest(1,p_attack_count),r.trigger_count)=0 when 'hp_below_chance' then p_hp_ratio<=r.condition_value and random()<r.trigger_value else false end;
 if not fired then return '{}'::jsonb; end if;
 return jsonb_build_object('id',r.id,'name',r.name,'owner',r.owner_name,'monsterId',r.monster_id,'damage_multiplier',r.damage_multiplier,'defense_ignore',r.defense_ignore,'effect_type',r.effect_type,'heal_ratio',r.heal_ratio,'damage_reduction',r.damage_reduction,'taunt_weight',r.taunt_weight);
end $$;

create or replace function public.game_hire_candidate(p_player uuid,p_candidate uuid)
returns jsonb language plpgsql set search_path to 'public' as $$
declare p record;c record;current_count int;cap int;new_id uuid;base_skill text;
begin
 select quarters_level into p from public.game_players where device_id=p_player for update;if not found then raise exception 'player_missing';end if;
 select * into c from public.game_candidates where id=p_candidate and player_id=p_player for update;if not found then raise exception 'candidate_missing';end if;
 cap:=3+greatest(0,coalesce(p.quarters_level,1)-1)*2;select count(*)::int into current_count from public.game_monsters where player_id=p_player and released_at is null;if current_count>=cap then raise exception 'quarters_full';end if;
 base_skill:=case c.family when 'mandrake' then 'healing_spore' when 'imp' then 'arcane_bolt' when 'golem' then 'guardian_slam' else null end;
 insert into public.game_monsters(player_id,name,family,form_id,evolution_tier,skill_id,level,xp,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base)
 values(p_player,c.name,c.family,c.family,0,base_skill,1,0,c.talent,c.trait,c.power_base,c.personality,c.growth_grade,c.hp_base,c.atk_base,c.def_base,c.spd_base,c.crit_base,c.evade_base) returning id into new_id;
 delete from public.game_candidates where id=p_candidate and player_id=p_player;return jsonb_build_object('monsterId',new_id,'capacity',cap,'count',current_count+1);
end $$;

create or replace function public.game_spawn_candidates()
returns integer language plpgsql set search_path to 'public' as $$
declare p record;i int;r numeric;grade text;fam text;pers text;tr text;talent int;mult numeric;hp int;atk int;de int;spd int;cr numeric;ev numeric;pb int;made int:=0;batch_count int;locked_count int;new_count int;
begin
 for p in select * from public.game_players where next_candidate_at<=now() for update skip locked loop
  delete from public.game_candidates where player_id=p.device_id and not coalesce(is_locked,false);batch_count:=greatest(4,coalesce(p.tavern_level,1)+3);select count(*)::int into locked_count from public.game_candidates where player_id=p.device_id and coalesce(is_locked,false);new_count:=greatest(0,batch_count-locked_count);
  if new_count>0 then for i in 1..new_count loop
   r:=random();grade:=case when p.tavern_level<=1 then case when r<0.65 then 'C' when r<0.95 then 'B' else 'A' end when p.tavern_level=2 then case when r<0.45 then 'C' when r<0.85 then 'B' when r<0.99 then 'A' else 'S' end when p.tavern_level=3 then case when r<0.25 then 'C' when r<0.70 then 'B' when r<0.97 then 'A' else 'S' end when p.tavern_level=4 then case when r<0.10 then 'C' when r<0.50 then 'B' when r<0.93 then 'A' else 'S' end else case when r<0.35 then 'B' when r<0.85 then 'A' else 'S' end end;
   fam:=(array['slime','goblin','troll','mandrake','imp','golem'])[1+floor(random()*6)::int];pers:=(array['침착','약탈광','광전사','겁쟁이','인간혐오','야행성'])[1+floor(random()*6)::int];tr:=(array['질긴 가죽','야성','재빠름','수집광','학습 본능'])[1+floor(random()*5)::int];talent:=case grade when 'S' then 94+floor(random()*7)::int when 'A' then 88+floor(random()*10)::int when 'B' then 82+floor(random()*11)::int else 76+floor(random()*12)::int end;talent:=least(100,talent+greatest(0,p.tavern_level-1));mult:=case grade when 'S' then 1.16 when 'A' then 1.10 when 'B' then 1.05 else 1 end;
   if fam='slime' then hp:=round(145*mult);atk:=round(15*mult);de:=round(11*mult);spd:=round(9*mult);cr:=0.04;ev:=0.03;pb:=45;
   elsif fam='goblin' then hp:=round(100*mult);atk:=round(21*mult);de:=round(7*mult);spd:=round(14*mult);cr:=0.08;ev:=0.06;pb:=52;
   elsif fam='troll' then hp:=round(175*mult);atk:=round(24*mult);de:=round(13*mult);spd:=round(7*mult);cr:=0.05;ev:=0.02;pb:=68;
   elsif fam='mandrake' then hp:=round(125*mult);atk:=round(12*mult);de:=round(9*mult);spd:=round(10*mult);cr:=0.03;ev:=0.04;pb:=50;
   elsif fam='imp' then hp:=round(88*mult);atk:=round(26*mult);de:=round(5*mult);spd:=round(12*mult);cr:=0.07;ev:=0.05;pb:=57;
   else hp:=round(240*mult);atk:=round(13*mult);de:=round(21*mult);spd:=round(5*mult);cr:=0.02;ev:=0.01;pb:=63;end if;
   insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
   values(p.device_id,(array['꾸륵','찍찍','우르그','푸르','크룩','도르','무그','벨칵','루트','지직','둔석','모스'])[1+floor(random()*12)::int],fam,talent,tr,pb,pers,grade,hp,atk,de,spd,cr,ev,false);made:=made+1;
  end loop;end if;update public.game_players set next_candidate_at=now()+interval '4 hours',updated_at=now() where device_id=p.device_id;
 end loop;return made;
end $$;

update public.game_monsters set skill_id=case family when 'mandrake' then 'healing_spore' when 'imp' then 'arcane_bolt' when 'golem' then 'guardian_slam' else skill_id end where released_at is null and skill_id is null and family in ('mandrake','imp','golem');

create or replace function public.game_process_expedition_action(p_expedition uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  e record;
  mem record;
  party_n int:=0;
  living_n int:=0;
  event_roll numeric;
  phase_now text;
  event_text text;
  enemy text;
  enemy_role text;
  is_boss boolean:=false;
  boss_ready_v boolean:=false;
  boss_cleared_v boolean:=false;
  progress_wins bigint:=0;
  enemy_power numeric;
  group_hp_scale numeric;
  group_atk_scale numeric;
  party_spd numeric:=0;
  initiative_chance numeric:=0.5;
  turn_side text;
  round_i int:=1;
  party_hp_json jsonb:='{}'::jsonb;
  party_max_json jsonb:='{}'::jsonb;
  attack_counts jsonb:='{}'::jsonb;
  bs jsonb:='{}'::jsonb;
  newstate jsonb:='{}'::jsonb;
  newlog jsonb:='[]'::jsonb;
  log_entry jsonb:='{}'::jsonb;
  last_action jsonb:='{}'::jsonb;
  skill_events jsonb:='[]'::jsonb;
  death_events jsonb:='[]'::jsonb;
  loot_row jsonb;
  loot_gained int:=0;
  qty int;
  chance numeric;
  search_bonus numeric:=0;
  party_loot numeric:=0;
  growth numeric;
  lvl int;
  mhp numeric;
  matk numeric;
  mdef numeric;
  mspd numeric;
  mcrit numeric;
  mevade numeric;
  mhuman numeric;
  current_hp int;
  max_hp int;
  attack_no int;
  enemy_hp int;
  enemy_hp_max int;
  enemy_atk numeric;
  enemy_def numeric;
  enemy_spd numeric;
  enemy_crit numeric;
  enemy_evade numeric;
  dmg int:=0;
  total_dmg int:=0;
  crits int:=0;
  dodges int:=0;
  enemy_crits int:=0;
  dealt_total int:=0;
  taken_total int:=0;
  skill_fx jsonb;
  skill_mult numeric:=1;
  skill_ignore numeric:=0;
  skill_name text;
  skill_owner text;
  skill_effect text:='damage';
  heal_ratio numeric:=0;
  heal_target_id uuid;
  heal_target_name text;
  heal_target_max int:=0;
  heal_before int:=0;
  heal_after int:=0;
  heal_amount int:=0;
  heal_total int:=0;
  turn_heal int:=0;
  armor_coeff numeric:=0.55;
  target_id uuid;
  target_name text;
  hp_before int;
  hp_after int;
  xp_lost int:=0;
  won boolean:=false;
  lost boolean:=false;
  xp_each int;
  xp_amt int;
begin
  select x.*,s.recommended_power,s.xp_per_kill,s.enemy_names,s.loot,s.boss_name,s.boss_power
  into e
  from public.game_expeditions x
  join public.game_hunt_sites s on s.id=x.site_id
  where x.id=p_expedition and x.active=true
  for update of x;
  if not found then return jsonb_build_object('type','inactive'); end if;

  select count(*) into party_n from public.game_expedition_members where expedition_id=e.id;
  if party_n<=0 then
    insert into public.game_expedition_members(expedition_id,player_id,monster_id,position)
    values(e.id,e.player_id,e.monster_id,1) on conflict do nothing;
    party_n:=1;
  end if;
  insert into public.game_stage_progress(player_id,site_id) values(e.player_id,e.site_id) on conflict do nothing;

  bs:=coalesce(e.battle_state,'{}'::jsonb);
  if not coalesce((bs->>'active')::boolean,false) then
    event_roll:=random();
    loot_gained:=0;
    if event_roll<0.28 then
      phase_now:='수색';
      event_text:=case e.site_id when 'mountain_village' then '목책과 민가 주변을 수색한다' when 'farm_road' then '마차길과 곡물창고 주변을 수색한다' when 'border_outpost' then '석벽과 감시탑 사각지대를 수색한다' else '주변을 수색한다' end;
      select greatest(coalesce(max(case when m.personality='약탈광' then 0.15 else 0 end),0),coalesce(max(case when m.trait='수집광' then 0.10 else 0 end),0))
      into search_bonus from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id;
      if random()<least(0.80,0.30+coalesce(search_bonus,0)) then
        select l.value into loot_row from jsonb_array_elements(e.loot) l
        where exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;
        if loot_row is not null then perform public.game_add_pending_loot(e.id,loot_row->>'id',1);loot_gained:=1;event_text:=event_text||' · 보급품 발견';end if;
      end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','search','text',event_text,'loot',loot_gained,'t',now()),battle_state='{}'::jsonb,updated_at=now() where id=e.id;
    elsif event_roll<0.48 then
      phase_now:='전리품 수거';
      select l.value into loot_row from jsonb_array_elements(e.loot) l
      where exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;
      if loot_row is not null and random()<0.58 then
        qty:=1+case when random()<0.12 then 1 else 0 end;
        perform public.game_add_pending_loot(e.id,loot_row->>'id',qty);loot_gained:=qty;
        event_text:='주변에 남겨진 '||(loot_row->>'id')||' '||qty||'개를 회수했다';
      else
        event_text:='회수할 만한 전리품을 찾지 못했다';
      end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','loot','text',event_text,'loot',loot_gained,'t',now()),battle_state='{}'::jsonb,updated_at=now() where id=e.id;
    elsif event_roll<0.72 then
      phase_now:='이동';
      event_text:=case e.site_id when 'mountain_village' then '산길을 따라 다음 골목으로 이동한다' when 'farm_road' then '농로를 따라 인간의 흔적을 추적한다' when 'border_outpost' then '초소 순찰 동선을 피해 관문 쪽으로 이동한다' else '다음 구역으로 이동한다' end;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','move','text',event_text,'t',now()),battle_state='{}'::jsonb,updated_at=now() where id=e.id;
    else
      select boss_ready,boss_cleared,normal_wins into boss_ready_v,boss_cleared_v,progress_wins from public.game_stage_progress where player_id=e.player_id and site_id=e.site_id for update;
      is_boss:=coalesce(boss_ready_v,false) and not coalesce(boss_cleared_v,false);
      enemy:=case when is_boss then e.boss_name else e.enemy_names[1+floor(random()*array_length(e.enemy_names,1))::int] end;
      enemy_role:=case when is_boss then '보스' when enemy ~ '사냥꾼|석궁|호위' then '궁수' when enemy ~ '대장|기사|경비|병사' then '전사' when enemy ~ '나무꾼|농부|짐꾼' then '투사' else '민병' end;
      enemy_power:=case when is_boss then e.boss_power else e.recommended_power end;
      party_spd:=0;party_hp_json:='{}'::jsonb;party_max_json:='{}'::jsonb;attack_counts:='{}'::jsonb;
      for mem in
        select m.*,coalesce(eq.eq_hp,0) eq_hp,coalesce(eq.eq_spd,0) eq_spd,coalesce(eq.eq_evade,0) eq_evade
        from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
        left join lateral (select sum(d.hp) eq_hp,sum(d.spd) eq_spd,sum(d.evade) eq_evade from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
        where em.expedition_id=e.id order by em.position
      loop
        growth:=case mem.growth_grade when 'S' then 1.21 when 'A' then 1.13 when 'B' then 1.06 else 1 end;lvl:=greatest(1,mem.level);
        mhp:=mem.hp_base+(lvl-1)*9*growth+greatest(0,mem.talent-80)*2+mem.eq_hp;
        mspd:=mem.spd_base+(lvl-1)*0.18*growth+mem.eq_spd;
        if mem.trait='재빠름' then mspd:=mspd*1.08;end if;
        if mem.personality='겁쟁이' then mspd:=mspd*1.05;elsif mem.personality='야행성' and (extract(hour from now() at time zone 'Asia/Seoul')>=18 or extract(hour from now() at time zone 'Asia/Seoul')<6) then mspd:=mspd*1.12;end if;
        max_hp:=greatest(1,round(mhp)::int);party_hp_json:=jsonb_set(party_hp_json,array[mem.id::text],to_jsonb(max_hp),true);party_max_json:=jsonb_set(party_max_json,array[mem.id::text],to_jsonb(max_hp),true);attack_counts:=jsonb_set(attack_counts,array[mem.id::text],'0'::jsonb,true);party_spd:=party_spd+mspd;
      end loop;
      party_spd:=party_spd/greatest(1,party_n);
      group_hp_scale:=0.8+0.35*(party_n-1);group_atk_scale:=0.9+0.20*(party_n-1);
      enemy_hp_max:=greatest(25,round(enemy_power*1.40*group_hp_scale)::int);enemy_atk:=greatest(5,enemy_power*0.44*group_atk_scale);enemy_def:=greatest(2,enemy_power*0.17);enemy_spd:=9;enemy_crit:=0.05;enemy_evade:=0.03;
      if enemy_role='궁수' then enemy_hp_max:=round(enemy_hp_max*0.84);enemy_atk:=enemy_atk*1.22;enemy_def:=enemy_def*0.78;enemy_spd:=14;enemy_crit:=0.13;enemy_evade:=0.07;
      elsif enemy_role='전사' then enemy_hp_max:=round(enemy_hp_max*1.28);enemy_atk:=enemy_atk*1.10;enemy_def:=enemy_def*1.35;enemy_spd:=8;enemy_crit:=0.06;enemy_evade:=0.02;
      elsif enemy_role='투사' then enemy_hp_max:=round(enemy_hp_max*1.10);enemy_atk:=enemy_atk*1.16;enemy_def:=enemy_def*0.92;enemy_spd:=8;enemy_crit:=0.07;
      elsif enemy_role='보스' then enemy_hp_max:=round(enemy_hp_max*2.25);enemy_atk:=enemy_atk*1.55;enemy_def:=enemy_def*1.35;enemy_spd:=11;enemy_crit:=0.12;enemy_evade:=0.05;end if;
      initiative_chance:=greatest(0.25,least(0.75,party_spd/greatest(1,party_spd+enemy_spd)));
      turn_side:=case when random()<initiative_chance then 'party' else 'enemy' end;
      newstate:=jsonb_build_object('active',true,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'enemyHp',enemy_hp_max,'enemyMaxHp',enemy_hp_max,'enemyAtk',enemy_atk,'enemyDef',enemy_def,'enemySpd',enemy_spd,'enemyCrit',enemy_crit,'enemyEvade',enemy_evade,'partyHp',party_hp_json,'partyMaxHp',party_max_json,'attackCounts',attack_counts,'turn',turn_side,'initiative',turn_side,'initiativeChance',initiative_chance,'round',1,'damageDealt',0,'damageTaken',0,'crits',0,'dodges',0,'enemyCrits',0,'skills','[]'::jsonb,'lastAction',jsonb_build_object('type','encounter','turn',turn_side));
      event_text:=enemy||' 조우 · '||case when turn_side='party' then '몬스터 측 선공' else '인간 측 선공' end;
      log_entry:=jsonb_build_object('t',now(),'type','encounter','phase','조우','enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'initiative',turn_side,'initiativeChance',initiative_chance,'partyCount',party_n);
      update public.game_expeditions set phase='조우',battle_count=battle_count+1,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','encounter','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'initiative',turn_side,'initiativeChance',initiative_chance,'t',now()),battle_state=newstate,updated_at=now() where id=e.id;
    end if;
  else
    enemy:=bs->>'enemy';enemy_role:=bs->>'enemyRole';is_boss:=coalesce((bs->>'boss')::boolean,false);enemy_hp:=coalesce((bs->>'enemyHp')::int,0);enemy_hp_max:=coalesce((bs->>'enemyMaxHp')::int,1);enemy_atk:=coalesce((bs->>'enemyAtk')::numeric,5);enemy_def:=coalesce((bs->>'enemyDef')::numeric,2);enemy_spd:=coalesce((bs->>'enemySpd')::numeric,9);enemy_crit:=coalesce((bs->>'enemyCrit')::numeric,0.05);enemy_evade:=coalesce((bs->>'enemyEvade')::numeric,0.03);party_hp_json:=coalesce(bs->'partyHp','{}'::jsonb);party_max_json:=coalesce(bs->'partyMaxHp','{}'::jsonb);attack_counts:=coalesce(bs->'attackCounts','{}'::jsonb);turn_side:=coalesce(bs->>'turn','party');round_i:=greatest(1,coalesce((bs->>'round')::int,1));dealt_total:=coalesce((bs->>'damageDealt')::int,0);taken_total:=coalesce((bs->>'damageTaken')::int,0);crits:=coalesce((bs->>'crits')::int,0);dodges:=coalesce((bs->>'dodges')::int,0);enemy_crits:=coalesce((bs->>'enemyCrits')::int,0);heal_total:=coalesce((bs->>'healingDone')::int,0);turn_heal:=0;skill_events:='[]'::jsonb;death_events:='[]'::jsonb;total_dmg:=0;
    if turn_side='party' then
      for mem in
        select m.*,coalesce(eq.eq_atk,0) eq_atk,coalesce(eq.eq_def,0) eq_def,coalesce(eq.eq_hp,0) eq_hp,coalesce(eq.eq_spd,0) eq_spd,coalesce(eq.eq_crit,0) eq_crit,coalesce(eq.eq_evade,0) eq_evade,coalesce(eq.human_damage,0) human_damage
        from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
        left join lateral (select sum(d.atk) eq_atk,sum(d.def) eq_def,sum(d.hp) eq_hp,sum(d.spd) eq_spd,sum(d.crit) eq_crit,sum(d.evade) eq_evade,sum(d.human_damage) human_damage from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
        where em.expedition_id=e.id order by em.position
      loop
        current_hp:=coalesce((party_hp_json->>mem.id::text)::int,0);if current_hp<=0 then continue;end if;max_hp:=greatest(1,coalesce((party_max_json->>mem.id::text)::int,current_hp));
        growth:=case mem.growth_grade when 'S' then 1.21 when 'A' then 1.13 when 'B' then 1.06 else 1 end;lvl:=greatest(1,mem.level);
        matk:=mem.atk_base+(lvl-1)*2*growth+greatest(0,mem.talent-80)*0.22+mem.eq_atk;mspd:=mem.spd_base+(lvl-1)*0.18*growth+mem.eq_spd;mcrit:=mem.crit_base+mem.eq_crit;mhuman:=mem.human_damage;
        if mem.trait='재빠름' then mspd:=mspd*1.08;end if;
        if mem.personality='광전사' then matk:=matk*1.15;mcrit:=mcrit+0.05;elsif mem.personality='겁쟁이' then matk:=matk*0.95;mspd:=mspd*1.05;elsif mem.personality='인간혐오' then mhuman:=mhuman+0.12;elsif mem.personality='야행성' and (extract(hour from now() at time zone 'Asia/Seoul')>=18 or extract(hour from now() at time zone 'Asia/Seoul')<6) then matk:=matk*1.12;mspd:=mspd*1.12;end if;
        if mem.trait='야성' and current_hp<max_hp*0.4 then matk:=matk*1.20;end if;
        attack_no:=coalesce((attack_counts->>mem.id::text)::int,0)+1;attack_counts:=jsonb_set(attack_counts,array[mem.id::text],to_jsonb(attack_no),true);
        dmg:=0;heal_amount:=0;skill_fx:=public.game_trigger_monster_skill(mem.id,attack_no,current_hp::numeric/max_hp);
        skill_mult:=coalesce((skill_fx->>'damage_multiplier')::numeric,1);skill_ignore:=coalesce((skill_fx->>'defense_ignore')::numeric,0);skill_effect:=coalesce(nullif(skill_fx->>'effect_type',''),'damage');heal_ratio:=coalesce((skill_fx->>'heal_ratio')::numeric,0);armor_coeff:=case when skill_effect='magic' then 0.38 else 0.55 end;
        skill_name:=nullif(skill_fx->>'name','');skill_owner:=nullif(skill_fx->>'owner','');
        if skill_name is not null and skill_effect='heal' and heal_ratio>0 then
          heal_target_id:=null;heal_target_name:=null;
          select em.monster_id,m.name into heal_target_id,heal_target_name
          from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
          where em.expedition_id=e.id
            and coalesce((party_hp_json->>em.monster_id::text)::int,0)>0
            and coalesce((party_hp_json->>em.monster_id::text)::int,0)<coalesce((party_max_json->>em.monster_id::text)::int,1)
          order by (coalesce((party_hp_json->>em.monster_id::text)::int,0)::numeric/greatest(1,coalesce((party_max_json->>em.monster_id::text)::int,1))) asc,em.position
          limit 1;
          if heal_target_id is not null then
            heal_before:=coalesce((party_hp_json->>heal_target_id::text)::int,0);heal_target_max:=greatest(1,coalesce((party_max_json->>heal_target_id::text)::int,heal_before));heal_after:=least(heal_target_max,heal_before+greatest(1,round(heal_target_max*heal_ratio)::int));heal_amount:=greatest(0,heal_after-heal_before);
            if heal_amount>0 then party_hp_json:=jsonb_set(party_hp_json,array[heal_target_id::text],to_jsonb(heal_after),true);turn_heal:=turn_heal+heal_amount;heal_total:=heal_total+heal_amount;skill_events:=skill_events||jsonb_build_array(jsonb_build_object('name',skill_name,'owner',skill_owner,'monsterId',mem.id,'attack',attack_no,'effect','heal','heal',heal_amount,'target',heal_target_name));end if;
          end if;
        end if;
        if random()>=least(0.35,enemy_evade+greatest(0,enemy_spd-mspd)*0.002) then
          dmg:=greatest(1,round(matk*(0.88+random()*0.24)*(1+mhuman)*skill_mult-enemy_def*armor_coeff*(1-least(0.90,skill_ignore)))::int);
          if random()<least(0.45,mcrit) then dmg:=round(dmg*1.7);crits:=crits+1;end if;
          enemy_hp:=greatest(0,enemy_hp-dmg);total_dmg:=total_dmg+dmg;dealt_total:=dealt_total+dmg;
          if skill_name is not null and skill_effect<>'heal' then skill_events:=skill_events||jsonb_build_array(jsonb_build_object('name',skill_name,'owner',skill_owner,'monsterId',mem.id,'attack',attack_no,'mult',skill_mult,'effect',skill_effect,'ignore',skill_ignore));end if;
        end if;
        exit when enemy_hp<=0;
      end loop;
      won:=enemy_hp<=0;
      last_action:=jsonb_build_object('type','party-turn','side','party','round',round_i,'damage',total_dmg,'healing',turn_heal,'skills',skill_events);
      if won then
        if is_boss then
          update public.game_stage_progress set boss_cleared=true,boss_ready=false,boss_cleared_at=now(),boss_attempts=boss_attempts+1,updated_at=now() where player_id=e.player_id and site_id=e.site_id;
          update public.game_players set fame=fame+25,updated_at=now() where device_id=e.player_id;
        else
          update public.game_stage_progress set normal_wins=normal_wins+1,boss_ready=(not boss_cleared and (normal_wins+1)>=500),updated_at=now() where player_id=e.player_id and site_id=e.site_id;
          update public.game_players set fame=fame+case when random()<0.08 then 1 else 0 end,updated_at=now() where device_id=e.player_id;
        end if;
        xp_each:=greatest(1,floor((e.xp_per_kill*(case when is_boss then 5 else 1 end))::numeric/party_n)::int);
        for mem in select m.id,m.trait from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id loop xp_amt:=case when mem.trait='학습 본능' then round(xp_each*1.12)::int else xp_each end;perform public.game_apply_xp(mem.id,xp_amt);update public.game_monsters set kills=kills+1 where id=mem.id;end loop;
        update public.game_expeditions set kills=kills+1 where id=e.id;
        select greatest(coalesce(max(case when m.personality='약탈광' then 0.20 else 0 end),0),coalesce(max(case when m.trait='수집광' then 0.15 else 0 end),0)) into party_loot from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id;
        for loot_row in select value from jsonb_array_elements(e.loot) loop chance:=least(0.95,coalesce((loot_row->>'chance')::numeric,0)*(1+party_loot)*(case when is_boss then 3 else 1 end));if random()<chance then qty:=floor(random()*(coalesce((loot_row->>'max')::int,1)-coalesce((loot_row->>'min')::int,1)+1))::int+coalesce((loot_row->>'min')::int,1);perform public.game_add_pending_loot(e.id,loot_row->>'id',qty);loot_gained:=loot_gained+qty;end if;end loop;
        event_text:=case when is_boss then enemy||' 보스 박멸 완료' else enemy||' 박멸 완료' end;
        newstate:=bs||jsonb_build_object('active',false,'result','win','enemyHp',0,'turn',null,'damageDealt',dealt_total,'healingDone',heal_total,'crits',crits,'skills',skill_events,'lastAction',last_action,'loot',loot_gained);
        log_entry:=jsonb_build_object('t',now(),'type','battle-end','phase','전투','enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','win','round',round_i,'damage',total_dmg,'damageDealt',dealt_total,'damageTaken',taken_total,'healingDone',heal_total,'skills',skill_events,'loot',loot_gained,'partyHp',party_hp_json,'partyMaxHp',party_max_json);
        update public.game_expeditions set phase='수색',event_state=jsonb_build_object('type','battle_end','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','win','t',now()),battle_state=newstate,updated_at=now() where id=e.id;
      else
        event_text:='몬스터 측 공격 · '||total_dmg||' 피해';
        newstate:=bs||jsonb_build_object('enemyHp',enemy_hp,'partyHp',party_hp_json,'attackCounts',attack_counts,'turn','enemy','round',round_i,'damageDealt',dealt_total,'healingDone',heal_total,'crits',crits,'skills',skill_events,'lastAction',last_action);
        log_entry:=jsonb_build_object('t',now(),'type','battle-turn','phase','전투','side','party','round',round_i,'enemy',enemy,'enemyRole',enemy_role,'damage',total_dmg,'healing',turn_heal,'enemyHp',enemy_hp,'enemyMaxHp',enemy_hp_max,'skills',skill_events,'partyHp',party_hp_json,'partyMaxHp',party_max_json);
        update public.game_expeditions set phase='전투',event_state=jsonb_build_object('type','battle_turn','side','party','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'round',round_i,'t',now()),battle_state=newstate,updated_at=now() where id=e.id;
      end if;
    else
      select m.*,coalesce(eq.eq_def,0) eq_def,coalesce(eq.eq_spd,0) eq_spd,coalesce(eq.eq_evade,0) eq_evade,coalesce(rs.damage_reduction,0) role_reduction,coalesce(rs.taunt_weight,1) role_taunt into mem
      from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
      left join lateral (select sum(d.def) eq_def,sum(d.spd) eq_spd,sum(d.evade) eq_evade from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
      left join public.game_skill_defs rs on rs.id=m.skill_id
      where em.expedition_id=e.id and coalesce((party_hp_json->>m.id::text)::int,0)>0
      order by (-ln(greatest(random(),0.000001))/greatest(0.10,coalesce(rs.taunt_weight,1))) asc limit 1;
      if not found then
        lost:=true;
      else
        target_id:=mem.id;target_name:=mem.name;hp_before:=coalesce((party_hp_json->>mem.id::text)::int,0);max_hp:=greatest(1,coalesce((party_max_json->>mem.id::text)::int,hp_before));growth:=case mem.growth_grade when 'S' then 1.21 when 'A' then 1.13 when 'B' then 1.06 else 1 end;lvl:=greatest(1,mem.level);
        mdef:=mem.def_base+(lvl-1)*0.8*growth+mem.eq_def;mspd:=mem.spd_base+(lvl-1)*0.18*growth+mem.eq_spd;mevade:=mem.evade_base+mem.eq_evade;
        if mem.trait='질긴 가죽' then mdef:=mdef*1.10;elsif mem.trait='재빠름' then mspd:=mspd*1.08;mevade:=mevade+0.02;end if;
        if mem.personality='광전사' then mdef:=mdef*0.90;elsif mem.personality='겁쟁이' then mspd:=mspd*1.05;mevade:=mevade+0.08;elsif mem.personality='침착' then mdef:=mdef*1.10;mevade:=mevade+0.02;elsif mem.personality='야행성' and (extract(hour from now() at time zone 'Asia/Seoul')>=18 or extract(hour from now() at time zone 'Asia/Seoul')<6) then mspd:=mspd*1.12;end if;
        dmg:=0;
        if random()>=least(0.35,least(0.35,mevade)+greatest(0,mspd-enemy_spd)*0.002) then dmg:=greatest(1,round(enemy_atk*(0.88+random()*0.24)-mdef*0.58)::int);if random()<enemy_crit then dmg:=round(dmg*1.65);enemy_crits:=enemy_crits+1;end if;if dmg>0 and coalesce(mem.role_reduction,0)>0 then dmg:=greatest(1,round(dmg*(1-least(0.55,mem.role_reduction)))::int);end if;else dodges:=dodges+1;end if;
        hp_after:=greatest(0,hp_before-dmg);party_hp_json:=jsonb_set(party_hp_json,array[mem.id::text],to_jsonb(hp_after),true);taken_total:=taken_total+dmg;
        if hp_before>0 and hp_after<=0 then xp_lost:=public.game_apply_death_xp_penalty(mem.id);death_events:=jsonb_build_array(jsonb_build_object('monsterId',mem.id,'name',mem.name,'xpLost',xp_lost));end if;
        select count(*) into living_n from public.game_expedition_members em where em.expedition_id=e.id and coalesce((party_hp_json->>em.monster_id::text)::int,0)>0;
        lost:=living_n<=0;
      end if;
      last_action:=jsonb_build_object('type','enemy-turn','side','enemy','round',round_i,'targetId',target_id,'target',target_name,'damage',dmg,'tankReduction',coalesce(mem.role_reduction,0),'tauntWeight',coalesce(mem.role_taunt,1),'deaths',death_events);
      if lost then
        if is_boss then update public.game_stage_progress set boss_attempts=boss_attempts+1,updated_at=now() where player_id=e.player_id and site_id=e.site_id;end if;
        event_text:=enemy||'에게 전투 패배';
        newstate:=bs||jsonb_build_object('active',false,'result','loss','partyHp',party_hp_json,'turn',null,'round',round_i,'damageTaken',taken_total,'dodges',dodges,'enemyCrits',enemy_crits,'skills','[]'::jsonb,'lastAction',last_action);
        log_entry:=jsonb_build_object('t',now(),'type','battle-end','phase','전투','side','enemy','round',round_i,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','loss','damage',dmg,'damageDealt',dealt_total,'damageTaken',taken_total,'deaths',death_events,'partyHp',party_hp_json,'partyMaxHp',party_max_json);
        update public.game_expeditions set phase='휴식',event_state=jsonb_build_object('type','battle_end','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','loss','deaths',death_events,'t',now()),battle_state=newstate,updated_at=now() where id=e.id;
      else
        event_text:=enemy||' 공격 · '||coalesce(target_name,'몬스터')||'에게 '||dmg||' 피해'||case when jsonb_array_length(death_events)>0 then ' · 전투불능' else '' end;
        newstate:=bs||jsonb_build_object('partyHp',party_hp_json,'turn','party','round',round_i+1,'damageTaken',taken_total,'dodges',dodges,'enemyCrits',enemy_crits,'skills','[]'::jsonb,'lastAction',last_action);
        log_entry:=jsonb_build_object('t',now(),'type','battle-turn','phase','전투','side','enemy','round',round_i,'enemy',enemy,'enemyRole',enemy_role,'target',target_name,'targetId',target_id,'damage',dmg,'deaths',death_events,'partyHp',party_hp_json,'partyMaxHp',party_max_json);
        update public.game_expeditions set phase='전투',event_state=jsonb_build_object('type','battle_turn','side','enemy','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'target',target_name,'damage',dmg,'deaths',death_events,'round',round_i,'t',now()),battle_state=newstate,updated_at=now() where id=e.id;
      end if;
    end if;
  end if;

  newlog:=jsonb_build_array(log_entry)||coalesce(e.battle_log,'[]'::jsonb);
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into newlog from jsonb_array_elements(newlog) with ordinality a(value,ord) where ord<=20;
  update public.game_expeditions set battle_log=newlog where id=e.id;
  return log_entry;
end
$$;
