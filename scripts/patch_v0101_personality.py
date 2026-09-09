from pathlib import Path
import re

p=Path('app.js')
s=p.read_text()
old="const itemDef=id=>(S?.itemDefs||[]).find(x=>x.id===id)||null;\nconst equippedFor=mid=>(S?.equipment||[]).filter(x=>x.monster_id===mid);\nconst monsterStats=m=>{const eq=equippedFor(m.id).map(x=>itemDef(x.item_id)).filter(Boolean),sum=k=>eq.reduce((a,x)=>a+Number(x[k]||0),0);return {hp:Math.round(Number(m.hp_base||120)+(Number(m.level||1)-1)*9+Math.max(0,Number(m.talent||80)-80)*2+sum('hp')),atk:Math.round(Number(m.atk_base||18)+(Number(m.level||1)-1)*2+Math.max(0,Number(m.talent||80)-80)*.22+sum('atk')),def:Math.round(Number(m.def_base||8)+(Number(m.level||1)-1)*.8+sum('def')),spd:Math.round(Number(m.spd_base||10)+(Number(m.level||1)-1)*.18+sum('spd')),crit:Number(m.crit_base||.05)+sum('crit'),evade:Number(m.evade_base||.03)+sum('evade'),human:sum('human_damage')}};"
new="""const itemDef=id=>(S?.itemDefs||[]).find(x=>x.id===id)||null;
const equippedFor=mid=>(S?.equipment||[]).filter(x=>x.monster_id===mid);
const kstHour=()=>{try{return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'2-digit',hour12:false}).format(new Date()))%24}catch(_){return new Date().getHours()}};
const personalityMeta=n=>({
  '약탈광':{summary:'전투보다 노획물을 먼저 살피는 성격.',effects:['전투 전리품 획득 확률 +20%','수색 보급품 발견 확률 +15%p'],penalty:'전투 능력치 보너스 없음'},
  '광전사':{summary:'맞기 전에 더 세게 때리는 공격적인 성격.',effects:['공격 +15%','치명타 확률 +5%p'],penalty:'방어 -10%'},
  '겁쟁이':{summary:'위험을 감지하면 본능적으로 거리를 벌린다.',effects:['회피 +8%p','속도 +5%'],penalty:'공격 -5%'},
  '인간혐오':{summary:'인간만 보면 전투 본능이 과열된다.',effects:['인간 대상 최종 피해 +12%'],penalty:'별도 페널티 없음'},
  '침착':{summary:'공격보다 생존과 안정적인 교전을 우선한다.',effects:['방어 +10%','회피 +2%p'],penalty:'별도 페널티 없음'},
  '야행성':{summary:'밤이 되면 감각과 움직임이 날카로워진다.',effects:['18:00~06:00 공격 +12%','18:00~06:00 속도 +12%'],penalty:'주간에는 성격 보너스 비활성'}
}[n]||{summary:'아직 분석되지 않은 성격.',effects:['고유 효과 없음'],penalty:'없음'});
const monsterStats=m=>{const eq=equippedFor(m.id).map(x=>itemDef(x.item_id)).filter(Boolean),sum=k=>eq.reduce((a,x)=>a+Number(x[k]||0),0),p=m.personality||'침착';let st={hp:Math.round(Number(m.hp_base||120)+(Number(m.level||1)-1)*9+Math.max(0,Number(m.talent||80)-80)*2+sum('hp')),atk:Number(m.atk_base||18)+(Number(m.level||1)-1)*2+Math.max(0,Number(m.talent||80)-80)*.22+sum('atk'),def:Number(m.def_base||8)+(Number(m.level||1)-1)*.8+sum('def'),spd:Number(m.spd_base||10)+(Number(m.level||1)-1)*.18+sum('spd'),crit:Number(m.crit_base||.05)+sum('crit'),evade:Number(m.evade_base||.03)+sum('evade'),human:sum('human_damage')};if(p==='광전사'){st.atk*=1.15;st.def*=.90;st.crit+=.05}else if(p==='겁쟁이'){st.atk*=.95;st.spd*=1.05;st.evade+=.08}else if(p==='인간혐오'){st.human+=.12}else if(p==='침착'){st.def*=1.10;st.evade+=.02}else if(p==='야행성'&&(kstHour()>=18||kstHour()<6)){st.atk*=1.12;st.spd*=1.12}st.atk=Math.round(st.atk);st.def=Math.round(st.def);st.spd=Math.round(st.spd);st.crit=Math.min(.45,st.crit);st.evade=Math.min(.35,st.evade);return st};"""
if old not in s: raise SystemExit('stats block not found')
s=s.replace(old,new,1)
s=s.replace('<span class="personality-tag">${esc(m.personality||\'침착\')}</span>','<button class="personality-tag" data-action="personality" data-id="${m.id}">${esc(m.personality||\'침착\')}<i>?</i></button>',1)
anchor="function missionModal(siteId){"
insert="""function personalityModal(id){const m=S.monsters.find(x=>x.id===id);if(!m)return;const name=m.personality||'침착',meta=personalityMeta(name),night=name==='야행성',active=!night||(kstHour()>=18||kstHour()<6);modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">PERSONALITY EFFECT</div><h2>${esc(name)}</h2><p>${esc(m.name)}의 고유 성격 효과</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"personality-card\"><div class=\"personality-title\"><span>${esc(name)}</span>${night?`<em class=\"${active?'on':'off'}\">${active?'야간 효과 활성':'주간 비활성'}</em>`:''}</div><p>${esc(meta.summary)}</p><div class=\"personality-effects\">${meta.effects.map(x=>`<div><b>+</b><span>${esc(x)}</span></div>`).join('')}</div><div class=\"personality-penalty\"><b>주의</b><span>${esc(meta.penalty)}</span></div></div><button class=\"soft-btn personality-back\" data-action=\"employee\" data-id=\"${m.id}\">${esc(m.name)} 상세로 돌아가기</button>`,'personality-sheet')}</n
""".replace('</n\n','\n')
if anchor not in s: raise SystemExit('mission anchor missing')
s=s.replace(anchor,insert+anchor,1)
s=s.replace("if(a==='employee'){employeeModal(b.dataset.id);return}","if(a==='employee'){employeeModal(b.dataset.id);return}if(a==='personality'){personalityModal(b.dataset.id);return}",1)
p.write_text(s)

