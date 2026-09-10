/* Shared sprite-atlas rendering. No DOM observers or image pixel mutations. */
(()=>{
  const chapters=['mountain_village','farm_road','border_outpost','grand_castle','hero_kingdom'];
  const legends=['베르크의 퇴근 종','민원 반사 조끼','브란의 계약 파기검','무기한 호위 계약서','부관의 결재 대검','반려 불가 철갑','발레리의 성문 절단검','기적의 유급 휴가증','아우렐의 사직서','용사 박멸 대표이사 인장'];
  function enemyCell(name){
    const site=(S?.sites||[]).find(s=>s.chapter?.version>=15&&[...s.enemy_names,s.boss_name].includes(name));
    if(!site)return null;
    return [name===site.boss_name?4:site.enemy_names.indexOf(name),chapters.indexOf(site.id)];
  }
  function itemCell(name){
    let i=legends.indexOf(name);if(i>=0)return [i%4,Math.floor(i/4)];
    if(name==='강화석')i=15;
    else if(/나무 조각|장작|목재/.test(name))i=10;
    else if(/천$|천 조각|자투리|벽지/.test(name))i=11;
    else if(/동전|은화|금화|회비/.test(name))i=12;
    else if(/석궁|단궁|돌팔매/.test(name))i=13;
    else if(/방패/.test(name))i=14;
    return i>=0?[i%4,Math.floor(i/4)]:null;
  }
  function sprite(file,cell,count,cls){
    return `<span class="campaign-sprite ${cls}" aria-hidden="true" style="background-image:url('assets/art-v015/${file}.webp');background-size:${count*100}% ${count*100}%;background-position:${cell[0]*100/(count-1)}% ${cell[1]*100/(count-1)}%"></span>`;
  }
  window.CampaignArt={enemyCell,itemCell,
    enemy:(name,cls='')=>{const cell=enemyCell(name);return cell?sprite('enemies',cell,5,'pixel-char campaign-foe '+cls):''},
    item:(name,cls='')=>{const cell=itemCell(name);return cell?sprite('items',cell,4,'pixel-item campaign-item '+cls):''}};
})();
