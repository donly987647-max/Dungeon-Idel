// Active chapter equipment. Historical items stay owned but leave the drop pool.
export const equipmentRules={normalChance:0.003,rareMaterialChance:0.0015,epicMaterialChance:0.0005,legendaryChance:0.001};
const tiers=[['일반','수습',1],['희귀','침투',1.4],['희귀','수호',1.4],['영웅','특무',1.9],['영웅','야간',1.9],['전설','대표',2.5]];
const labels=[['산골','몽둥이','작업복','출근증'],['소국','보급검','호위복','계약패'],['왕국','결재검','기사갑주','인사인장'],['성채','공성망치','근위갑주','휴가증'],['왕도','박멸검','대표갑주','법인인장']];
const catalysts=[['산골 자경단 인장','산골 새벽의 심장'],['소국 용병 계약핵','소국 맹세의 심장'],['왕국 기사단 인장','왕국 명예의 심장'],['성채 근위대 인장','성채 철벽의 심장'],['왕도 영웅 인장','왕도 여명의 심장']];
export function equipmentFor(chapter,index){
 const [prefix,...parts]=labels[index],slots=['weapon','armor','accessory'],items=[],recipes=[],materials=[];
 for(const [n,id] of catalysts[index].entries())materials.push({id,kind:'material',rarity:n?'영웅':'희귀',sale_gold:0,sell_seconds:0,description:`${chapter.name}의 일반 적이 매우 드물게 남기는 ${n?'영웅':'희귀'} 장비 제작 재료. 자동 판매하지 않습니다.`,acquisition:{site:chapter.id,source:'kill',catalyst:true,version:16},art_key:n?'epic-catalyst':'rare-catalyst'});
 tiers.forEach(([rarity,theme,mult],ti)=>slots.forEach((slot,si)=>{
  const id=`${prefix} ${theme} ${parts[si]}`,atk=[8,16,26,41,62][index],def=[6,11,20,30,45][index],hp=[30,60,90,140,200][index];
  const support=ti===2||ti===4;
  const stats=slot==='weapon'?{atk:Math.round(atk*mult*(support?.9:1)),hp:support?Math.round(hp*.35):0,crit:ti===1||ti===3?.025:0}:slot==='armor'?{def:Math.round(def*mult*(support?1.1:1)),hp:Math.round(hp*mult*(support?1.15:1)),spd:ti===1||ti===3?1:0}:{hp:Math.round(hp*.65*mult),atk:support?0:Math.round((3+index*3)*mult),def:support?Math.round(def*.45*mult):0,spd:1+index,evade:support?.025:0};
  const crafted=rarity==='희귀'||rarity==='영웅';
  items.push({id,kind:'equipment',slot,rarity,...stats,sale_gold:0,sell_seconds:0,art_key:`${slot}-${chapter.art}-${rarity==='전설'?'legendary':'crafted'}`,description:`${chapter.name} ${theme} 부서의 ${parts[si]}. ${support?'생존과 장기 근무':'공격과 빠른 계약 완료'}에 특화된 장비.`,acquisition:{site:chapter.id,source:crafted?'craft':'kill',bossExclusive:rarity==='전설',version:16,variant:theme}});
  if(crafted)recipes.push({id:`gear_${chapter.id}_${ti}_${slot}`,output_item:id,output_qty:1,inputs:{[catalysts[index][rarity==='영웅'?1:0]]:rarity==='영웅'?2:1,[chapter.ground[si]]:rarity==='영웅'?10:6,[chapter.enemies[si].materials[0]]:rarity==='영웅'?12:8,'강화석':rarity==='영웅'?10:3},sale_gold:0,craft_seconds:rarity==='영웅'?10800+index*1800:1800+index*450,sell_seconds:0,workshop_level:Math.max(1,Math.ceil((index+1)/2)),sort_order:300+(index*18)+ti*3+si});
 }));
 return {items,recipes,materials};
}