idx=Path('index.html')
h=idx.read_text().replace('v0.10.0','v0.10.1').replace('?v=0100','?v=0101')
needle='<link rel="stylesheet" href="detail-v010.css?v=0101">'
if needle not in h: raise SystemExit('detail css link missing')
h=h.replace(needle,needle+'\n<link rel="stylesheet" href="detail-v0101.css?v=0101">',1)
idx.write_text(h)

Path('detail-v0101.css').write_text("""/* v0.10.1 — interactive personality effect chips */
.personality-tag{appearance:none;display:inline-flex!important;align-items:center;gap:5px;padding:3px 7px!important;border:1px solid #9a6c3c!important;background:#3b2c1d!important;color:#efba72!important;font-size:8px!important;font-weight:900!important;line-height:1!important;cursor:pointer}.personality-tag i{display:grid;place-items:center;width:13px;height:13px;border:1px solid #b88750;border-radius:50%;font-style:normal;font-size:7px;color:#f5cb8c}.personality-tag:active{transform:translateY(1px)}
.personality-sheet{max-width:480px!important}.personality-card{padding:12px;border:1px solid #5b4a35;background:linear-gradient(180deg,#251f18,#191b18)}.personality-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.personality-title>span{font-size:20px;font-weight:1000;color:#efba72}.personality-title em{font-style:normal;font-size:8px;padding:3px 6px;border:1px solid #536058;color:#aeb8b0}.personality-title em.on{border-color:#4d8053;color:#8bd493;background:#17251a}.personality-title em.off{border-color:#72524e;color:#c98b82;background:#2a1c1b}.personality-card>p{margin:9px 0 11px;font-size:10px;line-height:1.55;color:#aeb7af}.personality-effects{display:grid;gap:5px}.personality-effects>div{display:grid;grid-template-columns:22px 1fr;align-items:center;min-height:34px;border:1px solid #344438;background:#18211b}.personality-effects b{display:grid;place-items:center;height:100%;color:#79cf82;font-size:15px;border-right:1px solid #344438}.personality-effects span{padding:0 8px;font-size:10px;color:#e5ebe5}.personality-penalty{display:grid;grid-template-columns:44px 1fr;align-items:center;margin-top:7px;min-height:32px;border:1px solid #5b443c;background:#241b19}.personality-penalty b{padding-left:8px;font-size:8px;color:#db8f82}.personality-penalty span{font-size:9px;color:#bdb8b1}.personality-back{width:100%;margin-top:8px}
@media(max-width:430px){.personality-card{padding:10px}.personality-title>span{font-size:18px}.personality-effects>div{min-height:32px}.personality-effects span{font-size:9px}}
""")
