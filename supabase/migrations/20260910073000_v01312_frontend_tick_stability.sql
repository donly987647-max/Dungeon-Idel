create or replace function public.game_process_expeditions()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  e record;
  elapsed int;
  attempts int;
  i int;
  processed int:=0;
begin
  for e in
    select id,last_tick_at
    from public.game_expeditions
    where active=true
    for update skip locked
  loop
    elapsed:=floor(extract(epoch from(now()-e.last_tick_at)))::int;
    attempts:=least(20,greatest(0,floor(elapsed::numeric/2)::int));
    if attempts<=0 then continue;end if;
    for i in 1..attempts loop
      perform public.game_process_expedition_action(e.id);
    end loop;
    update public.game_expeditions
    set last_tick_at=last_tick_at+make_interval(secs=>attempts*2),updated_at=now()
    where id=e.id;
    processed:=processed+attempts;
  end loop;
  return processed;
end
$function$;

create or replace function public.game_tick_all()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare n integer:=0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('game_tick_all',0)) then
    return 0;
  end if;
  n:=n+public.game_process_economy();
  n:=n+public.game_spawn_candidates();
  n:=n+public.game_process_expeditions();
  return n;
end
$function$;
