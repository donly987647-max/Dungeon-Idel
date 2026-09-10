CREATE OR REPLACE FUNCTION public.game_process_expedition_action(p_expedition uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  recovery jsonb;
  recovery_text text;
  exp_hp_ratio numeric:=1;
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
    exp_hp_ratio:=public.game_expedition_hp_ratio(bs);
    event_roll:=random();
    /* Wounded parties become cautious instead of chain-pulling enemies forever. */
    if event_roll>=0.72 then
      if exp_hp_ratio<0.35 and random()<0.82 then event_roll:=0.60;
      elsif exp_hp_ratio<0.60 and random()<0.57 then event_roll:=0.60;
      end if;
    end if;
    loot_gained:=0;
    if event_roll<0.28 then
      phase_now:='수색';
      event_text:=case e.site_id when 'mountain_village' then '목책과 민가 주변을 수색한다' when 'farm_road' then '마차길과 곡물창고 주변을 수색한다' when 'border_outpost' then '석벽과 감시탑 사각지대를 수색한다' else '주변을 수색한다' end;
      select greatest(coalesce(max(case when m.personality='약탈광' then 0.15 else 0 end),0),coalesce(max(case when m.trait='수집광' then 0.10 else 0 end),0))
      into search_bonus from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id;
      if random()<least(0.35,0.10+coalesce(search_bonus,0)*0.50) then
        select l.value into loot_row from jsonb_array_elements(e.loot) l
        where coalesce(l.value->>'source','kill')='scavenge' and exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;
        if loot_row is not null then perform public.game_add_pending_loot(e.id,loot_row->>'id',1);loot_gained:=1;event_text:=event_text||' · 보급품 발견';end if;
      end if;
      recovery:=public.game_roll_exploration_recovery(e.id,bs);bs:=coalesce(recovery->'state',bs);recovery_text:=coalesce(recovery->>'text','');if recovery_text<>'' then event_text:=event_text||' · '||recovery_text;end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'recovery',coalesce(recovery,'{}'::jsonb)-'state','partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','search','text',event_text,'loot',loot_gained,'t',now()),battle_state=bs,updated_at=now() where id=e.id;
    elsif event_roll<0.48 then
      phase_now:='전리품 수거';
      select l.value into loot_row from jsonb_array_elements(e.loot) l
      where coalesce(l.value->>'source','kill')='scavenge' and exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;
      if loot_row is not null and random()<0.18 then
        qty:=1;
        perform public.game_add_pending_loot(e.id,loot_row->>'id',qty);loot_gained:=qty;
        event_text:='주변에 남겨진 '||(loot_row->>'id')||' '||qty||'개를 회수했다';
      else
        event_text:='회수할 만한 전리품을 찾지 못했다';
      end if;
      recovery:=public.game_roll_exploration_recovery(e.id,bs);bs:=coalesce(recovery->'state',bs);recovery_text:=coalesce(recovery->>'text','');if recovery_text<>'' then event_text:=event_text||' · '||recovery_text;end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'recovery',coalesce(recovery,'{}'::jsonb)-'state','partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','loot','text',event_text,'loot',loot_gained,'t',now()),battle_state=bs,updated_at=now() where id=e.id;
    elsif event_roll<0.72 then
      phase_now:='이동';
      event_text:=case e.site_id when 'mountain_village' then '산길을 따라 다음 골목으로 이동한다' when 'farm_road' then '농로를 따라 인간의 흔적을 추적한다' when 'border_outpost' then '초소 순찰 동선을 피해 관문 쪽으로 이동한다' else '다음 구역으로 이동한다' end;
      recovery:=public.game_roll_exploration_recovery(e.id,bs);bs:=coalesce(recovery->'state',bs);recovery_text:=coalesce(recovery->>'text','');if recovery_text<>'' then event_text:=event_text||' · '||recovery_text;end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'recovery',coalesce(recovery,'{}'::jsonb)-'state','partyCount',party_n);
      update public.game_expeditions set phase=phase_now,exploration_count=exploration_count+1,event_state=jsonb_build_object('type','move','text',event_text,'t',now()),battle_state=bs,updated_at=now() where id=e.id;
    else
      select boss_ready,boss_cleared,normal_wins into boss_ready_v,boss_cleared_v,progress_wins from public.game_stage_progress where player_id=e.player_id and site_id=e.site_id for update;
      is_boss:=coalesce(boss_ready_v,false) and not coalesce(boss_cleared_v,false);
      enemy:=case when is_boss then e.boss_name else e.enemy_names[1+floor(random()*array_length(e.enemy_names,1))::int] end;
      enemy_role:=case when is_boss then '보스' when enemy ~ '사냥꾼|석궁|호위' then '궁수' when enemy ~ '대장|기사|경비|병사' then '전사' when enemy ~ '나무꾼|농부|짐꾼' then '투사' else '민병' end;
      enemy_power:=case when is_boss then e.boss_power else e.recommended_power end;
      party_spd:=0;living_n:=0;party_hp_json:=coalesce(bs->'partyHp','{}'::jsonb);party_max_json:='{}'::jsonb;attack_counts:='{}'::jsonb;
      for mem in
        select m.*,coalesce(eq.eq_hp,0) eq_hp,coalesce(eq.eq_spd,0) eq_spd,coalesce(eq.eq_evade,0) eq_evade
        from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
        left join lateral (select sum(d.hp*(1+coalesce(q.enhance_level,0)*0.08)) eq_hp,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
        where em.expedition_id=e.id order by em.position
      loop
        growth:=case mem.growth_grade when 'S' then 1.21 when 'A' then 1.13 when 'B' then 1.06 else 1 end;lvl:=greatest(1,mem.level);
        mhp:=mem.hp_base+(lvl-1)*9*growth+greatest(0,mem.talent-80)*2+mem.eq_hp;
        mspd:=mem.spd_base+(lvl-1)*0.18*growth+mem.eq_spd;
        if mem.trait='재빠름' then mspd:=mspd*1.08;end if;
        if mem.personality='겁쟁이' then mspd:=mspd*1.05;elsif mem.personality='야행성' and (extract(hour from now() at time zone 'Asia/Seoul')>=18 or extract(hour from now() at time zone 'Asia/Seoul')<6) then mspd:=mspd*1.12;end if;
        max_hp:=greatest(1,round(mhp)::int);current_hp:=coalesce((party_hp_json->>mem.id::text)::int,max_hp);current_hp:=least(max_hp,greatest(0,current_hp));party_hp_json:=jsonb_set(party_hp_json,array[mem.id::text],to_jsonb(current_hp),true);party_max_json:=jsonb_set(party_max_json,array[mem.id::text],to_jsonb(max_hp),true);attack_counts:=jsonb_set(attack_counts,array[mem.id::text],'0'::jsonb,true);if current_hp>0 then party_spd:=party_spd+mspd;living_n:=living_n+1;end if;
      end loop;
      party_spd:=party_spd/greatest(1,living_n);
      group_hp_scale:=0.8+0.35*(greatest(1,living_n)-1);group_atk_scale:=0.9+0.20*(greatest(1,living_n)-1);
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
        left join lateral (select sum(d.atk*(1+coalesce(q.enhance_level,0)*0.08)) eq_atk,sum(d.def*(1+coalesce(q.enhance_level,0)*0.08)) eq_def,sum(d.hp*(1+coalesce(q.enhance_level,0)*0.08)) eq_hp,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.crit*(1+coalesce(q.enhance_level,0)*0.08)) eq_crit,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade,sum(d.human_damage*(1+coalesce(q.enhance_level,0)*0.08)) human_damage from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
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
        /* living-party-xp-v01320 */ select count(*) into living_n from public.game_expedition_members em where em.expedition_id=e.id and coalesce((party_hp_json->>em.monster_id::text)::int,0)>0;xp_each:=greatest(1,ceil((e.xp_per_kill*(case when is_boss then 5 else 1 end)*(1+0.10*greatest(0,greatest(1,living_n)-1)))::numeric/greatest(1,living_n))::int);
        for mem in select m.id,m.trait from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id and coalesce((party_hp_json->>m.id::text)::int,0)>0 loop xp_amt:=case when mem.trait='학습 본능' then round(xp_each*1.12)::int else xp_each end;perform public.game_apply_xp(mem.id,xp_amt);update public.game_monsters set kills=kills+1 where id=mem.id;end loop;
        update public.game_expeditions set kills=kills+1 where id=e.id;
        select greatest(coalesce(max(case when m.personality='약탈광' then 0.20 else 0 end),0),coalesce(max(case when m.trait='수집광' then 0.15 else 0 end),0)) into party_loot from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id;
        for loot_row in select value from jsonb_array_elements(e.loot) where coalesce(value->>'source','kill')='kill' and coalesce(value->>'enemy','*') in ('*',enemy) loop chance:=least(0.95,coalesce((loot_row->>'chance')::numeric,0)*(1+party_loot));if random()<chance then qty:=floor(random()*(coalesce((loot_row->>'max')::int,1)-coalesce((loot_row->>'min')::int,1)+1))::int+coalesce((loot_row->>'min')::int,1);perform public.game_add_pending_loot(e.id,loot_row->>'id',qty);loot_gained:=loot_gained+qty;end if;end loop;
        event_text:=case when is_boss then enemy||' 보스 박멸 완료' else enemy||' 박멸 완료' end;
        newstate:=bs||jsonb_build_object('active',false,'result','win','enemyHp',0,'partyHp',party_hp_json,'partyMaxHp',party_max_json,'turn',null,'damageDealt',dealt_total,'healingDone',heal_total,'crits',crits,'skills',skill_events,'lastAction',last_action,'loot',loot_gained);
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
      left join lateral (select sum(d.def*(1+coalesce(q.enhance_level,0)*0.08)) eq_def,sum(d.spd*(1+coalesce(q.enhance_level,0)*0.08)) eq_spd,sum(d.evade*(1+coalesce(q.enhance_level,0)*0.08)) eq_evade from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
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
        if is_boss then
          update public.game_stage_progress
          set boss_attempts=boss_attempts+1,normal_wins=0,boss_ready=false,updated_at=now()
          where player_id=e.player_id and site_id=e.site_id;
          event_text:=enemy||'에게 보스전 패배 · 진행도 0/500부터 재시작';
        else
          event_text:=enemy||'에게 전투 패배';
        end if;
        newstate:=bs||jsonb_build_object('active',false,'result','loss','partyHp',party_hp_json,'turn',null,'round',round_i,'damageTaken',taken_total,'dodges',dodges,'enemyCrits',enemy_crits,'skills','[]'::jsonb,'lastAction',last_action);
        log_entry:=jsonb_build_object('t',now(),'type','battle-end','phase','전투','side','enemy','round',round_i,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','loss','damage',dmg,'damageDealt',dealt_total,'damageTaken',taken_total,'deaths',death_events,'partyHp',party_hp_json,'partyMaxHp',party_max_json);
        update public.game_expeditions set active=false,phase='전멸 · 복귀',event_state=jsonb_build_object('type','battle_end','text',event_text,'enemy',enemy,'enemyRole',enemy_role,'boss',is_boss,'result','loss','deaths',death_events,'t',now()),battle_state=newstate,updated_at=now() where id=e.id;
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
$function$
