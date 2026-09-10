-- Persist the final party-turn healing when a killing blow ends the encounter.
DO $patch$
DECLARE src text; before text := '''result'',''win'',''enemyHp'',0,''turn'',null'; after text := '''result'',''win'',''enemyHp'',0,''partyHp'',party_hp_json,''partyMaxHp'',party_max_json,''turn'',null';
BEGIN
 src := pg_get_functiondef('public.game_process_expedition_action(uuid)'::regprocedure);
 IF strpos(src,before)=0 THEN RAISE EXCEPTION 'victory_hp_patch_source_mismatch'; END IF;
 EXECUTE replace(src,before,after);
END $patch$;

-- Authenticated atomic replacement: never recall successfully and then fail to deploy.
CREATE OR REPLACE FUNCTION public.game_restart_expedition(p_expedition uuid, p_monsters uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 uid uuid := auth.uid(); old public.game_expeditions%rowtype; fresh public.game_expeditions%rowtype;
 count_ids integer; valid_ids integer; new_members jsonb; previous_members uuid[];
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 count_ids := coalesce(cardinality(p_monsters),0);
 IF count_ids < 1 OR count_ids > 4 OR (SELECT count(DISTINCT x) FROM unnest(p_monsters) x) <> count_ids THEN RAISE EXCEPTION 'party_size'; END IF;
 -- Same order as cron: global tick lock, then rows. No network work inside this lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
 SELECT * INTO old FROM public.game_expeditions WHERE id=p_expedition AND player_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_target'; END IF;
 IF NOT old.active THEN RAISE EXCEPTION 'expedition_changed'; END IF;
 PERFORM 1 FROM public.game_monsters WHERE player_id=uid AND id=ANY(p_monsters) ORDER BY id FOR UPDATE;
 SELECT count(*) INTO valid_ids FROM public.game_monsters WHERE player_id=uid AND id=ANY(p_monsters) AND released_at IS NULL;
 IF valid_ids <> count_ids THEN RAISE EXCEPTION 'monster_missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.game_expeditions e JOIN public.game_expedition_members m ON m.expedition_id=e.id WHERE e.active AND e.id<>old.id AND m.monster_id=ANY(p_monsters)) THEN RAISE EXCEPTION 'monster_busy'; END IF;
 SELECT array_agg(monster_id ORDER BY position) INTO previous_members FROM public.game_expedition_members WHERE expedition_id=old.id;
 IF previous_members = p_monsters THEN RAISE EXCEPTION 'party_unchanged'; END IF;
 UPDATE public.game_expeditions SET active=false,phase='파티 재편 · 복귀',battle_state=battle_state||jsonb_build_object('active',false,'result','cancelled','turn',null),event_state=jsonb_build_object('type','reconfigure','text','파티 재편으로 현재 전투를 취소했습니다','t',now()),updated_at=now() WHERE id=old.id;
 INSERT INTO public.game_expeditions(player_id,monster_id,site_id,active,phase,event_state)
 VALUES(uid,p_monsters[1],old.site_id,true,'탐색',jsonb_build_object('type','deploy','text',count_ids||'인 박멸조 재편 · 탐험 재시작','t',now())) RETURNING * INTO fresh;
 INSERT INTO public.game_expedition_members(expedition_id,player_id,monster_id,position)
 SELECT fresh.id,uid,v.id,v.ord::integer FROM unnest(p_monsters) WITH ORDINALITY v(id,ord);
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY position),'[]'::jsonb) INTO new_members FROM public.game_expedition_members m WHERE expedition_id=fresh.id;
 RETURN jsonb_build_object('expeditionId',fresh.id,'previousExpeditionId',old.id,'expedition',to_jsonb(fresh),'members',new_members);
END $fn$;
REVOKE ALL ON FUNCTION public.game_restart_expedition(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.game_restart_expedition(uuid,uuid[]) TO authenticated;
