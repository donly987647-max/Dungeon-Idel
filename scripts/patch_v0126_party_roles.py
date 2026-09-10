from pathlib import Path
import re

APP=Path('app.js')
CSS=Path('app.css')
IDX=Path('index.html')
SPR=Path('assets/characters.svg')
BASE=Path('supabase/migrations/20260909231346_turn_based_two_second_combat_v0124.sql')
MIG=Path('supabase/migrations/20260910001500_party_roles_v0126.sql')

s=APP.read_text()

old="const fam=k=>({slime:'슬라임',goblin:'고블린',troll:'트롤'}[k]||k);"
new="const fam=k=>({slime:'슬라임',goblin:'고블린',troll:'트롤',mandrake:'만드라고라',imp:'임프',golem:'골렘'}[k]||k);"
assert old in s
s=s.replace(old,new,1)

old="const roleOf=m=>m.family==='slime'?'완충 요원':m.family==='goblin'?'기습 요원':'중장 요원';"
new="""const roleOf=m=>({slime:'완충 요원',goblin:'물리 딜러',troll:'브루저',mandrake:'힐러',imp:'마법 딜러',golem:'탱커'}[m?.family]||'전투 요원');
const roleKey=m=>({mandrake:'healer',imp:'mage',golem:'tank',goblin:'dps',troll:'bruiser',slime:'buffer'}[m?.family]||'fighter');
const roleMeta=m=>({
  mandrake:{key:'healer',title:'힐러',summary:'낮은 공격력을 감수하고 부상한 아군을 주기적으로 회복합니다.',points:['최저 HP 아군 우선 회복','장기전 생존력 상승','단독 화력은 낮음']},
  imp:{key:'mage',title:'마법 딜러',summary:'몸은 약하지만 고유 마법으로 높은 방어력을 관통합니다.',points:['방어 관통 마법 공격','높은 순간 화력','낮은 HP·방어']},
  golem:{key:'tank',title:'탱커',summary:'인간의 공격을 자신에게 끌어오고 받는 피해를 줄여 파티를 보호합니다.',points:['높은 도발 가중치','상시 피해 감소','낮은 속도·화력']},
  goblin:{key:'dps',title:'물리 딜러',summary:'빠른 속도와 치명타를 이용하는 기본 물리 공격수입니다.',points:['높은 속도','높은 치명·회피','낮은 생존력']},
  troll:{key:'bruiser',title:'브루저',summary:'체력과 공격력을 함께 가진 전열형 공격수입니다.',points:['높은 HP·공격','안정적인 전열 유지','전담 탱커보다 보호 능력 낮음']},
  slime:{key:'buffer',title:'완충형',summary:'체력과 방어가 고르게 잡힌 범용 전투 요원입니다.',points:['안정적인 생존','균형형 성장','전문화 효과 없음']}
}[m?.family]||{key:'fighter',title:'전투 요원',summary:'기본 전투 역할을 수행합니다.',points:[]});
const roleCardHtml=m=>{const r=roleMeta(m);return `<section class=\"monster-role-card role-${r.key}\"><header><small>PARTY ROLE</small><b>${esc(r.title)}</b></header><p>${esc(r.summary)}</p><div>${r.points.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`};"""
assert old in s
s=s.replace(old,new,1)

old="const power=m=>{const st=monsterStats(m);return Math.floor(Number(m.power_base||0)+(Number(m.level||1)-1)*12+Math.max(0,Number(m.talent||80)-80)*1.2+(st.atk-Number(m.atk_base||18))*.8+(st.def-Number(m.def_base||8))*.55+(st.hp-Number(m.hp_base||120))*.03)};"
new="const utilityPower=m=>({mandrake:13,imp:8,golem:14}[m?.family]||0);\nconst power=m=>{const st=monsterStats(m);return Math.floor(Number(m.power_base||0)+(Number(m.level||1)-1)*12+Math.max(0,Number(m.talent||80)-80)*1.2+(st.atk-Number(m.atk_base||18))*.8+(st.def-Number(m.def_base||8))*.55+(st.hp-Number(m.hp_base||120))*.03+utilityPower(m))};"
assert old in s
s=s.replace(old,new,1)

old="const monsterAsset=f=>`monster-${f==='goblin'?'goblin':f==='troll'?'troll':'slime'}`;"
new="const monsterAsset=f=>`monster-${['slime','goblin','troll','mandrake','imp','golem'].includes(f)?f:'slime'}`;"
assert old in s
s=s.replace(old,new,1)

old="const skillTriggerText=s=>{if(!s)return '';if(s.trigger_type==='every_n')return `${s.trigger_count}번째 공격마다 발동`;if(s.trigger_type==='hp_below_chance')return `아군 HP ${Math.round(Number(s.condition_value||0)*100)}% 이하 · 공격 시 ${Math.round(Number(s.trigger_value||0)*100)}% 확률`;return `공격 시 ${Math.round(Number(s.trigger_value||0)*100)}% 확률`};"
new="""const skillEffectClass=s=>({heal:'healer',magic:'mage',tank:'tank'}[s?.effect_type]||'damage');
const skillEffectLabel=s=>s?.effect_type==='heal'?`회복 ${Math.round(Number(s.heal_ratio||0)*100)}%`:s?.effect_type==='magic'?`마법 · 방어 ${Math.round(Number(s.defense_ignore||0)*100)}% 관통`:s?.effect_type==='tank'?`도발 ×${Number(s.taunt_weight||1).toFixed(1)} · 피해감소 ${Math.round(Number(s.damage_reduction||0)*100)}%`:`피해 ×${Number(s?.damage_multiplier||1).toFixed(2)}`;
const skillTriggerText=s=>{if(!s)return '';let t=s.trigger_type==='every_n'?`${s.trigger_count}번째 공격마다 발동`:s.trigger_type==='hp_below_chance'?`아군 HP ${Math.round(Number(s.condition_value||0)*100)}% 이하 · 공격 시 ${Math.round(Number(s.trigger_value||0)*100)}% 확률`:`공격 시 ${Math.round(Number(s.trigger_value||0)*100)}% 확률`;if(s.effect_type==='tank')t+=` · 상시 도발/피해감소`;return t};"""
assert old in s
s=s.replace(old,new,1)

