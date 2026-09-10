-- v0.14.1: expedition HP persists across encounters; recovery happens during exploration.
create or replace function public.game_expedition_hp_ratio(p_state jsonb)
returns numeric
language plpgsql
immutable
set search_path to 'public'
as $$
declare hp jsonb:=coalesce(p_state->'partyHp','{}'::jsonb);mx jsonb:=coalesce(p_state->'partyMaxHp','{}'::jsonb);k text;v text;cur_hp int;max_hp int;alive_n int:=0;ratio_sum numeric:=0;
begin
 if jsonb_typeof(hp)<>'object' or jsonb_typeof(mx)<>'object' then return 1;end if;
 for k,v in select key,value from jsonb_each_text(mx) loop max_hp:=greatest(1,v::int);cur_hp:=coalesce((hp->>k)::int,max_hp);if cur_hp>0 then alive_n:=alive_n+1;ratio_sum:=ratio_sum+least(1,cur_hp::numeric/max_hp);end if;end loop;
 if alive_n=0 then return 1;end if;return greatest(0,least(1,ratio_sum/alive_n));
end $$;

create or replace function public.game_roll_exploration_recovery(p_expedition uuid,p_state jsonb)
returns jsonb language plpgsql set search_path to 'public'
as $$
declare st jsonb:=coalesce(p_state,'{}'::jsonb);hp jsonb:=coalesce(st->'partyHp','{}'::jsonb);mx jsonb:=coalesce(st->'partyMaxHp','{}'::jsonb);k text;v text;cur_hp int;max_hp int;add_hp int;total_heal int:=0;alive_n int:=0;damaged_n int:=0;avg_ratio numeric:=1;ratio_sum numeric:=0;recover_chance numeric:=0;roll numeric;mode text:='none';msg text:='';target_key text;target_ratio numeric:=2;
begin
 if jsonb_typeof(hp)<>'object' or jsonb_typeof(mx)<>'object' then return jsonb_build_object('state',st,'heal',0,'kind','none','text','');end if;
 for k,v in select key,value from jsonb_each_text(mx) loop max_hp:=greatest(1,v::int);cur_hp:=coalesce((hp->>k)::int,max_hp);if cur_hp>0 then alive_n:=alive_n+1;ratio_sum:=ratio_sum+least(1,cur_hp::numeric/max_hp);if cur_hp<max_hp then damaged_n:=damaged_n+1;end if;end if;end loop;
 if alive_n=0 or damaged_n=0 then return jsonb_build_object('state',st,'heal',0,'kind','none','text','');end if;
 avg_ratio:=ratio_sum/alive_n;recover_chance:=case when avg_ratio<0.35 then 0.90 when avg_ratio<0.60 then 0.72 else 0.50 end;
 if random()>=recover_chance then return jsonb_build_object('state',st,'heal',0,'kind','none','text','');end if;
 roll:=random();
 if roll<0.25 then mode:='well';for k,v in select key,value from jsonb_each_text(mx) loop max_hp:=greatest(1,v::int);cur_hp:=coalesce((hp->>k)::int,max_hp);if cur_hp>0 and cur_hp<max_hp then add_hp:=least(max_hp-cur_hp,greatest(1,round(max_hp*0.42)::int));hp:=jsonb_set(hp,array[k],to_jsonb(cur_hp+add_hp),true);total_heal:=total_heal+add_hp;end if;end loop;msg:='낡은 우물을 발견해 물을 마셨다 · 체력 +'||total_heal;
 elsif roll<0.65 then mode:='potion';target_key:=null;target_ratio:=2;for k,v in select key,value from jsonb_each_text(mx) loop max_hp:=greatest(1,v::int);cur_hp:=coalesce((hp->>k)::int,max_hp);if cur_hp>0 and cur_hp<max_hp and cur_hp::numeric/max_hp<target_ratio then target_ratio:=cur_hp::numeric/max_hp;target_key:=k;end if;end loop;if target_key is not null then max_hp:=greatest(1,(mx->>target_key)::int);cur_hp:=coalesce((hp->>target_key)::int,max_hp);add_hp:=least(max_hp-cur_hp,greatest(1,round(max_hp*0.58)::int));hp:=jsonb_set(hp,array[target_key],to_jsonb(cur_hp+add_hp),true);total_heal:=add_hp;msg:='용사에게서 빼앗은 회복약을 사용했다 · 체력 +'||total_heal;end if;
 else mode:='camp';for k,v in select key,value from jsonb_each_text(mx) loop max_hp:=greatest(1,v::int);cur_hp:=coalesce((hp->>k)::int,max_hp);if cur_hp>0 and cur_hp<max_hp then add_hp:=least(max_hp-cur_hp,greatest(1,round(max_hp*0.22)::int));hp:=jsonb_set(hp,array[k],to_jsonb(cur_hp+add_hp),true);total_heal:=total_heal+add_hp;end if;end loop;msg:='버려진 야영지에서 약초와 식량을 챙겼다 · 체력 +'||total_heal;end if;
 st:=st||jsonb_build_object('active',false,'partyHp',hp,'partyMaxHp',mx,'recovery',jsonb_build_object('kind',mode,'heal',total_heal,'t',now()));return jsonb_build_object('state',st,'heal',total_heal,'kind',mode,'text',msg);
