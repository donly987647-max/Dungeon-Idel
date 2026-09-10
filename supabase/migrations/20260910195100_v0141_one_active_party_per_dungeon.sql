-- v0.14.1: a dungeon can have only one active expedition for each player.
with ranked as (
  select id,row_number() over(partition by player_id,site_id order by started_at desc,id desc) rn
  from public.game_expeditions
  where active=true
)
update public.game_expeditions e
set active=false,
    phase='파티 재편 대기',
    event_state=jsonb_build_object('type','party_rule','text','던전당 1개 파티 규칙 적용 · 이전 파티 종료','t',now()),
    updated_at=now()
from ranked r
where e.id=r.id and r.rn>1;

create unique index if not exists game_one_active_expedition_per_site
on public.game_expeditions(player_id,site_id)
where active=true;