# Recruitment card: keep core stats visible while adding role information compactly.
s=s.replace("<small>${fam(c.family)} · ${esc(c.personality||'침착')}</small><em>${esc(c.trait||'무특성')}</em>","<small>${fam(c.family)} · ${roleOf(c)}</small><em>${esc(c.personality||'침착')} · ${esc(c.trait||'무특성')}</em>",1)
s=s.replace("<p>${fam(c.family)} · 성장 ${esc(c.growth_grade||'C')} · 재능 ${fmt(c.talent)}</p>","<p>${fam(c.family)} · ${roleOf(c)} · 성장 ${esc(c.growth_grade||'C')} · 재능 ${fmt(c.talent)}</p>",1)
s=s.replace('<section class="candidate-personality">','${roleCardHtml(c)}<section class="candidate-personality">',1)

# Monster detail: role remains visible even after evolution, and skill type is visually explicit.
emp_start=s.index('function employeeModal(')
emp_end=s.index('\nfunction releaseConfirmModal',emp_start)
emp=s[emp_start:emp_end]
emp=emp.replace("<p>${esc(formName(m))} · ${Number(m.evolution_tier||0)?`${m.evolution_tier}차 전직` : roleOf(m)} · 성장 ${esc(m.growth_grade||'C')}</p>","<p>${esc(formName(m))} · ${roleOf(m)} · ${Number(m.evolution_tier||0)?`${m.evolution_tier}차 전직 · `:''}성장 ${esc(m.growth_grade||'C')}</p>",1)
emp=emp.replace("</div>${sk?`<section class=\"unique-skill-card\">","</div>${roleCardHtml(m)}${sk?`<section class=\"unique-skill-card ${skillEffectClass(sk)}\">",1)
emp=emp.replace("<strong>${esc(skillTriggerText(sk))}</strong>","<strong>${esc(skillTriggerText(sk))} · ${esc(skillEffectLabel(sk))}</strong>",1)
s=s[:emp_start]+emp+s[emp_end:]

# Evolution screen: show actual role effect in addition to trigger timing.
evo_start=s.index('function evolutionModal(')
evo_end=s.index('\n\nfunction personalityModal',evo_start)
evo=s[evo_start:evo_end]
evo=evo.replace("<strong>${esc(skillTriggerText(sk))}</strong>","<strong>${esc(skillTriggerText(sk))} · ${esc(skillEffectLabel(sk))}</strong>")
s=s[:evo_start]+evo+s[evo_end:]

# Party building must surface roles before launch.
s=s.replace("<small>${formName(m)} · 전투력 ${fmt(power(m))}${busy?' · 다른 작전 참가 중':''}</small>","<small>${formName(m)} · ${roleOf(m)} · 전투력 ${fmt(power(m))}${busy?' · 다른 작전 참가 중':''}</small>",1)
s=s.replace("<div class=\"party-summary\"><span>${selected.length}/4 선택</span>","<div class=\"party-summary\"><span>${selected.length}/4 선택</span><span class=\"party-role-mix\">${selected.length?selected.map(m=>roleOf(m)).join(' · '):'역할 미선택'}</span>",1)

# Battle skill presentation supports healing, magic and tank effects.
old="function battleSkillHtml(skills){if(!skills?.length)return '';return `<div class=\"battle-skill-banner\">${skills.slice(0,4).map(s=>`<span><b>${esc(s.owner||'몬스터')}</b> ${esc(s.name||'고유 스킬')} <em>${s.attack?`${fmt(s.attack)}번째 공격`:'발동'}</em></span>`).join('')}</div>`}"
new="function battleSkillHtml(skills){if(!skills?.length)return '';return `<div class=\"battle-skill-banner\">${skills.slice(0,4).map(s=>`<span class=\"skill-${esc(s.effect||'damage')}\"><b>${esc(s.owner||'몬스터')}</b> ${esc(s.name||'고유 스킬')} <em>${Number(s.heal||0)>0?`+${fmt(s.heal)} HP`:s.effect==='magic'?'MAGIC':s.effect==='tank'?'GUARD':s.attack?`${fmt(s.attack)}번째 공격`:'발동'}</em></span>`).join('')}</div>`}"
assert old in s
s=s.replace(old,new,1)

# Add role class to combat sprites.
s=s.replace('<div class="battle-party-unit ${dead?\'dead\':\'\'}" style="--party-index:${i}">','<div class="battle-party-unit role-${roleKey(m)} ${dead?\'dead\':\'\'}" style="--party-index:${i}">',1)

# Skill log text: display healing/magic/tank rather than pretending every proc is just an attack counter.
s=s.replace("${esc(s.name||'고유 스킬')} · ${fmt(s.attack||0)}번째 공격","${esc(s.name||'고유 스킬')} · ${Number(s.heal||0)>0?`회복 +${fmt(s.heal)} HP`:s.effect==='magic'?'마법 공격':s.effect==='tank'?'수호 발동':`${fmt(s.attack||0)}번째 공격`}")

APP.write_text(s)

