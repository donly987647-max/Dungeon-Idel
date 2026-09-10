-- One authenticated server snapshot instead of 11/17 HTTP reads per response.
-- No browser role can choose a player ID; the Edge Function supplies the verified user.
create or replace function public.game_client_state(p_player uuid, p_static boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb; defense_state jsonb;
begin
  if not exists(select 1 from public.game_players where device_id=p_player) then
    raise exception 'player_missing';
  end if;
  perform public.game_tick_all();
  defense_state := public.game_defense_snapshot(p_player);
  select jsonb_build_object(
    'player', (select to_jsonb(t) from (select * from public.game_players where device_id=p_player) t),
    'monsters', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_monsters where player_id=p_player and released_at is null order by created_at) t),
    'candidates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_candidates where player_id=p_player order by created_at) t),
    'expeditions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_expeditions where player_id=p_player order by started_at desc) t),
    'inventory', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_inventory where player_id=p_player order by item_id) t),
    'equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_monster_equipment where player_id=p_player order by equipped_at) t),
    'expeditionMembers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_expedition_members where player_id=p_player order by position) t),
    'stageProgress', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_stage_progress where player_id=p_player) t),
    'craftJobs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_craft_jobs where player_id=p_player order by started_at desc limit 30) t),
    'sellJobs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_sell_jobs where player_id=p_player order by started_at desc limit 30) t),
    'defense',defense_state,
    'serverNow',clock_timestamp()
  ) into result;
  if p_static then
    result := result || jsonb_build_object(
    'account', (select to_jsonb(t) from (select username,created_at,last_login_at from public.game_accounts where user_id=p_player) t),
    'sites', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_hunt_sites order by unlock_order) t),
    'itemDefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_item_defs order by id) t),
    'recipes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_recipes order by sort_order) t),
    'evolutionDefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_evolution_defs order by tier,target_name) t),
    'skillDefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select * from public.game_skill_defs order by name) t)
    );
  end if;
  return result;
end;
$$;
revoke all on function public.game_client_state(uuid,boolean) from public,anon,authenticated;
grant execute on function public.game_client_state(uuid,boolean) to service_role;
create index if not exists game_expedition_members_player_idx on public.game_expedition_members(player_id);
