from pathlib import Path

p=Path('app.js')
s=p.read_text()

s=s.replace('S.craftCapacity||6','S.craftCapacity||5')
s=s.replace('S.shopCapacity||6','S.shopCapacity||5')

s=s.replace('작업 ${craftJobs.length}/${S.craftCapacity||5} · 대기열 ${Math.max(0,Number(S.craftCapacity||5)-1)}','작업 ${craftJobs.length}/${S.craftCapacity||5} · 총 대기열 ${S.craftCapacity||5}')
s=s.replace('판매 ${sellJobs.length}/${S.shopCapacity||5} · 대기열 ${Math.max(0,Number(S.shopCapacity||5)-1)}','판매 ${sellJobs.length}/${S.shopCapacity||5} · 총 대기열 ${S.shopCapacity||5}')
s=s.replace('<b>현재 작업 1개 + 대기열 ${Math.max(0,cap-1)}개</b>','<b>총 대기열 ${cap}개 · 현재 작업 포함</b>',1)
s=s.replace('<b>현재 판매 1개 + 대기열 ${Math.max(0,cap-1)}개</b>','<b>총 대기열 ${cap}개 · 현재 판매 포함</b>',1)
s=s.replace('제작소 레벨은 제작법이 아니라 <b>대기열</b>을 늘립니다.','제작소 레벨은 제작법이 아니라 <b>총 대기열 수</b>를 늘립니다.')

old="function render(){if(!S)return;updateChrome();const v=$('#view'),changed=lastAnimatedScreen!==screen;v.innerHTML=screen==='home'?hq():screen==='monsters'?monsters():screen==='hunt'?hunt():loot();if(changed){v.classList.remove('view-enter');void v.offsetWidth;v.classList.add('view-enter');lastAnimatedScreen=screen;setTimeout(()=>v.classList.remove('view-enter'),280)}requestAnimationFrame(()=>{paintCanvases();updateEconomyProgress()});updateCandidateTimer()}"
new="function render(){if(!S)return;updateChrome();const v=$('#view'),changed=lastAnimatedScreen!==screen;v.innerHTML=screen==='home'?hq():screen==='monsters'?monsters():screen==='hunt'?hunt():loot();if(changed){v.scrollTop=0;v.classList.remove('view-enter');void v.offsetWidth;v.classList.add('view-enter');lastAnimatedScreen=screen;setTimeout(()=>v.classList.remove('view-enter'),280)}requestAnimationFrame(()=>{paintCanvases();updateEconomyProgress()});updateCandidateTimer()}"
if old not in s:
    raise SystemExit('render target missing')
s=s.replace(old,new,1)

p.write_text(s)