# UI polish and role signaling.
c=CSS.read_text()
marker='/* v0.12.6 party roles */'
if marker not in c:
    c += r'''

/* v0.12.6 party roles */
.monster-role-card{margin:10px 0;padding:10px 11px;border:1px solid #465248;background:rgba(255,255,255,.035);border-radius:9px}.monster-role-card header{display:flex;justify-content:space-between;align-items:center;gap:8px}.monster-role-card header small{font-size:8px;letter-spacing:.8px;opacity:.58}.monster-role-card header b{font-size:13px}.monster-role-card p{margin:6px 0 7px;font-size:10px;line-height:1.45;color:#aeb8af}.monster-role-card>div{display:flex;flex-wrap:wrap;gap:5px}.monster-role-card>div span{font-size:9px;padding:4px 6px;border:1px solid #3d493f;background:#151a16;border-radius:5px}.monster-role-card.role-healer{border-color:#4f7658;background:rgba(71,117,81,.10)}.monster-role-card.role-mage{border-color:#66598b;background:rgba(86,68,129,.10)}.monster-role-card.role-tank{border-color:#7b684f;background:rgba(121,91,55,.10)}
.unique-skill-card.healer{border-color:#588662}.unique-skill-card.mage{border-color:#6f63a0}.unique-skill-card.tank{border-color:#92734e}.unique-skill-card.healer .skill-gem{background:#477956}.unique-skill-card.mage .skill-gem{background:#5e4f91}.unique-skill-card.tank .skill-gem{background:#7e603f}
.party-role-mix{grid-column:1/-1!important;white-space:normal!important;line-height:1.3;color:#c6d0c8!important}.party-select-row small{white-space:normal;line-height:1.3}.battle-party-unit.role-healer{filter:drop-shadow(0 0 4px rgba(97,194,117,.25))}.battle-party-unit.role-mage{filter:drop-shadow(0 0 4px rgba(144,118,224,.25))}.battle-party-unit.role-tank{filter:drop-shadow(0 0 4px rgba(204,150,83,.25))}
.battle-skill-banner .skill-heal{border-color:#558a61}.battle-skill-banner .skill-heal em{color:#98dda3}.battle-skill-banner .skill-magic{border-color:#6c5ca0}.battle-skill-banner .skill-magic em{color:#beaaf1}.battle-skill-banner .skill-tank{border-color:#8a6c49}.battle-skill-banner .skill-tank em{color:#e0b77f}
.form-moon_mandrake,.form-sacred_bloom_mandrake{filter:hue-rotate(25deg) brightness(1.16)}.form-thorn_mandrake,.form-bloodvine_mandrake{filter:hue-rotate(-25deg) saturate(1.18)}.form-spiritroot_mandrake{filter:hue-rotate(70deg) brightness(1.12)}.form-thorn_requiem_mandrake{filter:hue-rotate(-45deg) contrast(1.08)}
.form-flame_imp,.form-inferno_imp,.form-emberlord_imp{filter:hue-rotate(-25deg) saturate(1.35) brightness(1.08)}.form-void_imp,.form-abyss_imp,.form-null_imp{filter:hue-rotate(55deg) saturate(1.25)}
.form-iron_golem,.form-fortress_golem,.form-sentinel_golem{filter:contrast(1.12) brightness(.94)}.form-guardian_golem,.form-aegis_golem{filter:hue-rotate(20deg) brightness(1.08)}.form-obsidian_golem{filter:brightness(.72) saturate(.8)}
@media(max-width:420px){.monster-role-card>div{display:grid;grid-template-columns:1fr}.monster-role-card>div span{line-height:1.25}.party-role-mix{font-size:9px!important}}
'''
CSS.write_text(c)

