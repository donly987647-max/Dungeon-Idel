from pathlib import Path
p=Path('app.js')
s=p.read_text(encoding='utf-8')
old='<div id="liveEncounterIcon" class="encounter-icon">${isBattle?\'⚔\':\'⌖\'}</div>'
new='<div id="liveEncounterIcon" class="encounter-icon"><i class="encounter-pict ${isBattle?\'combat\':\'explore\'}"></i></div>'
if old not in s:
    raise SystemExit('encounter icon marker not found')
s=s.replace(old,new,1)
old2="const mh=$('#liveMonsterHp'),eh=$('#liveEnemyHp'),mht=$('#liveMonsterHpText'),eht=$('#liveEnemyHpText'),holder=$('#liveEnemySprite'),actor=$('#liveEnemyActor'),cluster=$('#livePartyCluster'),skill=$('#liveSkillProc'),logEl=$('#liveLog');"
new2="const mh=$('#liveMonsterHp'),eh=$('#liveEnemyHp'),mht=$('#liveMonsterHpText'),eht=$('#liveEnemyHpText'),holder=$('#liveEnemySprite'),actor=$('#liveEnemyActor'),cluster=$('#livePartyCluster'),skill=$('#liveSkillProc'),logEl=$('#liveLog'),icon=$('#liveEncounterIcon .encounter-pict');if(icon)icon.className=`encounter-pict ${isBattle?'combat':'explore'}`;"
if old2 not in s:
    raise SystemExit('sync icon marker not found')
s=s.replace(old2,new2,1)
p.write_text(s,encoding='utf-8')

c=Path('app.css')
css=c.read_text(encoding='utf-8')
add='''\n/* v0.12.1 pixel encounter icon hotfix */\n.encounter-icon{height:24px;display:grid;place-items:center}.encounter-pict{display:block;position:relative;width:22px;height:22px;margin:auto}.encounter-pict.explore{border:3px solid #c6b374;transform:rotate(45deg);box-shadow:inset 0 0 0 3px #151a16}.encounter-pict.explore:after{content:"";position:absolute;width:4px;height:4px;background:#e7d697;left:6px;top:6px}.encounter-pict.combat:before,.encounter-pict.combat:after{content:"";position:absolute;left:9px;top:0;width:4px;height:22px;background:#d8d5c5;box-shadow:0 0 0 1px #272a27}.encounter-pict.combat:before{transform:rotate(45deg)}.encounter-pict.combat:after{transform:rotate(-45deg)}\n'''
if 'v0.12.1 pixel encounter icon hotfix' not in css:
    css+=add
c.write_text(css,encoding='utf-8')

i=Path('index.html')
idx=i.read_text(encoding='utf-8').replace('0121a','0121b')
i.write_text(idx,encoding='utf-8')
