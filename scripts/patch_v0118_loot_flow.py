from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"{label}: marker not found")
    return text.replace(old, new, 1)


app = Path("app.js")
s = app.read_text()

s = replace_once(
    s,
    "const inventoryUsed=()=>Number((S?.inventory||[]).filter(x=>Number(x.qty||0)>0).length);",
    "const inventoryUsed=()=>Number((S?.inventory||[]).filter(x=>Number(x.qty||0)>0).length);\n"
    "const inventoryTotal=()=>Number((S?.inventory||[]).reduce((a,x)=>a+Math.max(0,Number(x.qty||0)),0));\n"
    "const siteExpeditions=sid=>(S?.expeditions||[]).filter(e=>e.site_id===sid);\n"
    "const sitePending=sid=>siteExpeditions(sid).reduce((a,e)=>a+lootCount(e),0);\n"
    "const expeditionPendingXp=e=>Object.values(e?.pending_xp||{}).reduce((a,b)=>a+Math.max(0,Number(b||0)),0);\n"
    "const siteHasCollectable=sid=>siteExpeditions(sid).some(e=>lootCount(e)>0||expeditionPendingXp(e)>0);",
    "inventory helpers",
)

s = replace_once(
    s,
    'data-go="loot"><img src="assets/icon-storage.svg"',
    'data-action="warehouse"><img src="assets/icon-storage.svg"',
    "HQ warehouse action",
)

s = replace_once(
    s,
    '${pending}개 회수 대기 · ${used}/${S.storageCapacity||40}',
    '${fmt(inventoryTotal())}개 보관 · ${inventoryUsed()}종',
    "HQ warehouse copy",
)

s = replace_once(
    s,
    "const ex=activeAt(site.id),unlocked=!!site.unlocked,pending=ex.reduce((a,e)=>a+lootCount(e),0),wins=Number(site.progress?.normal_wins||0)",
    "const ex=activeAt(site.id),unlocked=!!site.unlocked,pending=sitePending(site.id),collectable=siteHasCollectable(site.id),wins=Number(site.progress?.normal_wins||0)",
    "hunt pending source",
)

s = replace_once(
    s,
    '<div class="mission-cta"><b>${unlocked?(ex.length?\'현장\':\'상세\'):\'잠김\'}</b></div>',
    '<div class="mission-cta"><button class="chapter-loot-btn" data-action="collect-site" data-site="${site.id}" ${collectable?\'\':\'disabled\'}>전리품 수거 <strong>(${fmt(pending)}/3000)</strong></button></div>',
    "chapter loot button",
)

