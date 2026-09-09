from pathlib import Path
src=Path('scripts/patch_v0112_polish.py').read_text()
old='''rep("const inventoryUsed=()=>Number((S?.inventory||[]).reduce((a,x)=>a+Number(x.qty||0),0));",\n    "const inventoryUsed=()=>Number((S?.inventory||[]).filter(x=>Number(x.qty||0)>0).length);",'storage slots')\n'''
if old not in src:
    raise SystemExit('storage patch block not found')
src=src.replace(old,"# storage slot logic already applied in v0.11.1\n",1)
exec(compile(src,'patch_v0112_polish.py','exec'))
