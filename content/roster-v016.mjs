import {roster as previous} from './roster-v015.mjs';
// Stable family/form IDs keep every employee's ownership, gear and experience.
export const departments={
 slime:{name:'먹물 슬라임',job:'계약관리',story:'도장을 찍을수록 몸에 계약서 잉크가 스며드는 말랑한 신입.',skills:['잉크 흡수','연대보증'],paths:['계약 집행관','복지 회계사'],finals:['심연 계약왕','혈서 감사관','독소 추심관','수정 금고장','성역 회계장','천사 복지관'],base:'drain'},
 goblin:{name:'특급 배달 고블린',job:'기동영업',story:'용사의 등 뒤에도 정시 배송하는 계약서 배달원.',skills:['착불 급습','위조 주문서'],paths:['야간 배달원','주문 위조사'],finals:['그림자 특송왕','독촉장 사냥꾼','저주 공증인','폭풍 배송왕'],base:'damage'},
 troll:{name:'철야 트롤',job:'현장철거',story:'무거운 서류함도 한 손으로 옮기는 든든한 야간조.',skills:['초과근무 강타','안전모 의무화'],paths:['철야 철거반장','현장 안전반장'],finals:['분노의 철거왕','전쟁 하도급왕','요새 안전감독','흑요석 노무사'],base:'guard'},
 mandrake:{name:'구급 만드라고라',job:'직원복지',story:'화분 속 약초와 따뜻한 차로 동료의 근무를 이어준다.',skills:['단체 건강검진','가시 처방전'],paths:['달빛 보건실장','가시 산업의'],finals:['성역 복지본부장','정령 재활원장','선혈 약제사','진혼 주치의'],base:'heal_all'},
 pixie:{name:'결재 픽시',job:'긴급지원',story:'작은 날개로 날아다니며 가장 급한 결재부터 처리한다.',skills:['긴급 승인','반려 도장'],paths:['새벽 결재비서','야간 감사비서'],finals:['이슬 비서실장','별빛 의전장','적색 감사실장','가시 감찰관'],base:'heal'},
 imp:{name:'화로 임프',job:'마력설비',story:'커피를 끓이던 화로로 용사의 갑옷까지 녹이는 기술자.',skills:['보일러 과열','차원 누전'],paths:['화염 설비기사','공허 정비기사'],finals:['지옥 기관장','잿불 발전소장','심연 배관장','영점 제어실장'],base:'magic'},
 wisp:{name:'전등 위습',job:'정보통신',story:'낡은 탁상등 속에서 사내 마력망을 연결하는 작은 유령.',skills:['정전 통보','비상등 점등'],paths:['폭풍 통신기사','유령 관제기사'],finals:['뇌운 관제실장','번개 방송국장','황천 네트워크장','프리즘 신호원'],base:'magic'},
 golem:{name:'금고 골렘',job:'자산보안',story:'동료를 지키는 일이 금고를 지키는 것보다 중요하다고 배웠다.',skills:['금고 잠금','담보 압류'],paths:['금고 보안대장','압류 집행대장'],finals:['절대금고 수호장','야간 경비총장','성벽 담보관리인','흑요석 집행관'],base:'guard'},
 mimic:{name:'택배 미믹',job:'반품처리',story:'개봉한 인간에게 반품 불가 조항을 직접 설명하는 상자.',skills:['반품 불가','내용물 압수'],paths:['보험 반품담당','먹보 압수담당'],finals:['왕실 반품센터장','비밀금고 보관장','선혈 추징관','대식 회수본부장'],base:'drain'},
};
export const roster=previous.map(r=>({...r,name:departments[r.family].name,description:departments[r.family].story,skill:`office_${r.family}_base`}));
export function buildOfficeRoster(baseline){
 const skills=[],evolutions=[],forms={};
 function skill(id,name,kind,tier,variant=0){
  const heal=kind==='heal'||kind==='heal_all',guard=kind==='guard';
  const s={id,name,trigger_type:'every_n',trigger_count:kind==='heal'?2:3,trigger_value:0,condition_value:0,effect_type:guard?'damage':kind,damage_multiplier:heal?1:1.4+tier*.35+(variant?.15:0),defense_ignore:kind==='magic'?.35+tier*.15:0,heal_ratio:kind==='heal'?.18+tier*.05:kind==='heal_all'?.07+tier*.025:kind==='drain'?.25+tier*.1:0,damage_reduction:guard?.18+tier*.045:0,taunt_weight:guard?3+tier*.5:1};
  s.description=`${s.trigger_count}번째 공격마다 ${kind==='heal'?`가장 다친 동료 HP ${Math.round(s.heal_ratio*100)}% 회복`:kind==='heal_all'?`생존 동료 전원 HP ${Math.round(s.heal_ratio*100)}% 회복`:kind==='drain'?`피해의 ${Math.round(s.heal_ratio*100)}% 흡수`:kind==='magic'?`방어 ${Math.round(s.defense_ignore*100)}% 관통 마법`:guard?`강타 · 항상 도발 ${s.taunt_weight}배와 피해 ${Math.round(s.damage_reduction*100)}% 감소`:`${s.damage_multiplier.toFixed(2)}배 강타`}.`;
  skills.push(s);return id;
 }
 for(const r of roster){
  const d=departments[r.family];skill(r.skill,d.skills[0],d.base,0);forms[r.family]={name:r.name,family:r.family,tier:0,branch:0,skill:r.skill};
  const first=baseline.evolutions.filter(e=>e.base_family===r.family&&e.from_form_id===r.family).sort((a,b)=>a.id.localeCompare(b.id));
  let finalIndex=0;
  first.forEach((old,bi)=>{
   const kind=bi===0?d.base:({slime:'heal_all',goblin:'magic',troll:'guard',mandrake:'magic',pixie:'magic',imp:'drain',wisp:'heal_all',golem:'damage',mimic:'guard'})[r.family];
   const name=d.paths[bi],sid=skill(`office_${old.target_form_id}`,d.skills[bi],kind,1);
   evolutions.push({...old,target_name:name,skill_id:sid,description:`${d.job} 전문화: ${skills.at(-1).description}`});
   forms[old.target_form_id]={name,family:r.family,tier:1,branch:bi,skill:sid};
   const children=baseline.evolutions.filter(e=>e.from_form_id===old.target_form_id).sort((a,b)=>a.id.localeCompare(b.id));
   children.forEach((last,ci)=>{
    const name=d.finals[finalIndex++]||`${d.job} 총괄`,effect=ci===0?kind:kind==='heal_all'?'heal':kind==='guard'?'drain':kind==='drain'?'guard':kind;
    const sid=skill(`office_${last.target_form_id}`,`${name}의 ${ci===0?'특별결재':'비상조항'}`,effect,2,ci);
    evolutions.push({...last,target_name:name,skill_id:sid,description:`${ci===0?'안정적인 장기 원정':'특수 대응과 강력한 한 수'}. ${skills.at(-1).description}`});
    forms[last.target_form_id]={name,family:r.family,tier:2,branch:bi,variant:ci,skill:sid};
   });
  });
 }
 return {roster,departments,skills,evolutions,forms};
}
