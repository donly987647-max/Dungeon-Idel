-- Campaign progression extends existing records; never reset a player's clears.
-- v0.15 writes contextual text including actual recovery and loot. The old
-- presentation trigger overwrote it with generic strings and removed those facts.
drop trigger if exists trg_game_chapter_event_text on public.game_expeditions;
alter table public.game_stage_progress add column if not exists normal_battles bigint not null default 0;
alter table public.game_stage_progress add column if not exists boss_victories bigint not null default 0;
alter table public.game_stage_progress add column if not exists first_boss_cleared_at timestamptz;
alter table public.game_stage_progress add column if not exists last_boss_attempt_at timestamptz;
alter table public.game_stage_progress add column if not exists boss_last_result text;
alter table public.game_stage_progress add column if not exists boss_history jsonb not null default '[]'::jsonb;
update public.game_stage_progress set boss_victories=greatest(1,boss_victories),
  first_boss_cleared_at=coalesce(first_boss_cleared_at,boss_cleared_at)
where boss_cleared;
-- Old wins are confirmed completed battles. Historical losses were not counted
-- separately, so do not invent them. Previously unlocked/cleared bosses stay open.
update public.game_stage_progress set normal_battles=greatest(normal_battles,normal_wins),
  boss_ready=boss_ready or boss_cleared or normal_wins>=500;

create or replace function public.game_boss_encounter_roll(p_unlocked boolean,p_chance numeric default 0.015)
returns boolean language sql volatile set search_path=public as $$
  select coalesce(p_unlocked,false) and random()<greatest(0,least(0.02,coalesce(p_chance,0.015)))
$$;

create or replace function public.game_roll_ground_item(p_loot jsonb)
returns jsonb language plpgsql volatile set search_path=public as $$
declare row jsonb; total numeric; cursor numeric:=0; roll numeric;
begin
  select coalesce(sum((value->>'chance')::numeric),0) into total
  from jsonb_array_elements(p_loot) where value->>'source'='scavenge';
  if total<=0 then return null; end if;
  roll:=random()*total;
  for row in select value from jsonb_array_elements(p_loot) where value->>'source'='scavenge' loop
    cursor:=cursor+coalesce((row->>'chance')::numeric,0);
    if roll<cursor then return row; end if;
  end loop;
  return null;
end $$;

-- Pure loot roll used by combat and probability tests. Legendary rows share one
-- weighted roll, so their displayed marginal probabilities are exact and at most
-- one legendary can drop per kill. Ordinary foes have no legendary rows.
create or replace function public.game_roll_campaign_drops(p_loot jsonb,p_enemy text,p_bonus numeric default 0)
returns jsonb language plpgsql volatile set search_path=public as $$
declare row jsonb; result jsonb:='{}'; quantity int; probability numeric;
  bonus numeric:=1+greatest(0,least(0.20,coalesce(p_bonus,0)));
  legend_roll numeric:=random(); legend_cumulative numeric:=0;
begin
  for row in select value from jsonb_array_elements(p_loot)
    where value->>'source'='kill' and value->>'enemy' in ('*',p_enemy)
  loop
    probability:=least(0.95,greatest(0,(row->>'chance')::numeric)*bonus);
    if row->>'pool'='legendary' then
      legend_cumulative:=legend_cumulative+probability;
      if legend_roll>=legend_cumulative or legend_roll<legend_cumulative-probability then continue; end if;
    elsif random()>=probability then continue;
    end if;
    quantity:=coalesce((row->>'min')::int,1)+floor(random()*(coalesce((row->>'max')::int,1)-coalesce((row->>'min')::int,1)+1))::int;
    result:=jsonb_set(result,array[row->>'id'],to_jsonb(coalesce((result->>(row->>'id'))::int,0)+quantity));
  end loop;
  return result;
end $$;

-- Rare finds use the equipment case, separate from bulk material cargo. They
-- remain pending until collection; a full warehouse never deletes them.
create or replace function public.game_add_pending_loot(p_expedition uuid,p_item text,p_qty integer)
returns void language plpgsql set search_path=public as $$
declare owner_id uuid; site text; kind text; site_total bigint; add_qty bigint; cur bigint;
begin
  select player_id,site_id into owner_id,site from public.game_expeditions where id=p_expedition;
  if owner_id is null then return; end if;
  select d.kind into kind from public.game_item_defs d where d.id=p_item;
  if kind is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||site,0));
  add_qty:=greatest(0,coalesce(p_qty,0));
  if kind<>'equipment' then
    select coalesce(sum(j.value::bigint),0) into site_total
    from public.game_expeditions ge
    cross join lateral jsonb_each_text(coalesce(ge.pending_loot,'{}'::jsonb)) j(key,value)
    left join public.game_item_defs d on d.id=j.key
    where ge.player_id=owner_id and ge.site_id=site and coalesce(d.kind,'material')<>'equipment';
    add_qty:=least(add_qty,greatest(0,public.game_site_loot_capacity(owner_id,site)-site_total));
  end if;
  if add_qty<=0 then return; end if;
  select coalesce((pending_loot->>p_item)::bigint,0) into cur from public.game_expeditions where id=p_expedition for update;
  update public.game_expeditions set pending_loot=jsonb_set(coalesce(pending_loot,'{}'::jsonb),array[p_item],to_jsonb(cur+add_qty),true),updated_at=now() where id=p_expedition;
end $$;

create or replace function public.game_award_campaign_drops(p_expedition uuid,p_drops jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare row record; before_loot jsonb; after_loot jsonb; result jsonb:='{}'; actual int;
begin
  select pending_loot into before_loot from public.game_expeditions where id=p_expedition for update;
  for row in select key,value from jsonb_each_text(p_drops) loop
    perform public.game_add_pending_loot(p_expedition,row.key,row.value::int);
  end loop;
  select pending_loot into after_loot from public.game_expeditions where id=p_expedition;
  for row in select key,value from jsonb_each_text(p_drops) loop
    actual:=coalesce((after_loot->>row.key)::int,0)-coalesce((before_loot->>row.key)::int,0);
    if actual>0 then result:=jsonb_set(result,array[row.key],to_jsonb(actual)); end if;
  end loop;
  return result;
end $$;

revoke all on function public.game_roll_ground_item(jsonb) from public,anon,authenticated;
revoke all on function public.game_add_pending_loot(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.game_add_pending_loot(uuid,text,integer) to service_role;
revoke all on function public.game_roll_campaign_drops(jsonb,text,numeric) from public,anon,authenticated;
revoke all on function public.game_award_campaign_drops(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.game_boss_encounter_roll(boolean,numeric) from public,anon,authenticated;
grant execute on function public.game_roll_ground_item(jsonb),public.game_roll_campaign_drops(jsonb,text,numeric),public.game_award_campaign_drops(uuid,jsonb) to service_role;
grant execute on function public.game_boss_encounter_roll(boolean,numeric) to service_role;
