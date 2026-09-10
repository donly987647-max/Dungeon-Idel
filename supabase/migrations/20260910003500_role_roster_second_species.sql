-- v0.12.7: add a second species for each specialist party role.

alter table public.game_candidates drop constraint if exists game_candidates_family_check;
alter table public.game_candidates add constraint game_candidates_family_check
check (family = any(array['slime'::text,'goblin'::text,'troll'::text,'mandrake'::text,'imp'::text,'golem'::text,'pixie'::text,'wisp'::text,'mimic'::text]));

alter table public.game_monsters drop constraint if exists game_monsters_family_check;
alter table public.game_monsters add constraint game_monsters_family_check
check (family = any(array['slime'::text,'goblin'::text,'troll'::text,'mandrake'::text,'imp'::text,'golem'::text,'pixie'::text,'wisp'::text,'mimic'::text]));

insert into public.game_skill_defs(id,name,trigger_type,trigger_value,trigger_count,condition_value,damage_multiplier,defense_ignore,effect_type,heal_ratio,damage_reduction,taunt_weight,description) values
('emergency_glimmer','응급 섬광','chance',0.35,0,0,0.85,0,'heal',0.16,0,1,'공격 시 35% 확률로 가장 다친 아군을 최대 HP 16%만큼 회복합니다.'),
('moon_mend','달빛 봉합','every_n',0,2,0,0.80,0,'heal',0.18,0,1,'2번째 공격마다 가장 다친 아군을 최대 HP 18%만큼 회복합니다.'),
('scarlet_dust','진홍 가루','chance',0.32,0,0,1.15,0.05,'heal',0.14,0,1,'공격 시 32% 확률로 공격과 회복을 동시에 수행합니다.'),
('starlight_mend','별빛 치유','chance',0.42,0,0,0.80,0,'heal',0.20,0,1,'공격 시 42% 확률로 가장 다친 아군을 최대 HP 20% 회복합니다.'),
('morning_dew','새벽 이슬','every_n',0,2,0,0.75,0,'heal',0.22,0,1,'2번째 공격마다 최대 HP 22%를 회복하는 고정 주기 치유입니다.'),
('crimson_transfer','진홍 전이','chance',0.38,0,0,1.25,0.10,'heal',0.16,0,1,'공격 시 38% 확률로 강한 공격과 16% 회복을 함께 수행합니다.'),
('thorn_kiss','가시의 입맞춤','every_n',0,3,0,1.50,0.15,'heal',0.13,0,1,'3번째 공격마다 높은 공격 배율과 13% 회복을 동시에 제공합니다.'),
('mana_spark','마나 스파크','chance',0.30,0,0,1.45,0.35,'magic',0,0,1,'공격 시 30% 확률로 방어를 35% 관통하는 마력 파동을 발사합니다.'),
('storm_arc','폭풍 아크','chance',0.34,0,0,1.65,0.30,'magic',0,0,1,'공격 시 34% 확률로 빠른 연쇄 번개를 발동합니다.'),
('phase_bolt','위상 탄환','every_n',0,2,0,1.45,0.60,'magic',0,0,1,'2번째 공격마다 적 방어 60%를 무시하는 위상 탄환을 발사합니다.'),
('thunder_chain','천둥 연쇄','chance',0.38,0,0,1.85,0.35,'magic',0,0,1,'공격 시 38% 확률로 높은 피해의 연쇄 번개를 발동합니다.'),
('tempest_core','템페스트 코어','every_n',0,3,0,2.25,0.30,'magic',0,0,1,'3번째 공격마다 응축된 폭풍 마력을 폭발시킵니다.'),
('nether_pulse','네더 펄스','every_n',0,2,0,1.65,0.72,'magic',0,0,1,'2번째 공격마다 적 방어 72%를 무시하는 안정적인 관통 마법입니다.'),
('prism_break','프리즘 파열','chance',0.30,0,0,2.05,0.62,'magic',0,0,1,'공격 시 30% 확률로 높은 배율과 관통을 동시에 갖는 마법 폭발을 일으킵니다.'),
('bait_counter','미끼 반격','every_n',0,3,0,1.55,0.10,'tank',0,0.18,2.5,'상시 도발과 피해 18% 감소를 유지하며 3번째 공격마다 반격합니다.'),
('iron_lid','철제 뚜껑','every_n',0,3,0,1.65,0.15,'tank',0,0.22,2.8,'상시 피해 22% 감소와 높은 도발을 유지하며 3번째 공격마다 반격합니다.'),
('devour_counter','포식 반격','every_n',0,3,0,1.85,0.10,'tank',0,0.14,2.3,'방어를 일부 포기하고 3번째 공격마다 강한 반격을 수행합니다.'),
('vault_guard','금고 수호','every_n',0,4,0,1.45,0.25,'tank',0,0.32,3.6,'상시 피해 32% 감소와 높은 도발로 생존에 집중합니다.'),
('royal_counter','왕실 반격','every_n',0,3,0,1.80,0.25,'tank',0,0.26,3.2,'수비와 반격 화력을 균형 있게 갖춘 미믹 진화형입니다.'),
('maw_crush','대아귀 분쇄','every_n',0,3,0,2.20,0.20,'tank',0,0.17,2.5,'상시 피해 감소를 유지하며 3번째 공격마다 강력한 포식 반격을 가합니다.'),
('blood_box','혈상자','hp_below_chance',0.45,0,0.60,2.35,0.25,'tank',0,0.20,2.7,'HP가 60% 이하일 때 45% 확률로 강한 반격을 발동합니다.')
on conflict(id) do update set name=excluded.name,trigger_type=excluded.trigger_type,trigger_value=excluded.trigger_value,trigger_count=excluded.trigger_count,condition_value=excluded.condition_value,damage_multiplier=excluded.damage_multiplier,defense_ignore=excluded.defense_ignore,effect_type=excluded.effect_type,heal_ratio=excluded.heal_ratio,damage_reduction=excluded.damage_reduction,taunt_weight=excluded.taunt_weight,description=excluded.description;