# New base-role pixel sprites.
svg=SPR.read_text()
if 'id="monster-mandrake"' not in svg:
    art=r'''
<symbol id="monster-mandrake" viewBox="0 0 64 64">
<rect x="9" y="56" width="46" height="4" fill="#0b0f0d"/><rect x="23" y="25" width="20" height="27" fill="#9a7547"/><rect x="19" y="31" width="6" height="15" fill="#b28c58"/><rect x="41" y="31" width="6" height="15" fill="#b28c58"/><rect x="27" y="19" width="12" height="9" fill="#c19b63"/><rect x="21" y="12" width="10" height="12" fill="#5f9c54"/><rect x="34" y="10" width="11" height="14" fill="#78b865"/><rect x="28" y="7" width="7" height="14" fill="#4d8248"/><rect x="27" y="31" width="5" height="5" fill="#eef2d8"/><rect x="36" y="31" width="5" height="5" fill="#eef2d8"/><rect x="29" y="33" width="2" height="2" fill="#172017"/><rect x="38" y="33" width="2" height="2" fill="#172017"/><rect x="30" y="42" width="9" height="3" fill="#6f4635"/><rect x="20" y="50" width="8" height="7" fill="#765b3b"/><rect x="38" y="50" width="8" height="7" fill="#765b3b"/><rect x="48" y="23" width="3" height="29" fill="#6f5639"/><rect x="45" y="19" width="9" height="7" fill="#8cd28b"/><rect x="48" y="15" width="3" height="5" fill="#d8efb3"/>
</symbol>
<symbol id="monster-imp" viewBox="0 0 64 64">
<rect x="10" y="56" width="44" height="4" fill="#0b0f0d"/><rect x="21" y="25" width="23" height="26" fill="#70486f"/><rect x="24" y="18" width="18" height="12" fill="#8e5c89"/><polygon points="23,20 17,10 28,16" fill="#c27a6c"/><polygon points="42,20 48,10 37,16" fill="#c27a6c"/><rect x="25" y="30" width="6" height="6" fill="#f0e0a6"/><rect x="35" y="30" width="6" height="6" fill="#f0e0a6"/><rect x="28" y="32" width="2" height="2" fill="#27162a"/><rect x="38" y="32" width="2" height="2" fill="#27162a"/><rect x="29" y="41" width="9" height="3" fill="#ca705f"/><rect x="18" y="31" width="5" height="16" fill="#5e385e"/><rect x="43" y="31" width="5" height="16" fill="#5e385e"/><rect x="21" y="50" width="8" height="7" fill="#49304a"/><rect x="36" y="50" width="8" height="7" fill="#49304a"/><rect x="49" y="19" width="3" height="35" fill="#6d4b38"/><rect x="46" y="17" width="9" height="5" fill="#ad7ae0"/><rect x="48" y="13" width="5" height="5" fill="#d7b5ff"/>
</symbol>
<symbol id="monster-golem" viewBox="0 0 64 64">
<rect x="6" y="56" width="52" height="4" fill="#0b0f0d"/><rect x="17" y="20" width="31" height="32" fill="#6f756e"/><rect x="12" y="27" width="8" height="22" fill="#858b82"/><rect x="46" y="27" width="8" height="22" fill="#858b82"/><rect x="21" y="13" width="23" height="13" fill="#7f867d"/><rect x="24" y="28" width="7" height="6" fill="#c9d6bd"/><rect x="36" y="28" width="7" height="6" fill="#c9d6bd"/><rect x="27" y="30" width="3" height="2" fill="#2b332b"/><rect x="39" y="30" width="3" height="2" fill="#2b332b"/><rect x="27" y="42" width="13" height="4" fill="#4c514c"/><rect x="20" y="50" width="11" height="7" fill="#565c56"/><rect x="36" y="50" width="11" height="7" fill="#565c56"/><rect x="29" y="35" width="9" height="7" fill="#9d6d3d"/><rect x="31" y="37" width="5" height="3" fill="#efbd6d"/><rect x="9" y="31" width="5" height="13" fill="#565d57"/><rect x="52" y="31" width="5" height="13" fill="#565d57"/>
</symbol>
'''
    assert '<symbol id="human-youth"' in svg
    svg=svg.replace('<symbol id="human-youth"',art+'<symbol id="human-youth"',1)
SPR.write_text(svg)

# Version/cache bump.
i=IDX.read_text().replace('v0.12.5','v0.12.6').replace('0125a','0126a')
IDX.write_text(i)

# Build DB migration by upgrading the current v0.12.4 turn-state function in place.
base=BASE.read_text()
start=base.index('create or replace function public.game_process_expedition_action')
end=base.index('\n$$;',start)+4
combat=base[start:end]

# New runtime fields used by support/tank roles.
needle='  skill_owner text;\n  target_id uuid;'
assert needle in combat
combat=combat.replace(needle,"""  skill_owner text;
  skill_effect text:='damage';
  heal_ratio numeric:=0;
  heal_target_id uuid;
  heal_target_name text;
  heal_target_max int:=0;
  heal_before int:=0;
  heal_after int:=0;
  heal_amount int:=0;
  heal_total int:=0;
  turn_heal int:=0;
  armor_coeff numeric:=0.55;
  target_id uuid;""",1)

# Restore cumulative healing from the persistent battle state each 2-second turn.
old="enemy_crits:=coalesce((bs->>'enemyCrits')::int,0);skill_events:='[]'::jsonb;death_events:='[]'::jsonb;total_dmg:=0;"
new="enemy_crits:=coalesce((bs->>'enemyCrits')::int,0);heal_total:=coalesce((bs->>'healingDone')::int,0);turn_heal:=0;skill_events:='[]'::jsonb;death_events:='[]'::jsonb;total_dmg:=0;"
assert old in combat
combat=combat.replace(old,new,1)

# Replace the per-monster party attack block: healer heals lowest HP ally, mage uses armor-piercing magic, tank keeps an active slam.
pattern=r"        attack_no:=coalesce\(\(attack_counts->>mem\.id::text\)::int,0\)\+1;.*?        exit when enemy_hp<=0;\n"
replacement=r'''        attack_no:=coalesce((attack_counts->>mem.id::text)::int,0)+1;attack_counts:=jsonb_set(attack_counts,array[mem.id::text],to_jsonb(attack_no),true);
        dmg:=0;heal_amount:=0;skill_fx:=public.game_trigger_monster_skill(mem.id,attack_no,current_hp::numeric/max_hp);
        skill_mult:=coalesce((skill_fx->>'damage_multiplier')::numeric,1);skill_ignore:=coalesce((skill_fx->>'defense_ignore')::numeric,0);skill_effect:=coalesce(nullif(skill_fx->>'effect_type',''),'damage');heal_ratio:=coalesce((skill_fx->>'heal_ratio')::numeric,0);armor_coeff:=case when skill_effect='magic' then 0.38 else 0.55 end;
        skill_name:=nullif(skill_fx->>'name','');skill_owner:=nullif(skill_fx->>'owner','');
        if skill_name is not null and skill_effect='heal' and heal_ratio>0 then
          heal_target_id:=null;heal_target_name:=null;
          select em.monster_id,m.name into heal_target_id,heal_target_name
          from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
          where em.expedition_id=e.id
            and coalesce((party_hp_json->>em.monster_id::text)::int,0)>0
            and coalesce((party_hp_json->>em.monster_id::text)::int,0)<coalesce((party_max_json->>em.monster_id::text)::int,1)
          order by (coalesce((party_hp_json->>em.monster_id::text)::int,0)::numeric/greatest(1,coalesce((party_max_json->>em.monster_id::text)::int,1))) asc,em.position
          limit 1;
          if heal_target_id is not null then
            heal_before:=coalesce((party_hp_json->>heal_target_id::text)::int,0);heal_target_max:=greatest(1,coalesce((party_max_json->>heal_target_id::text)::int,heal_before));heal_after:=least(heal_target_max,heal_before+greatest(1,round(heal_target_max*heal_ratio)::int));heal_amount:=greatest(0,heal_after-heal_before);
            if heal_amount>0 then party_hp_json:=jsonb_set(party_hp_json,array[heal_target_id::text],to_jsonb(heal_after),true);turn_heal:=turn_heal+heal_amount;heal_total:=heal_total+heal_amount;skill_events:=skill_events||jsonb_build_array(jsonb_build_object('name',skill_name,'owner',skill_owner,'monsterId',mem.id,'attack',attack_no,'effect','heal','heal',heal_amount,'target',heal_target_name));end if;
          end if;
        end if;
        if random()>=least(0.35,enemy_evade+greatest(0,enemy_spd-mspd)*0.002) then
          dmg:=greatest(1,round(matk*(0.88+random()*0.24)*(1+mhuman)*skill_mult-enemy_def*armor_coeff*(1-least(0.90,skill_ignore)))::int);
          if random()<least(0.45,mcrit) then dmg:=round(dmg*1.7);crits:=crits+1;end if;
          enemy_hp:=greatest(0,enemy_hp-dmg);total_dmg:=total_dmg+dmg;dealt_total:=dealt_total+dmg;
          if skill_name is not null and skill_effect<>'heal' then skill_events:=skill_events||jsonb_build_array(jsonb_build_object('name',skill_name,'owner',skill_owner,'monsterId',mem.id,'attack',attack_no,'mult',skill_mult,'effect',skill_effect,'ignore',skill_ignore));end if;
        end if;
        exit when enemy_hp<=0;
'''
combat,n=re.subn(pattern,replacement,combat,count=1,flags=re.S)
assert n==1

