create or replace function public.game_site_loot_capacity(p_player uuid, p_site text)
returns integer
language sql
stable
set search_path to 'public'
as $function$
  select least(
    9000,
    3000 + greatest(
      0,
      (select count(*)::integer
       from public.game_expeditions ge
       where ge.player_id=p_player
         and ge.site_id=p_site
         and ge.active=true) - 1
    ) * 1500
  );
$function$;

create or replace function public.game_add_pending_loot(p_expedition uuid, p_item text, p_qty integer)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  cur bigint;
  owner_id uuid;
  site text;
  site_total bigint;
  site_cap integer;
  add_qty bigint;
begin
  select player_id,site_id into owner_id,site
  from public.game_expeditions
  where id=p_expedition;
  if owner_id is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||site,0));

  select public.game_site_loot_capacity(owner_id,site) into site_cap;

  select coalesce(sum(j.value::bigint),0) into site_total
  from public.game_expeditions ge
  cross join lateral jsonb_each_text(coalesce(ge.pending_loot,'{}'::jsonb)) j(key,value)
  where ge.player_id=owner_id and ge.site_id=site;

  add_qty:=least(
    greatest(0,coalesce(p_qty,0))::bigint,
    greatest(0,site_cap-site_total)
  );
  if add_qty<=0 then return; end if;

  select coalesce((pending_loot->>p_item)::bigint,0) into cur
  from public.game_expeditions
  where id=p_expedition
  for update;

  update public.game_expeditions
  set pending_loot=jsonb_set(
        coalesce(pending_loot,'{}'::jsonb),
        array[p_item],
        to_jsonb(cur+add_qty),
        true
      ),
      updated_at=now()
  where id=p_expedition;
end
$function$;

create or replace function public.game_evolve_monster(p_player uuid, p_monster uuid, p_evolution text)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  m public.game_monsters%rowtype;
  evo public.game_evolution_defs%rowtype;
begin
  select * into m
  from public.game_monsters
  where id=p_monster and player_id=p_player
  for update;
  if m.id is null then raise exception 'monster_missing'; end if;

  if exists(
    select 1
    from public.game_expedition_members em
    join public.game_expeditions ge on ge.id=em.expedition_id
    where em.monster_id=m.id and ge.active=true
  ) then
    raise exception 'monster_busy';
  end if;

  select * into evo
  from public.game_evolution_defs
  where id=p_evolution
    and base_family=m.family
    and from_form_id=m.form_id;
  if evo.id is null then raise exception 'evolution_invalid'; end if;
  if m.level<evo.required_level then raise exception 'evolution_level'; end if;

  update public.game_monsters set
    form_id=evo.target_form_id,
    evolution_tier=evo.tier,
    skill_id=evo.skill_id,
    name=evo.target_name,
    hp_base=greatest(1,round(m.hp_base*evo.hp_mult)),
    atk_base=greatest(1,round(m.atk_base*evo.atk_mult)),
    def_base=greatest(0,round(m.def_base*evo.def_mult)),
    spd_base=greatest(1,round(m.spd_base*evo.spd_mult)),
    power_base=greatest(1,round(m.power_base*evo.power_mult)),
    crit_base=least(0.45,m.crit_base+evo.crit_add),
    evade_base=least(0.35,m.evade_base+evo.evade_add),
    evolved_at=now()
  where id=m.id;

  return jsonb_build_object(
    'formId',evo.target_form_id,
    'formName',evo.target_name,
    'tier',evo.tier,
    'skillId',evo.skill_id,
    'levelPreserved',m.level
  );
end
$function$;

do $patch$
declare
  fn text;
  old_line text := 'xp_each:=greatest(1,floor((e.xp_per_kill*(case when is_boss then 5 else 1 end))::numeric/party_n)::int);';
  new_line text := 'xp_each:=greatest(1,ceil((e.xp_per_kill*(case when is_boss then 5 else 1 end)*(1+0.10*greatest(0,party_n-1)))::numeric/party_n)::int);';
begin
  fn:=pg_get_functiondef('public.game_process_expedition_action(uuid)'::regprocedure);
  if position(old_line in fn)=0 then
    raise exception 'xp_formula_anchor_missing';
  end if;
  fn:=replace(fn,old_line,new_line);
  execute fn;
end
$patch$;
