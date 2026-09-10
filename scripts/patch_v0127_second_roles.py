from pathlib import Path


def rep(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)

app = Path('app.js')
s = app.read_text()
s = rep(s,
"const fam=k=>({slime:'슬라임',goblin:'고블린',troll:'트롤',mandrake:'만드라고라',imp:'임프',golem:'골렘'}[k]||k);",
"const fam=k=>({slime:'슬라임',goblin:'고블린',troll:'트롤',mandrake:'만드라고라',pixie:'픽시',imp:'임프',wisp:'위습',golem:'골렘',mimic:'미믹'}[k]||k);",
'family labels')
s = rep(s,
"const roleOf=m=>({slime:'완충 요원',goblin:'물리 딜러',troll:'브루저',mandrake:'힐러',imp:'마법 딜러',golem:'탱커'}[m?.family]||'전투 요원');",
"const roleOf=m=>({slime:'완충 요원',goblin:'물리 딜러',troll:'브루저',mandrake:'힐러',pixie:'힐러',imp:'마법 딜러',wisp:'마법 딜러',golem:'탱커',mimic:'탱커'}[m?.family]||'전투 요원');",
'role labels')
s = rep(s,
"const roleKey=m=>({mandrake:'healer',imp:'mage',golem:'tank',goblin:'dps',troll:'bruiser',slime:'buffer'}[m?.family]||'fighter');",
"const roleKey=m=>({mandrake:'healer',pixie:'healer',imp:'mage',wisp:'mage',golem:'tank',mimic:'tank',goblin:'dps',troll:'bruiser',slime:'buffer'}[m?.family]||'fighter');",
'role keys')
s = rep(s,
"  mandrake:{key:'healer',title:'힐러',summary:'낮은 공격력을 감수하고 부상한 아군을 주기적으로 회복합니다.',points:['최저 HP 아군 우선 회복','장기전 생존력 상승','단독 화력은 낮음']},\n  imp:{key:'mage',title:'마법 딜러',summary:'몸은 약하지만 고유 마법으로 높은 방어력을 관통합니다.',points:['방어 관통 마법 공격','높은 순간 화력','낮은 HP·방어']},\n  golem:{key:'tank',title:'탱커',summary:'인간의 공격을 자신에게 끌어오고 받는 피해를 줄여 파티를 보호합니다.',points:['높은 도발 가중치','상시 피해 감소','낮은 속도·화력']},",
"  mandrake:{key:'healer',title:'힐러 · 지속형',summary:'낮은 공격력을 감수하고 일정 주기로 아군을 안정적으로 회복합니다.',points:['고정 주기 회복','장기전 유지력 우수','안정적인 생존 지원']},\n  pixie:{key:'healer',title:'힐러 · 응급형',summary:'몸은 매우 약하지만 높은 확률의 즉시 회복으로 갑작스러운 피해를 복구합니다.',points:['확률형 빠른 회복','높은 회피와 선공 기여','매우 낮은 HP·방어']},\n  imp:{key:'mage',title:'마법 딜러 · 폭발형',summary:'주기적으로 강한 관통 마법을 사용해 중장갑 인간을 빠르게 녹입니다.',points:['3타 주기 강한 마법','높은 순간 화력','낮은 HP·방어']},\n  wisp:{key:'mage',title:'마법 딜러 · 연속형',summary:'한 방은 임프보다 약하지만 마법이 자주 터지고 회피와 선공이 뛰어납니다.',points:['확률형 잦은 마법','높은 속도·회피','낮은 단발 화력과 생존력']},\n  golem:{key:'tank',title:'탱커 · 수비형',summary:'높은 도발과 피해 감소로 인간의 공격을 자신에게 집중시키는 정통 탱커입니다.',points:['최상급 생존력','높은 도발 가중치','낮은 속도·화력']},\n  mimic:{key:'tank',title:'탱커 · 반격형',summary:'골렘보다 덜 단단하지만 더 자주, 더 강하게 반격하는 공격형 탱커입니다.',points:['3타 주기 강한 반격','준수한 도발과 피해 감소','골렘보다 낮은 순수 생존력']},",
'role metadata')
s = rep(s,
"const monsterAsset=f=>`monster-${['slime','goblin','troll','mandrake','imp','golem'].includes(f)?f:'slime'}`;",
"const monsterAsset=f=>`monster-${['slime','goblin','troll','mandrake','pixie','imp','wisp','golem','mimic'].includes(f)?f:'slime'}`;",
'monster asset list')
s = rep(s,
"const utilityPower=m=>({mandrake:13,imp:8,golem:14}[m?.family]||0);",
"const utilityPower=m=>({mandrake:13,pixie:14,imp:8,wisp:8,golem:14,mimic:13}[m?.family]||0);",
'utility power')
app.write_text(s)

