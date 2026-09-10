-- Keep v0.12.7 pixie/wisp/mimic data fully available in the schema,
-- but do not generate those candidates until the v0.12.7 client is deployed.
-- This avoids old v0.12.5 clients falling back to the slime sprite.
create or replace function public.game_spawn_candidates()
returns integer language plpgsql set search_path to 'public' as $$
declare p record;i int;r numeric;grade text;fam text;pers text;tr text;talent int;mult numeric;hp int;atk int;de int;spd int;cr numeric;ev numeric;pb int;made int:=0;batch_count int;locked_count int;new_count int;
begin
 for p in select * from public.game_players where next_candidate_at<=now() for update skip locked loop
  delete from public.game_candidates where player_id=p.device_id and not coalesce(is_locked,false);batch_count:=greatest(4,coalesce(p.tavern_level,1)+3);select count(*)::int into locked_count from public.game_candidates where player_id=p.device_id and coalesce(is_locked,false);new_count:=greatest(0,batch_count-locked_count);
  if new_count>0 then for i in 1..new_count loop
   r:=random();grade:=case when p.tavern_level<=1 then case when r<0.65 then 'C' when r<0.95 then 'B' else 'A' end when p.tavern_level=2 then case when r<0.45 then 'C' when r<0.85 then 'B' when r<0.99 then 'A' else 'S' end when p.tavern_level=3 then case when r<0.25 then 'C' when r<0.70 then 'B' when r<0.97 then 'A' else 'S' end when p.tavern_level=4 then case when r<0.10 then 'C' when r<0.50 then 'B' when r<0.93 then 'A' else 'S' end else case when r<0.35 then 'B' when r<0.85 then 'A' else 'S' end end;
   fam:=(array['slime','goblin','troll','mandrake','imp','golem'])[1+floor(random()*6)::int];pers:=(array['침착','약탈광','광전사','겁쟁이','인간혐오','야행성'])[1+floor(random()*6)::int];tr:=(array['질긴 가죽','야성','재빠름','수집광','학습 본능'])[1+floor(random()*5)::int];talent:=case grade when 'S' then 94+floor(random()*7)::int when 'A' then 88+floor(random()*10)::int when 'B' then 82+floor(random()*11)::int else 76+floor(random()*12)::int end;talent:=least(100,talent+greatest(0,p.tavern_level-1));mult:=case grade when 'S' then 1.16 when 'A' then 1.10 when 'B' then 1.05 else 1 end;
   if fam='slime' then hp:=round(145*mult);atk:=round(15*mult);de:=round(11*mult);spd:=round(9*mult);cr:=0.04;ev:=0.03;pb:=45;
   elsif fam='goblin' then hp:=round(100*mult);atk:=round(21*mult);de:=round(7*mult);spd:=round(14*mult);cr:=0.08;ev:=0.06;pb:=52;
   elsif fam='troll' then hp:=round(175*mult);atk:=round(24*mult);de:=round(13*mult);spd:=round(7*mult);cr:=0.05;ev:=0.02;pb:=68;
   elsif fam='mandrake' then hp:=round(125*mult);atk:=round(12*mult);de:=round(9*mult);spd:=round(10*mult);cr:=0.03;ev:=0.04;pb:=50;
   elsif fam='imp' then hp:=round(86*mult);atk:=round(22*mult);de:=round(5*mult);spd:=round(11*mult);cr:=0.06;ev:=0.04;pb:=54;
   else hp:=round(240*mult);atk:=round(13*mult);de:=round(21*mult);spd:=round(5*mult);cr:=0.02;ev:=0.01;pb:=63;end if;
   insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
   values(p.device_id,(array['꾸륵','찍찍','우르그','푸르','크룩','도르','무그','벨칵','루트','지직','둔석','모스'])[1+floor(random()*12)::int],fam,talent,tr,pb,pers,grade,hp,atk,de,spd,cr,ev,false);made:=made+1;
  end loop;end if;update public.game_players set next_candidate_at=now()+interval '4 hours',updated_at=now() where device_id=p.device_id;
 end loop;return made;
end $$;
