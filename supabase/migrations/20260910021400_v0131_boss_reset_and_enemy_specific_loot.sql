-- v0.13.1: boss wipe resets chapter progress; ground loot is low-value only; farming drops are enemy-specific.
update public.game_hunt_sites set loot='[
 {"id":"나무 조각","min":1,"max":1,"chance":0.45,"source":"scavenge"},
 {"id":"거친 천","min":1,"max":1,"chance":0.30,"source":"scavenge"},
 {"id":"낡은 동전","min":1,"max":1,"chance":0.25,"source":"scavenge"},
 {"id":"낡은 동전","min":1,"max":2,"chance":0.25,"source":"kill","enemy":"산골 청년"},
 {"id":"거친 천","min":1,"max":2,"chance":0.35,"source":"kill","enemy":"산골 청년"},
 {"id":"나무 조각","min":1,"max":3,"chance":0.65,"source":"kill","enemy":"나무꾼"},
 {"id":"나무 몽둥이","min":1,"max":1,"chance":0.006,"source":"kill","enemy":"나무꾼"},
 {"id":"마른 약초","min":1,"max":2,"chance":0.45,"source":"kill","enemy":"마을 사냥꾼"},
 {"id":"돌부적","min":1,"max":1,"chance":0.002,"source":"kill","enemy":"마을 사냥꾼"},
 {"id":"거친 천","min":1,"max":2,"chance":0.35,"source":"kill","enemy":"자경대장"},
 {"id":"누더기 조끼","min":1,"max":1,"chance":0.004,"source":"kill","enemy":"자경대장"},
 {"id":"돌부적","min":1,"max":1,"chance":0.012,"source":"kill","enemy":"자경단장 베르크"},
 {"id":"누더기 조끼","min":1,"max":1,"chance":0.015,"source":"kill","enemy":"자경단장 베르크"}
]'::jsonb where id='mountain_village';

update public.game_hunt_sites set loot='[
 {"id":"마대 천","min":1,"max":1,"chance":0.45,"source":"scavenge"},
 {"id":"가죽 조각","min":1,"max":1,"chance":0.35,"source":"scavenge"},
 {"id":"은화 주머니","min":1,"max":1,"chance":0.20,"source":"scavenge"},
 {"id":"마대 천","min":1,"max":2,"chance":0.48,"source":"kill","enemy":"농부"},
 {"id":"농부의 낫","min":1,"max":1,"chance":0.006,"source":"kill","enemy":"농부"},
 {"id":"은화 주머니","min":1,"max":1,"chance":0.38,"source":"kill","enemy":"짐꾼"},
 {"id":"가죽 조각","min":1,"max":2,"chance":0.28,"source":"kill","enemy":"짐꾼"},
 {"id":"가죽 조각","min":1,"max":2,"chance":0.55,"source":"kill","enemy":"행상인 호위"},
 {"id":"가죽 조끼","min":1,"max":1,"chance":0.004,"source":"kill","enemy":"행상인 호위"},
 {"id":"가죽 조각","min":1,"max":2,"chance":0.60,"source":"kill","enemy":"마을 경비병"},
 {"id":"가죽 조끼","min":1,"max":1,"chance":0.005,"source":"kill","enemy":"마을 경비병"},
 {"id":"사냥꾼 부적","min":1,"max":1,"chance":0.010,"source":"kill","enemy":"용병대장 브란"},
 {"id":"가죽 조끼","min":1,"max":1,"chance":0.015,"source":"kill","enemy":"용병대장 브란"}
]'::jsonb where id='farm_road';

