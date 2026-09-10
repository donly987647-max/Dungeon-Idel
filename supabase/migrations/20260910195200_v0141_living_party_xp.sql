-- v0.14.1: downed expedition members stop farming XP while the surviving party continues.
do $do$
declare src text;before text;
begin
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='game_process_expedition_action' limit 1;
 if src is null then raise exception 'game_process_expedition_action_missing';end if;if position('/* living-party-xp-v01320 */' in src)>0 then return;end if;
 before:=src;src:=replace(src,$old$xp_each:=greatest(1,ceil((e.xp_per_kill*(case when is_boss then 5 else 1 end)*(1+0.10*greatest(0,party_n-1)))::numeric/party_n)::int);$old$,$new$/* living-party-xp-v01320 */ select count(*) into living_n from public.game_expedition_members em where em.expedition_id=e.id and coalesce((party_hp_json->>em.monster_id::text)::int,0)>0;xp_each:=greatest(1,ceil((e.xp_per_kill*(case when is_boss then 5 else 1 end)*(1+0.10*greatest(0,greatest(1,living_n)-1)))::numeric/greatest(1,living_n))::int);$new$);if src=before then raise exception 'patch_living_xp_amount_failed';end if;
 before:=src;src:=replace(src,$old$for mem in select m.id,m.trait from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id loop$old$,$new$for mem in select m.id,m.trait from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id where em.expedition_id=e.id and coalesce((party_hp_json->>m.id::text)::int,0)>0 loop$new$);if src=before then raise exception 'patch_living_xp_loop_failed';end if;
 execute src;
end $do$;
