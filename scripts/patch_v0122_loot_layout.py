from pathlib import Path

css_path=Path('app.css')
css=css_path.read_text(encoding='utf-8')
repls={
'.compact-mission{height:142px}':'.compact-mission{height:auto;min-height:154px}',
'.compact-mission .mission-file{padding:9px 10px}':'.compact-mission .mission-file{padding:9px 10px;grid-template-rows:auto minmax(42px,1fr) auto}',
'.compact-mission .mission-foot{grid-template-columns:minmax(0,1fr) 54px;gap:6px}':'.compact-mission .mission-foot{grid-template-columns:minmax(0,1fr);gap:7px;align-items:stretch}',
'.compact-mission .mission-cta{width:54px;min-width:54px;height:34px}':'.compact-mission .mission-cta{width:100%;min-width:0;height:auto;display:block}',
'.mission-cta{min-width:146px;display:flex;justify-content:flex-end;align-items:flex-end}':'.mission-cta{min-width:0;display:flex;justify-content:flex-end;align-items:flex-end}',
'.chapter-loot-btn{min-height:38px;':'.chapter-loot-btn{width:100%;min-height:42px;',
'@media(max-width:430px){.mission-foot{gap:7px}.mission-cta{min-width:126px}.chapter-loot-btn{font-size:9px;padding:6px 7px}.chapter-loot-btn strong{font-size:10px}}':'@media(max-width:430px){.mission-foot{gap:7px}.mission-cta{min-width:0;width:100%}.chapter-loot-btn{font-size:9px;padding:7px 8px}.chapter-loot-btn strong{font-size:10px}}'
}
for old,new in repls.items():
    if old not in css:
        raise SystemExit(f'missing css marker: {old}')
    css=css.replace(old,new,1)
css_path.write_text(css,encoding='utf-8')

index_path=Path('index.html')
html=index_path.read_text(encoding='utf-8')
html=html.replace('v0.12.1','v0.12.2').replace('0121b','0122a')
index_path.write_text(html,encoding='utf-8')