end $$;

do $do$
declare src text;before text;
begin
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='game_process_expedition_action' limit 1;
 if src is null then raise exception 'game_process_expedition_action_missing';end if;if position('recovery_text text;' in src)>0 then return;end if;
 before:=src;src:=replace(src,$old$  loot_row jsonb;$old$,$new$  loot_row jsonb;
  recovery jsonb;
  recovery_text text;
  exp_hp_ratio numeric:=1;$new$);if src=before then raise exception 'patch_vars_failed';end if;
 before:=src;src:=replace(src,$old$  if not coalesce((bs->>'active')::boolean,false) then
    event_roll:=random();$old$,$new$  if not coalesce((bs->>'active')::boolean,false) then
    exp_hp_ratio:=public.game_expedition_hp_ratio(bs);
    event_roll:=random();
    if event_roll>=0.72 then
      if exp_hp_ratio<0.35 and random()<0.82 then event_roll:=0.60;
      elsif exp_hp_ratio<0.60 and random()<0.57 then event_roll:=0.60;
      end if;
    end if;$new$);if src=before then raise exception 'patch_encounter_rate_failed';end if;
 before:=src;src:=replace(src,$old$log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'partyCount',party_n);$old$,$new$recovery:=public.game_roll_exploration_recovery(e.id,bs);bs:=coalesce(recovery->'state',bs);recovery_text:=coalesce(recovery->>'text','');if recovery_text<>'' then event_text:=event_text||' · '||recovery_text;end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'loot',loot_gained,'recovery',coalesce(recovery,'{}'::jsonb)-'state','partyCount',party_n);$new$);if src=before then raise exception 'patch_recovery_loot_branches_failed';end if;
 before:=src;src:=replace(src,$old$log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'partyCount',party_n);$old$,$new$recovery:=public.game_roll_exploration_recovery(e.id,bs);bs:=coalesce(recovery->'state',bs);recovery_text:=coalesce(recovery->>'text','');if recovery_text<>'' then event_text:=event_text||' · '||recovery_text;end if;
      log_entry:=jsonb_build_object('t',now(),'type','explore','phase',phase_now,'event',event_text,'recovery',coalesce(recovery,'{}'::jsonb)-'state','partyCount',party_n);$new$);if src=before then raise exception 'patch_recovery_move_failed';end if;
 before:=src;src:=replace(src,$old$battle_state='{}'::jsonb$old$,$new$battle_state=bs$new$);if src=before then raise exception 'patch_persist_explore_hp_failed';end if;
 before:=src;src:=replace(src,$old$party_spd:=0;party_hp_json:='{}'::jsonb;party_max_json:='{}'::jsonb;attack_counts:='{}'::jsonb;$old$,$new$party_spd:=0;living_n:=0;party_hp_json:=coalesce(bs->'partyHp','{}'::jsonb);party_max_json:='{}'::jsonb;attack_counts:='{}'::jsonb;$new$);if src=before then raise exception 'patch_encounter_hp_seed_failed';end if;
 before:=src;src:=replace(src,$old$max_hp:=greatest(1,round(mhp)::int);party_hp_json:=jsonb_set(party_hp_json,array[mem.id::text],to_jsonb(max_hp),true);party_max_json:=jsonb_set(party_max_json,array[mem.id::text],to_jsonb(max_hp),true);attack_counts:=jsonb_set(attack_counts,array[mem.id::text],'0'::jsonb,true);party_spd:=party_spd+mspd;$old$,$new$max_hp:=greatest(1,round(mhp)::int);current_hp:=coalesce((party_hp_json->>mem.id::text)::int,max_hp);current_hp:=least(max_hp,greatest(0,current_hp));party_hp_json:=jsonb_set(party_hp_json,array[mem.id::text],to_jsonb(current_hp),true);party_max_json:=jsonb_set(party_max_json,array[mem.id::text],to_jsonb(max_hp),true);attack_counts:=jsonb_set(attack_counts,array[mem.id::text],'0'::jsonb,true);if current_hp>0 then party_spd:=party_spd+mspd;living_n:=living_n+1;end if;$new$);if src=before then raise exception 'patch_carry_hp_failed';end if;
 before:=src;src:=replace(src,$old$party_spd:=party_spd/greatest(1,party_n);$old$,$new$party_spd:=party_spd/greatest(1,living_n);$new$);src:=replace(src,$old$group_hp_scale:=0.8+0.35*(party_n-1);group_atk_scale:=0.9+0.20*(party_n-1);$old$,$new$group_hp_scale:=0.8+0.35*(greatest(1,living_n)-1);group_atk_scale:=0.9+0.20*(greatest(1,living_n)-1);$new$);if src=before then raise exception 'patch_living_scale_failed';end if;
 before:=src;src:=replace(src,$old$update public.game_expeditions set phase=case when is_boss then '재도전 준비' else '재정비' end,event_state=jsonb_build_object('type','battle_end'$old$,$new$update public.game_expeditions set active=false,phase='전멸 · 복귀',event_state=jsonb_build_object('type','battle_end'$new$);if src=before then raise exception 'patch_wipe_end_failed';end if;
 execute src;
end $do$;