idx = Path('index.html')
i = idx.read_text().replace('v0.12.6','v0.12.7').replace('0126b','0127a')
idx.write_text(i)

chars = Path('assets/characters.svg')
c = chars.read_text()
marker = '<symbol id="human-youth" viewBox="0 0 64 64">'
if 'monster-pixie' in c:
    raise RuntimeError('sprites already patched')
if marker not in c:
    raise RuntimeError('human sprite marker missing')
new = '''<symbol id="monster-pixie" viewBox="0 0 64 64">
<rect x="13" y="55" width="38" height="4" fill="#0b0f0d"/><rect x="27" y="24" width="12" height="21" fill="#d69bc9"/><rect x="26" y="17" width="14" height="11" fill="#f0c5dc"/><rect x="22" y="21" width="5" height="20" fill="#a76faf"/><rect x="39" y="21" width="5" height="20" fill="#a76faf"/><polygon points="23,25 11,17 17,36" fill="#8fd8d0"/><polygon points="43,25 55,17 49,36" fill="#8fd8d0"/><rect x="29" y="29" width="3" height="3" fill="#311d35"/><rect x="35" y="29" width="3" height="3" fill="#311d35"/><rect x="30" y="37" width="7" height="2" fill="#a65373"/><rect x="26" y="45" width="6" height="10" fill="#78517e"/><rect x="35" y="45" width="6" height="10" fill="#78517e"/><rect x="47" y="34" width="4" height="4" fill="#f4ef9f"/><rect x="45" y="32" width="8" height="8" fill="#e4cfff" opacity=".75"/>
</symbol>
<symbol id="monster-wisp" viewBox="0 0 64 64">
<rect x="14" y="55" width="36" height="4" fill="#0b0f0d"/><polygon points="32,8 43,22 40,39 49,47 38,53 25,51 16,44 24,35 20,22" fill="#6da8d6"/><polygon points="32,14 39,25 36,39 43,45 34,48 25,44 28,34 25,24" fill="#a6d9ef"/><rect x="27" y="29" width="5" height="5" fill="#eef8e7"/><rect x="35" y="29" width="5" height="5" fill="#eef8e7"/><rect x="29" y="31" width="2" height="2" fill="#183348"/><rect x="37" y="31" width="2" height="2" fill="#183348"/><rect x="30" y="40" width="8" height="2" fill="#4e7494"/><rect x="14" y="30" width="6" height="6" fill="#7fc9f0"/><rect x="47" y="25" width="5" height="5" fill="#b9ecff"/><rect x="17" y="19" width="4" height="4" fill="#d8f6ff"/>
</symbol>
<symbol id="monster-mimic" viewBox="0 0 64 64">
<rect x="8" y="55" width="48" height="4" fill="#0b0f0d"/><rect x="14" y="31" width="36" height="22" fill="#7b4c2b"/><rect x="12" y="23" width="40" height="12" fill="#966037"/><rect x="16" y="19" width="32" height="6" fill="#b57b45"/><rect x="16" y="34" width="32" height="5" fill="#2b1711"/><polygon points="18,39 23,46 28,39 33,46 38,39 43,46 48,39" fill="#efe2b7"/><rect x="20" y="27" width="6" height="5" fill="#f2c86e"/><rect x="39" y="27" width="6" height="5" fill="#f2c86e"/><rect x="22" y="29" width="2" height="2" fill="#251711"/><rect x="41" y="29" width="2" height="2" fill="#251711"/><rect x="29" y="20" width="7" height="20" fill="#d0a355"/><rect x="31" y="24" width="3" height="7" fill="#5b3a25"/><rect x="13" y="50" width="8" height="6" fill="#4d2e20"/><rect x="43" y="50" width="8" height="6" fill="#4d2e20"/>
</symbol>
'''
c = c.replace(marker, new + marker, 1)
chars.write_text(c)

print('v0.12.7 specialist roster patched')