insert = r'''function warehouseModal(){const total=inventoryTotal(),types=inventoryUsed();modal(`<div class="sheet-head"><div><div class="section-kicker">WAREHOUSE</div><h2>창고</h2><p>보유 ${fmt(total)}개 · ${fmt(types)}종</p></div><button class="close-btn" data-action="close">×</button></div><div class="warehouse-popup-note">전리품 수거는 <b>박멸 챕터 카드</b>에서 진행합니다.</div><div class="inventory-grid warehouse-popup-grid">${(S.inventory||[]).filter(x=>Number(x.qty||0)>0).length?(S.inventory||[]).filter(x=>Number(x.qty||0)>0).map(x=>{const d=itemDef(x.item_id),r=recipeForOutput(x.item_id);return `<button class="inventory-slot ${d?.slot?'equippable '+rarityClass(d.rarity):r?'crafted':''}" data-action="item" data-id="${esc(x.item_id)}"><div class="item-art small">${itemSvg(itemAsset(x.item_id))}</div><b>${esc(x.item_id)}</b><small>${fmt(x.qty)}개${d?.slot?' · '+slotName(d.slot):r?' · 판매품':''}</small></button>`}).join(''):'<div class="empty-state" style="grid-column:1/-1">창고가 비어 있습니다.</div>'}</div><div class="dim-close-hint">바깥 영역을 눌러 닫기</div>`,'warehouse-popup-sheet')}

function collectionDurationText(seconds){const n=Math.max(0,Math.floor(Number(seconds||0))),h=Math.floor(n/3600),m=Math.floor((n%3600)/60);return `${h}시간 ${m}분`}
function collectionResultModal(siteId,result){const site=(S?.sites||[]).find(x=>x.id===siteId),xpRows=Object.entries(result.xp||{}).filter(([,v])=>Number(v?.xp||0)>0),lootRows=Object.entries(result.loot||{}).filter(([,q])=>Number(q)>0);modal(`<div class="collection-result-head"><div><div class="section-kicker">BATTLE RESULT</div><h2>${collectionDurationText(result.durationSeconds)} 전투 결과</h2><p>${esc(site?.name||'박멸 지역')} · 전리품 수거 완료</p></div></div><section class="collection-xp"><header><b>몬스터 성장</b><small>실제 획득 XP</small></header>${xpRows.length?xpRows.map(([id,v])=>`<div class="collection-xp-row"><span>${charSvg(monsterAsset(v.family||'slime'),'collection-monster')}</span><b>${esc(v.name||'몬스터')}</b><strong>XP +${fmt(v.xp)}</strong></div>`).join(''):'<div class="collection-empty">이번 수거 구간에서 획득한 XP가 없습니다.</div>'}</section><section class="collection-loot"><header><b>획득 전리품</b><small>총 ${fmt(lootRows.reduce((a,[,q])=>a+Number(q||0),0))}개</small></header><div class="collection-loot-list">${lootRows.length?lootRows.map(([id,q])=>`<div class="collection-loot-row"><span>${itemSvg(itemAsset(id))}</span><b>${esc(id)}</b><strong>× ${fmt(q)}</strong></div>`).join(''):'<div class="collection-empty">획득한 전리품이 없습니다.</div>'}</div></section><div class="dim-close-hint">바깥 영역을 눌러 닫기</div>`,'collection-result-sheet')}
async function collectSiteLoot(siteId){if(busy)return;const before=siteExpeditions(siteId).filter(e=>lootCount(e)>0||expeditionPendingXp(e)>0);if(!before.length){toast('수거할 전리품이 없습니다.');return}const snapshotMonsters=new Map((S?.monsters||[]).map(m=>[m.id,{name:m.name,family:m.family}])),xp={},loot={};let durationSeconds=0;for(const e of before){const start=new Date(e.last_loot_collected_at||e.started_at||Date.now()).getTime(),end=e.active?Date.now():new Date(e.updated_at||Date.now()).getTime();if(Number.isFinite(start)&&Number.isFinite(end))durationSeconds=Math.max(durationSeconds,Math.max(0,(end-start)/1000));for(const [mid,amount] of Object.entries(e.pending_xp||{})){const n=Math.max(0,Number(amount||0));if(!n)continue;const meta=snapshotMonsters.get(mid)||{};if(!xp[mid])xp[mid]={xp:0,name:meta.name||'몬스터',family:meta.family||'slime'};xp[mid].xp+=n}}try{busy=true;for(const e of before){const d=await api('collect',{expeditionId:e.id});for(const [id,q] of Object.entries(d.collected||{}))loot[id]=(loot[id]||0)+Number(q||0)}render();collectionResultModal(siteId,{durationSeconds,xp,loot})}catch(err){toast(errorKo(err.message))}finally{busy=false}}

'''

if "function menuModal(){" not in s:
    raise RuntimeError("menuModal marker not found")
s = s.replace("function menuModal(){", insert + "function menuModal(){", 1)

s = replace_once(
    s,
    '<button data-go="loot">전리품 창고</button>',
    '<button data-action="warehouse">전리품 창고</button>',
    "menu warehouse action",
)

s = replace_once(
    s,
    "if(a==='shop'){shopModal();return}if(a==='employee')",
    "if(a==='shop'){shopModal();return}if(a==='warehouse'){warehouseModal();return}if(a==='collect-site'){collectSiteLoot(b.dataset.site);return}if(a==='employee')",
    "action routes",
)