# Persist healing totals in active and completed battle state/logs.
old="last_action:=jsonb_build_object('type','party-turn','side','party','round',round_i,'damage',total_dmg,'skills',skill_events);"
new="last_action:=jsonb_build_object('type','party-turn','side','party','round',round_i,'damage',total_dmg,'healing',turn_heal,'skills',skill_events);"
assert old in combat
combat=combat.replace(old,new,1)
combat=combat.replace("'damageDealt',dealt_total,'crits',crits,'skills',skill_events,'lastAction',last_action,'loot',loot_gained","'damageDealt',dealt_total,'healingDone',heal_total,'crits',crits,'skills',skill_events,'lastAction',last_action,'loot',loot_gained",1)
combat=combat.replace("'damageDealt',dealt_total,'crits',crits,'skills',skill_events,'lastAction',last_action);","'damageDealt',dealt_total,'healingDone',heal_total,'crits',crits,'skills',skill_events,'lastAction',last_action);",1)
combat=combat.replace("'damage',total_dmg,'enemyHp',enemy_hp,'enemyMaxHp',enemy_hp_max,'skills',skill_events","'damage',total_dmg,'healing',turn_heal,'enemyHp',enemy_hp,'enemyMaxHp',enemy_hp_max,'skills',skill_events",1)
combat=combat.replace("'damage',total_dmg,'damageDealt',dealt_total,'damageTaken',taken_total,'skills',skill_events","'damage',total_dmg,'damageDealt',dealt_total,'damageTaken',taken_total,'healingDone',heal_total,'skills',skill_events",1)

# Enemy target selection uses weighted aggro and tank passive mitigation.
pattern=r"      select m\.\*,coalesce\(eq\.eq_def,0\) eq_def,coalesce\(eq\.eq_spd,0\) eq_spd,coalesce\(eq\.eq_evade,0\) eq_evade into mem\n      from public\.game_expedition_members em join public\.game_monsters m on m\.id=em\.monster_id\n      left join lateral \(select sum\(d\.def\) eq_def,sum\(d\.spd\) eq_spd,sum\(d\.evade\) eq_evade from public\.game_monster_equipment q join public\.game_item_defs d on d\.id=q\.item_id where q\.monster_id=m\.id\) eq on true\n      where em\.expedition_id=e\.id and coalesce\(\(party_hp_json->>m\.id::text\)::int,0\)>0 order by random\(\) limit 1;"
replacement=r'''      select m.*,coalesce(eq.eq_def,0) eq_def,coalesce(eq.eq_spd,0) eq_spd,coalesce(eq.eq_evade,0) eq_evade,coalesce(rs.damage_reduction,0) role_reduction,coalesce(rs.taunt_weight,1) role_taunt into mem
      from public.game_expedition_members em join public.game_monsters m on m.id=em.monster_id
      left join lateral (select sum(d.def) eq_def,sum(d.spd) eq_spd,sum(d.evade) eq_evade from public.game_monster_equipment q join public.game_item_defs d on d.id=q.item_id where q.monster_id=m.id) eq on true
      left join public.game_skill_defs rs on rs.id=m.skill_id
      where em.expedition_id=e.id and coalesce((party_hp_json->>m.id::text)::int,0)>0
      order by (-ln(greatest(random(),0.000001))/greatest(0.10,coalesce(rs.taunt_weight,1))) asc limit 1;'''
combat,n=re.subn(pattern,replacement,combat,count=1)
assert n==1

