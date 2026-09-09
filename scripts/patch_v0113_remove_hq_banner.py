from pathlib import Path

p=Path('app.js')
s=p.read_text()
old="function hq(){const [rank,grade]=companyRank(),active=(S.expeditions||[]).filter(e=>e.active),pending=totalPending(),cap=capacity(),used=inventoryUsed(),crafting=(S.craftJobs||[]).filter(x=>x.status==='running').length,selling=(S.sellJobs||[]).some(x=>x.status==='running');return `\n<section class=\"office-banner\"><div><span class=\"office-eyebrow\">HERO EXTERMINATION INC.</span><h2>${esc(S.account?.username||'사장')} 대표 본부</h2><p>${rank} · ${grade}등급</p></div><div class=\"office-badge\"><b>${active.length}</b><small>작전</small></div></section>\n<section class=\"facility-stack\">"
new="function hq(){const active=(S.expeditions||[]).filter(e=>e.active),pending=totalPending(),cap=capacity(),used=inventoryUsed(),crafting=(S.craftJobs||[]).filter(x=>x.status==='running').length,selling=(S.sellJobs||[]).some(x=>x.status==='running');return `\n<section class=\"facility-stack\">"
if old not in s:
    raise SystemExit('HQ banner target not found')
s=s.replace(old,new,1)
p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('v0.11.2','v0.11.3').replace('?v=0112','?v=0113')
idx.write_text(h)
