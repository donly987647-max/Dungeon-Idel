from pathlib import Path

app_path=Path('app.js')
app=app_path.read_text(encoding='utf-8')
old="party=partyOf(e),fallbackMax=party.reduce((a,m)=>a+monsterStats(m).hp,0),mmax=battleHpSum(bs.partyMaxHp)||fallbackMax,mhp=battleHpSum(bs.partyHp)||(active?mmax:fallbackMax),emax="
new="party=partyOf(e),fallbackMax=party.reduce((a,m)=>a+monsterStats(m).hp,0),trackedHp=Object.keys(bs.partyMaxHp||{}).length>0,mmax=trackedHp?battleHpSum(bs.partyMaxHp):fallbackMax,mhp=trackedHp?battleHpSum(bs.partyHp):fallbackMax,emax="
if old not in app: raise SystemExit('battle hp marker missing')
app=app.replace(old,new,1)
app=app.replace("damageText=`몬스터 선공 ${initiativePct}%`","damageText=`선공 확률 ${initiativePct}%`",1)
app_path.write_text(app,encoding='utf-8')

index=Path('index.html')
html=index.read_text(encoding='utf-8').replace('0124a','0124b')
index.write_text(html,encoding='utf-8')