insert into public.game_evolution_defs(id,base_family,from_form_id,target_form_id,target_name,tier,required_level,hp_mult,atk_mult,def_mult,spd_mult,power_mult,crit_add,evade_add,skill_id,description) values
('pixie_moon','pixie','pixie','moon_pixie','문 픽시',1,20,1.10,1.02,1.08,1.12,1.15,0,0.03,'moon_mend','주기적인 회복에 집중하는 안정형 픽시입니다.'),
('pixie_blood','pixie','pixie','blood_pixie','블러드 픽시',1,20,1.06,1.16,1.04,1.10,1.15,0.02,0.02,'scarlet_dust','공격과 회복을 함께 수행하는 전투 지원형입니다.'),
('moon_star','pixie','moon_pixie','star_pixie','스타 픽시',2,30,1.12,1.04,1.10,1.12,1.20,0,0.04,'starlight_mend','높은 확률의 응급 회복으로 불규칙한 피해를 빠르게 복구합니다.'),
('moon_dew_pixie','pixie','moon_pixie','dew_pixie','듀 픽시',2,30,1.16,0.98,1.12,1.08,1.20,0,0.03,'morning_dew','고정 주기 대회복에 특화된 순수 힐러입니다.'),
('blood_crimson_pixie','pixie','blood_pixie','crimson_pixie','크림슨 픽시',2,30,1.08,1.20,1.06,1.12,1.21,0.03,0.02,'crimson_transfer','공격 기여도를 높이면서도 안정적인 회복을 유지합니다.'),
('blood_thorn_pixie','pixie','blood_pixie','thorn_pixie','쏜 픽시',2,30,1.06,1.26,1.04,1.14,1.21,0.04,0.03,'thorn_kiss','힐러 중 가장 높은 공격 기여도를 가진 공격지원형입니다.'),
('wisp_storm','wisp','wisp','storm_wisp','스톰 위습',1,20,1.04,1.20,1.02,1.12,1.16,0.03,0.03,'storm_arc','잦은 확률 마법으로 평균 화력을 끌어올립니다.'),
('wisp_phase','wisp','wisp','phase_wisp','페이즈 위습',1,20,1.06,1.12,1.04,1.10,1.16,0.02,0.04,'phase_bolt','낮은 배율 대신 높은 방어 관통을 자주 발동합니다.'),
('storm_thunder','wisp','storm_wisp','thunder_wisp','썬더 위습',2,30,1.06,1.24,1.04,1.12,1.21,0.04,0.03,'thunder_chain','높은 발동률과 강한 연쇄 번개로 평균 DPS를 극대화합니다.'),
('storm_tempest','wisp','storm_wisp','tempest_wisp','템페스트 위습',2,30,1.08,1.28,1.04,1.08,1.22,0.04,0.02,'tempest_core','3타 주기의 큰 폭발 피해에 집중합니다.'),
('phase_nether','wisp','phase_wisp','nether_wisp','네더 위습',2,30,1.08,1.18,1.06,1.12,1.21,0.03,0.04,'nether_pulse','매우 높은 방어 관통을 안정적인 짧은 주기로 사용합니다.'),
('phase_prism','wisp','phase_wisp','prism_wisp','프리즘 위습',2,30,1.06,1.24,1.04,1.14,1.22,0.04,0.05,'prism_break','확률형 고배율 관통 마법으로 폭발적인 변수를 만듭니다.'),
('mimic_iron','mimic','mimic','iron_mimic','아이언 미믹',1,20,1.18,1.10,1.20,0.98,1.16,0,0,'iron_lid','생존과 반격의 균형을 높인 수비형 미믹입니다.'),
('mimic_ravenous','mimic','mimic','ravenous_mimic','레이버너스 미믹',1,20,1.10,1.22,1.08,1.02,1.16,0.02,0,'devour_counter','탱킹 일부를 포기하고 반격 화력을 높입니다.'),
('iron_vault','mimic','iron_mimic','vault_mimic','볼트 미믹',2,30,1.24,1.06,1.24,0.96,1.21,0,0,'vault_guard','골렘에 가까운 생존력과 강한 도발을 획득합니다.'),
('iron_royal','mimic','iron_mimic','royal_mimic','로열 미믹',2,30,1.18,1.16,1.18,1.00,1.21,0.01,0,'royal_counter','수비력을 유지하면서 반격 피해를 끌어올립니다.'),
('ravenous_maw','mimic','ravenous_mimic','maw_mimic','그레이트 모 미믹',2,30,1.14,1.30,1.10,1.02,1.22,0.03,0,'maw_crush','공격형 탱커 중 가장 높은 반격 화력을 가집니다.'),
('ravenous_bloodbox','mimic','ravenous_mimic','bloodbox_mimic','블러드박스',2,30,1.20,1.26,1.12,1.00,1.22,0.02,0,'blood_box','체력이 낮을수록 강한 반격을 노리는 위기대응형 탱커입니다.')
on conflict(id) do update set base_family=excluded.base_family,from_form_id=excluded.from_form_id,target_form_id=excluded.target_form_id,target_name=excluded.target_name,tier=excluded.tier,required_level=excluded.required_level,hp_mult=excluded.hp_mult,atk_mult=excluded.atk_mult,def_mult=excluded.def_mult,spd_mult=excluded.spd_mult,power_mult=excluded.power_mult,crit_add=excluded.crit_add,evade_add=excluded.evade_add,skill_id=excluded.skill_id,description=excluded.description;