s = replace_once(
    s,
    "document.addEventListener('click',async e=>{const nav=e.target.closest('[data-screen]');",
    "document.addEventListener('click',async e=>{if(e.target?.id==='modal'&&!e.target.classList.contains('hidden')){closeModal();return}const nav=e.target.closest('[data-screen]');",
    "modal backdrop close",
)

app.write_text(s)

css = Path("app.css")
c = css.read_text()
if "/* v0.11.8 chapter loot collection + popup warehouse */" not in c:
    c += r'''

/* v0.11.8 chapter loot collection + popup warehouse */
.bottom-nav .nav-placeholder{display:block;border-right:1px solid #2d352e;min-width:0}
.mission-cta{min-width:146px;display:flex;justify-content:flex-end;align-items:flex-end}
.chapter-loot-btn{min-height:38px;border:1px solid #a56e38;background:linear-gradient(180deg,#6f4b2a,#49301d);color:#f6d19b;padding:7px 9px;font-size:10px;font-weight:900;line-height:1.2;text-align:center;box-shadow:inset 0 0 0 1px #25180f}
.chapter-loot-btn strong{display:block;margin-top:2px;color:#fff0ca;font-size:11px}
.chapter-loot-btn:disabled{filter:grayscale(.75);opacity:.44}
.warehouse-popup-sheet,.collection-result-sheet{max-height:min(82vh,720px);overflow:auto}
.warehouse-popup-note{margin:0 0 10px;padding:10px;border:1px solid #455047;background:#141915;color:#9da89f;font-size:10px;line-height:1.55}
.warehouse-popup-note b{color:#efbb78}
.warehouse-popup-grid{padding-bottom:8px}
.dim-close-hint{text-align:center;color:#677269;font-size:9px;padding:13px 0 2px}
.collection-result-head{padding:18px 17px 12px;border-bottom:1px solid #3a443c;background:linear-gradient(180deg,#272e28,#171c18)}
.collection-result-head h2{margin:3px 0 4px;font-size:22px}
.collection-result-head p{margin:0;color:#8e9a90;font-size:10px}
.collection-xp,.collection-loot{margin:12px;border:1px solid #3e493f;background:#141915}
.collection-xp>header,.collection-loot>header{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-bottom:1px solid #343d35;background:#1d241e}
.collection-xp>header b,.collection-loot>header b{font-size:12px}
.collection-xp>header small,.collection-loot>header small{font-size:9px;color:#89948c}
.collection-xp-row,.collection-loot-row{min-height:48px;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #293129}
.collection-xp-row:last-child,.collection-loot-row:last-child{border-bottom:0}
.collection-xp-row>span,.collection-loot-row>span{width:38px;height:38px;display:grid;place-items:center;background:#0d110e;border:1px solid #354038}
.collection-xp-row svg,.collection-loot-row svg{width:34px;height:34px;image-rendering:pixelated}
.collection-xp-row b,.collection-loot-row b{font-size:11px}
.collection-xp-row strong{color:#9ed18f;font-size:12px}
.collection-loot-row strong{color:#efbb78;font-size:12px}
.collection-empty{padding:18px 12px;text-align:center;color:#747f76;font-size:10px}
@media(max-width:430px){.mission-foot{gap:7px}.mission-cta{min-width:126px}.chapter-loot-btn{font-size:9px;padding:6px 7px}.chapter-loot-btn strong{font-size:10px}}
'''
css.write_text(c)

idx = Path("index.html")
h = idx.read_text().replace("v0.11.7", "v0.11.8").replace("?v=0117", "?v=0118")
old = '<button data-screen="loot"><span class="nav-pict crate"></span><b>창고</b></button>'
if old not in h:
    raise RuntimeError("bottom warehouse tab marker not found")
h = h.replace(old, '<span class="nav-placeholder" aria-hidden="true"></span>', 1)
idx.write_text(h)

print("v0.11.8 loot flow patch complete")