update public.game_hunt_sites set loot='[
 {"id":"철편","min":1,"max":1,"chance":0.50,"source":"scavenge"},
 {"id":"왕국 동전","min":1,"max":1,"chance":0.30,"source":"scavenge"},
 {"id":"단단한 가죽","min":1,"max":1,"chance":0.20,"source":"scavenge"},
 {"id":"왕국 동전","min":1,"max":1,"chance":0.38,"source":"kill","enemy":"신참 병사"},
 {"id":"병사의 검","min":1,"max":1,"chance":0.005,"source":"kill","enemy":"신참 병사"},
 {"id":"철편","min":1,"max":2,"chance":0.58,"source":"kill","enemy":"석궁병"},
 {"id":"병사의 검","min":1,"max":1,"chance":0.003,"source":"kill","enemy":"석궁병"},
 {"id":"단단한 가죽","min":1,"max":2,"chance":0.38,"source":"kill","enemy":"초소 경비대"},
 {"id":"경비병 철갑","min":1,"max":1,"chance":0.004,"source":"kill","enemy":"초소 경비대"},
 {"id":"왕국 문양 조각","min":1,"max":1,"chance":0.32,"source":"kill","enemy":"하급 기사"},
 {"id":"왕국 훈장","min":1,"max":1,"chance":0.0015,"source":"kill","enemy":"하급 기사"},
 {"id":"왕국 문양 조각","min":1,"max":2,"chance":0.75,"source":"kill","enemy":"왕국 기사단 부관"},
 {"id":"병사의 검","min":1,"max":1,"chance":0.018,"source":"kill","enemy":"왕국 기사단 부관"},
 {"id":"경비병 철갑","min":1,"max":1,"chance":0.012,"source":"kill","enemy":"왕국 기사단 부관"},
 {"id":"왕국 훈장","min":1,"max":1,"chance":0.012,"source":"kill","enemy":"왕국 기사단 부관"}
]'::jsonb where id='border_outpost';

do $body$
declare src text;
begin
  select pg_get_functiondef('public.game_process_expedition_action(uuid)'::regprocedure) into src;
  if position($old$where exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;$old$ in src)=0 then raise exception 'v0131_patch_missing_scavenge_selector'; end if;
  src:=replace(src,$old$where exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;$old$,$new$where coalesce(l.value->>'source','kill')='scavenge' and exists(select 1 from public.game_item_defs d where d.id=l.value->>'id' and d.kind='material') order by random() limit 1;$new$);
  if position($old$if random()<least(0.80,0.30+coalesce(search_bonus,0)) then$old$ in src)=0 then raise exception 'v0131_patch_missing_search_rate'; end if;
  src:=replace(src,$old$if random()<least(0.80,0.30+coalesce(search_bonus,0)) then$old$,$new$if random()<least(0.35,0.10+coalesce(search_bonus,0)*0.50) then$new$);
  src:=replace(src,$old$if loot_row is not null and random()<0.58 then$old$,$new$if loot_row is not null and random()<0.18 then$new$);
  src:=replace(src,$old$qty:=1+case when random()<0.12 then 1 else 0 end;$old$,$new$qty:=1;$new$);
  if position($old$for loot_row in select value from jsonb_array_elements(e.loot) loop$old$ in src)=0 then raise exception 'v0131_patch_missing_kill_loop'; end if;
  src:=replace(src,$old$for loot_row in select value from jsonb_array_elements(e.loot) loop$old$,$new$for loot_row in select value from jsonb_array_elements(e.loot) where coalesce(value->>'source','kill')='kill' and coalesce(value->>'enemy','*') in ('*',enemy) loop$new$);
  src:=replace(src,$old$chance:=least(0.95,coalesce((loot_row->>'chance')::numeric,0)*(1+party_loot)*(case when is_boss then 3 else 1 end));$old$,$new$chance:=least(0.95,coalesce((loot_row->>'chance')::numeric,0)*(1+party_loot));$new$);
  if position($old$if is_boss then update public.game_stage_progress set boss_attempts=boss_attempts+1,updated_at=now() where player_id=e.player_id and site_id=e.site_id;end if;
        event_text:=enemy||'에게 전투 패배';$old$ in src)=0 then raise exception 'v0131_patch_missing_boss_loss'; end if;
  src:=replace(src,$old$if is_boss then update public.game_stage_progress set boss_attempts=boss_attempts+1,updated_at=now() where player_id=e.player_id and site_id=e.site_id;end if;
        event_text:=enemy||'에게 전투 패배';$old$,$new$if is_boss then
          update public.game_stage_progress set boss_attempts=boss_attempts+1,normal_wins=0,boss_ready=false,updated_at=now() where player_id=e.player_id and site_id=e.site_id;
          event_text:=enemy||'에게 보스전 패배 · 진행도 0/500부터 재시작';
        else
          event_text:=enemy||'에게 전투 패배';
        end if;$new$);
  src:=replace(src,$old$update public.game_expeditions set phase='휴식',event_state=$old$,$new$update public.game_expeditions set phase=case when is_boss then '재도전 준비' else '재정비' end,event_state=$new$);
  execute src;
end
$body$;