old="if random()>=least(0.35,least(0.35,mevade)+greatest(0,mspd-enemy_spd)*0.002) then dmg:=greatest(1,round(enemy_atk*(0.88+random()*0.24)-mdef*0.58)::int);if random()<enemy_crit then dmg:=round(dmg*1.65);enemy_crits:=enemy_crits+1;end if;else dodges:=dodges+1;end if;"
new="if random()>=least(0.35,least(0.35,mevade)+greatest(0,mspd-enemy_spd)*0.002) then dmg:=greatest(1,round(enemy_atk*(0.88+random()*0.24)-mdef*0.58)::int);if random()<enemy_crit then dmg:=round(dmg*1.65);enemy_crits:=enemy_crits+1;end if;if dmg>0 and coalesce(mem.role_reduction,0)>0 then dmg:=greatest(1,round(dmg*(1-least(0.55,mem.role_reduction)))::int);end if;else dodges:=dodges+1;end if;"
assert old in combat
combat=combat.replace(old,new,1)
old="last_action:=jsonb_build_object('type','enemy-turn','side','enemy','round',round_i,'targetId',target_id,'target',target_name,'damage',dmg,'deaths',death_events);"
new="last_action:=jsonb_build_object('type','enemy-turn','side','enemy','round',round_i,'targetId',target_id,'target',target_name,'damage',dmg,'tankReduction',coalesce(mem.role_reduction,0),'tauntWeight',coalesce(mem.role_taunt,1),'deaths',death_events);"
assert old in combat
combat=combat.replace(old,new,1)

skills=[
('healing_spore','치유 포자','every_n',0,3,0,.90,0,'heal',.16,0,1,'3번째 공격마다 가장 다친 아군의 최대 HP 16%를 회복합니다.'),
('arcane_bolt','마력탄','every_n',0,3,0,1.60,.55,'magic',0,0,1,'3번째 공격마다 방어를 크게 관통하는 마력탄을 발사합니다.'),
('guardian_slam','수호 강타','every_n',0,4,0,1.35,.15,'tank',0,.24,3.2,'상시 도발과 피해 감소를 유지하고 4번째 공격마다 수호 강타를 사용합니다.'),
('moon_dew','달빛 수액','every_n',0,2,0,.85,0,'heal',.18,0,1,'2번째 공격마다 가장 다친 아군의 최대 HP 18%를 회복합니다.'),
('blood_pollen','핏빛 꽃가루','hp_below_chance',.40,0,.70,1.10,.05,'heal',.18,0,1,'파티 HP가 70% 이하일 때 40% 확률로 18% 회복과 강화 공격을 함께 수행합니다.'),
('sacred_bloom','성화 개화','every_n',0,2,0,.80,0,'heal',.24,0,1,'2번째 공격마다 최대 HP 24%를 회복하는 순수 치유 특화 스킬입니다.'),
('spirit_root','정령 뿌리','chance',.35,0,0,.95,0,'heal',.20,0,1,'공격 시 35% 확률로 가장 다친 아군을 최대 HP 20%만큼 회복합니다.'),
('crimson_sap','진홍 수액','hp_below_chance',.50,0,.65,1.20,.10,'heal',.22,0,1,'파티 HP가 65% 이하일 때 50% 확률로 22% 회복하며 공격도 강화합니다.'),
('thorn_requiem','가시 진혼곡','every_n',0,3,0,1.35,.15,'heal',.16,0,1,'3번째 공격마다 16%를 회복하면서 높은 공격 배율을 유지하는 전투 힐러 스킬입니다.'),
('fire_orb','화염구','every_n',0,3,0,1.90,.30,'magic',0,0,1,'3번째 공격마다 강한 화염 마법을 사용합니다.'),
('void_lance','공허 창','every_n',0,3,0,1.65,.70,'magic',0,0,1,'3번째 공격마다 적 방어의 70%를 무시하는 공허 마법을 사용합니다.'),
('inferno_meteor','인페르노 메테오','every_n',0,4,0,2.60,.35,'magic',0,0,1,'4번째 공격마다 매우 강한 화염 운석을 떨어뜨립니다.'),
('chain_flare','연쇄 화염','chance',.25,0,0,2.00,.25,'magic',0,0,1,'공격 시 25% 확률로 화염이 연쇄 폭발합니다.'),
('abyss_ray','심연 광선','every_n',0,3,0,2.10,.75,'magic',0,0,1,'3번째 공격마다 방어 75%를 무시하는 심연 광선을 발사합니다.'),
('null_burst','무효 폭발','chance',.22,0,0,2.30,.65,'magic',0,0,1,'공격 시 22% 확률로 방어를 크게 무시하는 무효 폭발을 일으킵니다.'),
('iron_guard','철갑 수호','every_n',0,4,0,1.45,.20,'tank',0,.28,3.7,'상시 피해 28% 감소와 높은 도발을 유지하며 4번째 공격마다 반격합니다.'),
('guardian_wall','수호벽','every_n',0,5,0,1.25,.25,'tank',0,.32,4.2,'상시 피해 32% 감소와 강한 도발로 아군 대신 공격을 받아냅니다.'),
('fortress_crush','요새 분쇄','every_n',0,4,0,1.65,.35,'tank',0,.36,4.5,'상시 피해 36% 감소를 유지하며 4번째 공격마다 방어 파괴 강타를 가합니다.'),
('obsidian_counter','흑요 반격','hp_below_chance',.35,0,.60,1.90,.30,'tank',0,.32,4.0,'HP가 60% 이하일 때 35% 확률로 강한 반격을 가하며 상시 피해 32% 감소를 유지합니다.'),
('sentinel_bash','파수 강타','every_n',0,3,0,1.45,.40,'tank',0,.34,4.8,'도발이 매우 높고 3번째 공격마다 방어를 관통하는 방패 강타를 사용합니다.'),
('aegis_core','이지스 코어','every_n',0,5,0,1.30,.50,'tank',0,.40,5.2,'상시 피해 40% 감소와 최고 수준의 도발을 유지하는 극방어 스킬입니다.')]

