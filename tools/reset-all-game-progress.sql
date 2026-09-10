-- One-time operator action requested by the owner. Login accounts/PINs remain.
-- Never include this script in migrations or normal application startup.
begin;
select pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
lock table public.game_players in access exclusive mode;
create temporary table reset_game_owner_ids on commit drop as
select device_id from public.game_players union select user_id from public.game_accounts;
-- This older table has no player FK and therefore needs explicit cleanup.
delete from public.game_enhanced_inventory;
delete from public.game_players;
do $$declare owner_row record;begin
 for owner_row in select device_id from reset_game_owner_ids loop
  perform public.game_initialize_company(owner_row.device_id);
 end loop;
end $$;
commit;
