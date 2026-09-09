/* v0.11.7 Equipment UX
 * Equipment management belongs to the monster detail flow.
 * Warehouse equipment cards are informational only.
 */
(()=>{
  const slotByLabel={무기:'weapon',방어구:'armor',장신구:'accessory'};
  const rarityRank={영웅:4,희귀:3,고급:2,일반:1};

  function bonusText(d){
    if(!d)return '능력치 정보 없음';
    return [
      Number(d.atk)&&`공격 +${fmt(d.atk)}`,
      Number(d.def)&&`방어 +${fmt(d.def)}`,
      Number(d.hp)&&`HP +${fmt(d.hp)}`,
      Number(d.spd)&&`속도 ${Number(d.spd)>0?'+':''}${fmt(d.spd)}`,
      Number(d.crit)&&`치명 +${Math.round(Number(d.crit)*100)}%`,
      Number(d.evade)&&`회피 +${Math.round(Number(d.evade)*100)}%`,
      Number(d.human_damage)&&`인간 피해 +${Math.round(Number(d.human_damage)*100)}%`
    ].filter(Boolean).join(' · ')||'특수 능력 없음';
  }

  function ownedEquipment(slot){
    return (S?.inventory||[])
      .filter(x=>Number(x.qty||0)>0&&itemDef(x.item_id)?.slot===slot)
      .map(x=>({row:x,def:itemDef(x.item_id)}))
      .sort((a,b)=>(rarityRank[b.def?.rarity]||0)-(rarityRank[a.def?.rarity]||0)||String(a.row.item_id).localeCompare(String(b.row.item_id),'ko'));
  }

  window.gearPickerModal=function(monsterId,slot){
    const m=(S?.monsters||[]).find(x=>x.id===monsterId);
    if(!m||!['weapon','armor','accessory'].includes(slot))return;
    const current=equippedFor(monsterId).find(x=>x.slot===slot);
    const currentDef=current&&itemDef(current.item_id);
    const owned=ownedEquipment(slot);
    const rows=owned.length?owned.map(({row,def})=>`<button class="gear-choice ${rarityClass(def?.rarity)}" data-equipment-action="equip" data-monster="${esc(monsterId)}" data-item="${esc(row.item_id)}"><span class="gear-choice-icon">${itemSvg(itemAsset(row.item_id))}</span><span class="gear-choice-copy"><b>${esc(row.item_id)}</b><small>${esc(def?.rarity||'일반')} · ${esc(bonusText(def))}</small><em>보유 ${fmt(row.qty)}개</em></span><strong>${current?.item_id===row.item_id?'장착 중':'장착'}</strong></button>`).join(''):`<div class="equipment-empty"><b>보유 중인 ${slotName(slot)}가 없습니다.</b><small>박멸 작전에서 장비를 획득하면 이곳에 표시됩니다.</small></div>`;

    modal(`<div class="sheet-head"><div><div class="section-kicker">EQUIPMENT LOADOUT</div><h2>${esc(m.name)} · ${slotName(slot)}</h2><p>보유 장비를 선택해 즉시 장착하거나 현재 장비를 해제합니다.</p></div><button class="close-btn" data-action="close">×</button></div>
      <section class="current-equipment-card ${currentDef?rarityClass(currentDef.rarity):'empty'}">
        <header><b>현재 장착</b><small>${slotName(slot)}</small></header>
        ${currentDef?`<div class="current-equipment-row"><span>${itemSvg(itemAsset(currentDef.id))}</span><span><b>${esc(currentDef.id)}</b><small>${esc(currentDef.rarity||'일반')} · ${esc(bonusText(currentDef))}</small></span><button class="danger-btn" data-equipment-action="unequip" data-monster="${esc(monsterId)}" data-slot="${slot}">해제</button></div>`:`<div class="equipment-empty compact"><b>비어 있음</b><small>아래 보유 장비에서 선택하세요.</small></div>`}
      </section>
      <div class="equipment-list-head"><b>보유 ${slotName(slot)}</b><small>${owned.reduce((a,x)=>a+Number(x.row.qty||0),0)}개</small></div>
      <div class="gear-choice-list">${rows}</div>
      <button class="soft-btn equipment-back" data-equipment-action="back" data-monster="${esc(monsterId)}">${esc(m.name)} 상세로 돌아가기</button>`,'equipment-picker-sheet');
  };

  function warehouseEquipmentModal(itemId){
    const inv=(S?.inventory||[]).find(x=>x.item_id===itemId);
    const d=itemDef(itemId);
    if(!inv||!d?.slot)return;
    modal(`<div class="sheet-head"><div><div class="section-kicker">EQUIPMENT STORAGE</div><h2>${esc(itemId)}</h2><p>${esc(d.rarity||'일반')} · ${slotName(d.slot)} · 보유 ${fmt(inv.qty)}개</p></div><button class="close-btn" data-action="close">×</button></div>
      <div class="equipment-detail ${rarityClass(d.rarity)}"><div class="equipment-icon">${itemSvg(itemAsset(itemId))}</div><div><b>${esc(bonusText(d))}</b><p>${esc(d.description||'')}</p></div></div>
      <div class="equipment-storage-note"><b>장착은 몬스터에서 관리합니다.</b><p>몬스터를 선택한 뒤 무기·방어구·장신구 슬롯을 눌러 장착하거나 교체하세요.</p></div>
      <button class="primary-btn equipment-go-monsters" data-go="monsters">몬스터 목록으로 이동</button>`,'item-detail-sheet-v10 equipment-storage-sheet');
  }

  async function doEquip(monsterId,itemId){
    if(busy)return;
    busy=true;
    try{
      await api('equip',{monsterId,itemId});
      employeeModal(monsterId);
      toast('장비를 장착했습니다.');
    }catch(err){toast(errorKo(err.message))}
    finally{busy=false}
  }

  async function doUnequip(monsterId,slot){
    if(busy)return;
    busy=true;
    try{
      await api('unequip',{monsterId,slot});
      employeeModal(monsterId);
      toast('장비를 해제했습니다.');
    }catch(err){toast(errorKo(err.message))}
    finally{busy=false}
  }

  document.addEventListener('click',e=>{
    const custom=e.target.closest('[data-equipment-action]');
    if(custom){
      e.preventDefault();
      e.stopPropagation();
      const action=custom.dataset.equipmentAction;
      if(action==='equip')doEquip(custom.dataset.monster,custom.dataset.item);
      else if(action==='unequip')doUnequip(custom.dataset.monster,custom.dataset.slot);
      else if(action==='back')employeeModal(custom.dataset.monster);
      return;
    }

    const oldUnequip=e.target.closest('.monster-detail-sheet-v10 [data-action="unequip"]');
    if(oldUnequip){
      e.preventDefault();
      e.stopPropagation();
      doUnequip(oldUnequip.dataset.id,oldUnequip.dataset.slot);
      return;
    }

    const gear=e.target.closest('.monster-detail-sheet-v10 .gear-grid .gear-slot');
    if(gear){
      e.preventDefault();
      e.stopPropagation();
      const sheet=gear.closest('.monster-detail-sheet-v10');
      const monsterId=sheet?.querySelector('[data-action="personality"]')?.dataset.id;
      const label=gear.querySelector('small')?.textContent?.trim();
      const index=[...sheet.querySelectorAll('.gear-grid .gear-slot')].indexOf(gear);
      const slot=slotByLabel[label]||['weapon','armor','accessory'][index];
      if(monsterId&&slot)gearPickerModal(monsterId,slot);
      return;
    }

    const inventoryItem=e.target.closest('.inventory-slot[data-action="item"]');
    if(inventoryItem){
      const d=itemDef(inventoryItem.dataset.id);
      if(d?.slot){
        e.preventDefault();
        e.stopPropagation();
        warehouseEquipmentModal(inventoryItem.dataset.id);
      }
    }
  },true);
})();