evos=[
('mandrake_moon','mandrake','mandrake','moon_mandrake','문 만드라고라',1,20,1.18,1.02,1.15,1.10,1.15,.00,.02,'moon_dew','회복 주기를 짧게 가져가는 순수 힐러 계열입니다.'),
('mandrake_thorn','mandrake','mandrake','thorn_mandrake','쏜 만드라고라',1,20,1.10,1.16,1.08,1.08,1.15,.02,.01,'blood_pollen','회복과 공격을 함께 수행하는 전투 힐러 계열입니다.'),
('moon_sacred','mandrake','moon_mandrake','sacred_bloom_mandrake','세이크리드 블룸',2,30,1.22,1.00,1.18,1.08,1.20,.00,.03,'sacred_bloom','파티 유지력에 모든 성능을 집중한 최상급 치유종입니다.'),
('moon_spirit','mandrake','moon_mandrake','spiritroot_mandrake','스피릿 루트',2,30,1.16,1.08,1.15,1.12,1.20,.01,.03,'spirit_root','확률형 고빈도 회복으로 불규칙한 피해에 대응합니다.'),
('thorn_crimson','mandrake','thorn_mandrake','bloodvine_mandrake','블러드바인',2,30,1.20,1.18,1.10,1.06,1.21,.03,.01,'crimson_sap','위기 상황에서 강한 회복과 공격을 동시에 수행합니다.'),
('thorn_requiem_evo','mandrake','thorn_mandrake','thorn_requiem_mandrake','리퀴엠 만드라고라',2,30,1.12,1.24,1.08,1.12,1.21,.04,.02,'thorn_requiem','힐러 중 가장 높은 공격 기여도를 가진 공격지원형입니다.'),
('imp_flame','imp','imp','flame_imp','플레임 임프',1,20,1.05,1.25,1.02,1.08,1.17,.03,.01,'fire_orb','마법 관통보다 순수 폭발 화력에 집중합니다.'),
('imp_void','imp','imp','void_imp','보이드 임프',1,20,1.08,1.18,1.05,1.12,1.17,.02,.03,'void_lance','중장갑 적을 상대하는 방어 관통 마법사입니다.'),
('flame_inferno','imp','flame_imp','inferno_imp','인페르노 임프',2,30,1.08,1.30,1.04,1.08,1.22,.04,.01,'inferno_meteor','긴 주기 대신 가장 높은 단발 마법 화력을 얻습니다.'),
('flame_chain','imp','flame_imp','emberlord_imp','엠버로드 임프',2,30,1.10,1.24,1.06,1.14,1.21,.04,.02,'chain_flare','확률형 연속 폭발로 평균 화력을 높입니다.'),
('void_abyss','imp','void_imp','abyss_imp','어비스 임프',2,30,1.10,1.25,1.06,1.12,1.22,.03,.03,'abyss_ray','매우 높은 방어 관통과 안정적인 주기 공격을 가집니다.'),
('void_null','imp','void_imp','null_imp','널 임프',2,30,1.12,1.22,1.08,1.15,1.21,.03,.04,'null_burst','확률형 고배율 관통 마법으로 폭발적인 변수를 만듭니다.'),
('golem_iron','golem','golem','iron_golem','아이언 골렘',1,20,1.25,1.10,1.25,.96,1.17,.00,.00,'iron_guard','체력과 방어를 동시에 끌어올린 정통 탱커입니다.'),
('golem_guardian','golem','golem','guardian_golem','가디언 골렘',1,20,1.18,1.05,1.32,.95,1.17,.00,.00,'guardian_wall','화력보다 도발과 피해 감소에 더 집중합니다.'),
('iron_fortress_golem','golem','iron_golem','fortress_golem','포트리스 골렘',2,30,1.30,1.12,1.28,.95,1.22,.00,.00,'fortress_crush','강한 생존력과 방어 파괴 반격을 함께 보유합니다.'),
('iron_obsidian_golem','golem','iron_golem','obsidian_golem','옵시디언 골렘',2,30,1.24,1.18,1.24,.98,1.21,.01,.00,'obsidian_counter','체력이 낮아질수록 반격 화력이 살아나는 탱커입니다.'),
('guardian_sentinel','golem','guardian_golem','sentinel_golem','센티널 골렘',2,30,1.26,1.10,1.30,.96,1.22,.00,.00,'sentinel_bash','가장 높은 수준의 도발로 파티의 공격을 대신 받습니다.'),
('guardian_aegis','golem','guardian_golem','aegis_golem','이지스 골렘',2,30,1.34,1.04,1.34,.92,1.23,.00,.00,'aegis_core','최고 수준의 피해 감소를 가진 극방어 최종종입니다.')]

def q(v):
    if v is None:return 'null'
    if isinstance(v,str):return "'"+v.replace("'","''")+"'"
    return str(v).lower() if isinstance(v,bool) else str(v)

skill_values=',\n'.join('('+','.join(q(v) for v in row)+')' for row in skills)
evo_values=',\n'.join('('+','.join(q(v) for v in row)+')' for row in evos)