create or replace function public.game_hire_candidate(p_player uuid,p_candidate uuid)
returns jsonb language plpgsql set search_path to 'public' as $$
declare p record;c record;current_count int;cap int;new_id uuid;base_skill text;
begin
 select quarters_level into p from public.game_players where device_id=p_player for update;if not found then raise exception 'player_missing';end if;
 select * into c from public.game_candidates where id=p_candidate and player_id=p_player for update;if not found then raise exception 'candidate_missing';end if;
 cap:=3+greatest(0,coalesce(p.quarters_level,1)-1)*2;select count(*)::int into current_count from public.game_monsters where player_id=p_player and released_at is null;if current_count>=cap then raise exception 'quarters_full';end if;
 base_skill:=case c.family when 'mandrake' then 'healing_spore' when 'pixie' then 'emergency_glimmer' when 'imp' then 'arcane_bolt' when 'wisp' then 'mana_spark' when 'golem' then 'guardian_slam' when 'mimic' then 'bait_counter' else null end;
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
   fam:=(array['slime','goblin','troll','mandrake','imp','golem','pixie','wisp','mimic'])[1+floor(random()*9)::int];pers:=(array['침착','약탈광','광전사','겁쟁이','인간혐오','야행성'])[1+floor(random()*6)::int];tr:=(array['질긴 가죽','야성','재빠름','수집광','학습 본능'])[1+floor(random()*5)::int];talent:=case grade when 'S' then 94+floor(random()*7)::int when 'A' then 88+floor(random()*10)::int when 'B' then 82+floor(random()*11)::int else 76+floor(random()*12)::int end;talent:=least(100,talent+greatest(0,p.tavern_level-1));mult:=case grade when 'S' then 1.16 when 'A' then 1.10 when 'B' then 1.05 else 1 end;
   if fam='slime' then hp:=round(145*mult);atk:=round(15*mult);de:=round(11*mult);spd:=round(9*mult);cr:=0.04;ev:=0.03;pb:=45;
   elsif fam='goblin' then hp:=round(100*mult);atk:=round(21*mult);de:=round(7*mult);spd:=round(14*mult);cr:=0.08;ev:=0.06;pb:=52;
   elsif fam='troll' then hp:=round(175*mult);atk:=round(24*mult);de:=round(13*mult);spd:=round(7*mult);cr:=0.05;ev:=0.02;pb:=68;
   elsif fam='mandrake' then hp:=round(125*mult);atk:=round(12*mult);de:=round(9*mult);spd:=round(10*mult);cr:=0.03;ev:=0.04;pb:=50;
   elsif fam='pixie' then hp:=round(78*mult);atk:=round(10*mult);de:=round(4*mult);spd:=round(17*mult);cr:=0.03;ev:=0.12;pb:=48;
   elsif fam='imp' then hp:=round(86*mult);atk:=round(22*mult);de:=round(5*mult);spd:=round(11*mult);cr:=0.06;ev:=0.04;pb:=54;
   elsif fam='wisp' then hp:=round(76*mult);atk:=round(21*mult);de:=round(4*mult);spd:=round(16*mult);cr:=0.06;ev:=0.10;pb:=53;
   elsif fam='golem' then hp:=round(240*mult);atk:=round(13*mult);de:=round(21*mult);spd:=round(5*mult);cr:=0.02;ev:=0.01;pb:=63;
   else hp:=round(185*mult);atk:=round(20*mult);de:=round(17*mult);spd:=round(6*mult);cr:=0.04;ev:=0.01;pb:=62;end if;
   insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
   values(p.device_id,(array['꾸륵','찍찍','우르그','푸르','크룩','도르','무그','벨칵','루트','지직','둔석','모스','피코','위링','찰칵'])[1+floor(random()*15)::int],fam,talent,tr,pb,pers,grade,hp,atk,de,spd,cr,ev,false);made:=made+1;
  end loop;end if;update public.game_players set next_candidate_at=now()+interval '4 hours',updated_at=now() where device_id=p.device_id;
 end loop;return made;
end $$;
