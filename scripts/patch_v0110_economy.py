from pathlib import Path
import re

p=Path('app.js')
s=p.read_text()

# Party battle logs should represent the full expedition, not only its legacy leader.
s=s.replace("<b class=\"ally\">${esc(m.name)}</b> vs", "<b class=\"ally\">${esc(partyLabel(e))}</b> vs")
s=s.replace("<b class=\"ally\">${esc(m.name)}</b> 피해", "<b class=\"ally\">${esc(partyLabel(e))}</b> 피해")

# Watch screen: make party size explicit while retaining the lead sprite for compactness.
s=s.replace("<span class=\"battle-name\">${esc(m?.name||'몬스터')}</span>", "<span class=\"battle-name\">${esc(partyLabel(e))} · ${partyOf(e).length}인</span>", 1)

# Item detail: crafted products go to shop; raw materials go to workshop.
old="""function itemModal(itemId){const inv=(S.inventory||[]).find(x=>x.item_id===itemId),d=itemDef(itemId);if(!inv)return;if(!d?.slot){modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">WAREHOUSE ITEM</div><h2>${esc(itemId)}</h2><p>보유 ${fmt(inv.qty)}개</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"material-detail\">${itemSvg(itemAsset(itemId))}<b>재료/전리품</b><p>현재는 장착할 수 없습니다. 향후 제작·판매 시스템에서 사용됩니다.</p></div>`);return}"""
new="""function itemModal(itemId){const inv=(S.inventory||[]).find(x=>x.item_id===itemId),d=itemDef(itemId),recipe=recipeForOutput(itemId);if(!inv)return;if(!d?.slot){if(recipe){modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">FINISHED GOODS</div><h2>${esc(itemId)}</h2><p>완제품 · 보유 ${fmt(inv.qty)}개</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"material-detail\">${itemSvg(itemAsset(itemId))}<b>판매가 ${fmt(recipe.sale_gold)}G</b><p>상점 판매 ${secText(recipe.sell_seconds)} · 판매가와 동일한 기준으로 시간이 책정됩니다.</p><button class=\"primary-btn\" data-action=\"shop\">상점으로 이동</button></div>`);return}const used=(S.recipes||[]).filter(r=>Object.prototype.hasOwnProperty.call(r.inputs||{},itemId));modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">CRAFT MATERIAL</div><h2>${esc(itemId)}</h2><p>제작 재료 · 보유 ${fmt(inv.qty)}개</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"material-detail\">${itemSvg(itemAsset(itemId))}<b>제작소 원재료</b><p>${used.length?`사용처: ${used.map(r=>esc(r.output_item)).join(' · ')}`:'현재 등록된 제작법에는 사용되지 않습니다.'}</p><button class=\"primary-btn\" data-action=\"workshop\">제작소로 이동</button></div>`);return}"""
if old not in s: raise SystemExit('item modal block missing')
s=s.replace(old,new,1)

# Add economy facilities to menu.
s=s.replace("<button data-go=\"loot\">전리품 창고</button><button class=\"logout\"", "<button data-go=\"loot\">전리품 창고</button><button data-action=\"workshop\">제작소</button><button data-action=\"shop\">상점</button><button class=\"logout\"")

# Preserve selected count before closeModal clears partyPick.
old_deploy="""if(a==='deploy-party'){await api('deploy',{monsterIds:partyPick,siteId:b.dataset.site});closeModal();toast(`${partyPick.length||'파티'}마리 박멸조 출정`);render()}"""
new_deploy="""if(a==='deploy-party'){const partyCount=partyPick.length;await api('deploy',{monsterIds:[...partyPick],siteId:b.dataset.site});closeModal();toast(`${partyCount}마리 박멸조 출정`);render()}"""
if old_deploy not in s: raise SystemExit('deploy handler missing')
s=s.replace(old_deploy,new_deploy,1)

p.write_text(s)