preamble=f'''-- v0.12.6 party roles: healer / mage / tank
alter table public.game_skill_defs add column if not exists effect_type text not null default 'damage';
alter table public.game_skill_defs add column if not exists heal_ratio numeric not null default 0;
alter table public.game_skill_defs add column if not exists damage_reduction numeric not null default 0;
alter table public.game_skill_defs add column if not exists taunt_weight numeric not null default 1;

insert into public.game_skill_defs(id,name,trigger_type,trigger_value,trigger_count,condition_value,damage_multiplier,defense_ignore,effect_type,heal_ratio,damage_reduction,taunt_weight,description) values
{skill_values}
on conflict(id) do update set name=excluded.name,trigger_type=excluded.trigger_type,trigger_value=excluded.trigger_value,trigger_count=excluded.trigger_count,condition_value=excluded.condition_value,damage_multiplier=excluded.damage_multiplier,defense_ignore=excluded.defense_ignore,effect_type=excluded.effect_type,heal_ratio=excluded.heal_ratio,damage_reduction=excluded.damage_reduction,taunt_weight=excluded.taunt_weight,description=excluded.description;

insert into public.game_evolution_defs(id,base_family,from_form_id,target_form_id,target_name,tier,required_level,hp_mult,atk_mult,def_mult,spd_mult,power_mult,crit_add,evade_add,skill_id,description) values
{evo_values}
on conflict(id) do update set base_family=excluded.base_family,from_form_id=excluded.from_form_id,target_form_id=excluded.target_form_id,target_name=excluded.target_name,tier=excluded.tier,required_level=excluded.required_level,hp_mult=excluded.hp_mult,atk_mult=excluded.atk_mult,def_mult=excluded.def_mult,spd_mult=excluded.spd_mult,power_mult=excluded.power_mult,crit_add=excluded.crit_add,evade_add=excluded.evade_add,skill_id=excluded.skill_id,description=excluded.description;

create or replace function public.game_trigger_monster_skill(p_monster uuid,p_attack_count integer,p_hp_ratio numeric)
returns jsonb language plpgsql set search_path to 'public' as $$
declare r record; fired boolean:=false;
begin
 select m.id monster_id,m.name owner_name,s.* into r from public.game_monsters m join public.game_skill_defs s on s.id=m.skill_id where m.id=p_monster;
 if not found then return '{{}}'::jsonb; end if;
 fired:=case r.trigger_type when 'chance' then random()<r.trigger_value when 'every_n' then r.trigger_count>0 and mod(greatest(1,p_attack_count),r.trigger_count)=0 when 'hp_below_chance' then p_hp_ratio<=r.condition_value and random()<r.trigger_value else false end;
 if not fired then return '{{}}'::jsonb; end if;
 return jsonb_build_object('id',r.id,'name',r.name,'owner',r.owner_name,'monsterId',r.monster_id,'damage_multiplier',r.damage_multiplier,'defense_ignore',r.defense_ignore,'effect_type',r.effect_type,'heal_ratio',r.heal_ratio,'damage_reduction',r.damage_reduction,'taunt_weight',r.taunt_weight);
end $$;

create or replace function public.game_hire_candidate(p_player uuid,p_candidate uuid)
returns jsonb language plpgsql set search_path to 'public' as $$
declare p record;c record;current_count int;cap int;new_id uuid;base_skill text;
begin
 select quarters_level into p from public.game_players where device_id=p_player for update;if not found then raise exception 'player_missing';end if;
 select * into c from public.game_candidates where id=p_candidate and player_id=p_player for update;if not found then raise exception 'candidate_missing';end if;
 cap:=3+greatest(0,coalesce(p.quarters_level,1)-1)*2;select count(*)::int into current_count from public.game_monsters where player_id=p_player and released_at is null;if current_count>=cap then raise exception 'quarters_full';end if;
 base_skill:=case c.family when 'mandrake' then 'healing_spore' when 'imp' then 'arcane_bolt' when 'golem' then 'guardian_slam' else null end;
 insert into public.game_monsters(player_id,name,family,form_id,evolution_tier,skill_id,level,xp,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base)
 values(p_player,c.name,c.family,c.family,0,base_skill,1,0,c.talent,c.trait,c.power_base,c.personality,c.growth_grade,c.hp_base,c.atk_base,c.def_base,c.spd_base,c.crit_base,c.evade_base) returning id into new_id;
 delete from public.game_candidates where id=p_candidate and player_id=p_player;return jsonb_build_object('monsterId',new_id,'capacity',cap,'count',current_count+1);
end $$;

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
   elsif fam='imp' then hp:=round(88*mult);atk:=round(26*mult);de:=round(5*mult);spd:=round(12*mult);cr:=0.07;ev:=0.05;pb:=57;
   else hp:=round(240*mult);atk:=round(13*mult);de:=round(21*mult);spd:=round(5*mult);cr:=0.02;ev:=0.01;pb:=63;end if;
   insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
   values(p.device_id,(array['꾸륵','찍찍','우르그','푸르','크룩','도르','무그','벨칵','루트','지직','둔석','모스'])[1+floor(random()*12)::int],fam,talent,tr,pb,pers,grade,hp,atk,de,spd,cr,ev,false);made:=made+1;
  end loop;end if;update public.game_players set next_candidate_at=now()+interval '4 hours',updated_at=now() where device_id=p.device_id;
 end loop;return made;
end $$;

update public.game_monsters set skill_id=case family when 'mandrake' then 'healing_spore' when 'imp' then 'arcane_bolt' when 'golem' then 'guardian_slam' else skill_id end where released_at is null and skill_id is null and family in ('mandrake','imp','golem');
'''

MIG.write_text(preamble+'\n'+combat+'\n')

# Safety checks: all three roles must be represented in UI, sprites, data and combat runtime.
for token in ['mandrake','imp','golem','roleCardHtml','skillEffectLabel']:
    assert token in APP.read_text(),token
for token in ['monster-mandrake','monster-imp','monster-golem']:
    assert token in SPR.read_text(),token
for token in ['healing_spore','arcane_bolt','guardian_slam','taunt_weight','healingDone','role_reduction']:
    assert token in MIG.read_text(),token
assert 'v0.12.6' in IDX.read_text() and '0126a' in IDX.read_text()
print('v0.12.6 party roles patch generated')
