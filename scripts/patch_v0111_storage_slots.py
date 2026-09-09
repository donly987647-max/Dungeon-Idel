from pathlib import Path

# v0.11.1: storage capacity counts occupied item types, not stack quantity.
p=Path('app.js')
s=p.read_text()
old="const inventoryUsed=()=>Number((S?.inventory||[]).reduce((a,x)=>a+Number(x.qty||0),0));"
new="const inventoryUsed=()=>Number((S?.inventory||[]).filter(x=>Number(x.qty||0)>0).length);"
if old not in s:
    raise SystemExit('inventoryUsed target not found')
s=s.replace(old,new,1)
p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('v0.11.0','v0.11.1').replace('?v=0110','?v=0111')
idx.write_text(h)
