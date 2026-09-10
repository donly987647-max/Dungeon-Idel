/* Pure planning estimates; actual combat is authoritative on PostgreSQL. */
((root)=>{
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const skillRate=s=>!s?0:s.trigger_type==='every_n'?1/Math.max(1,Number(s.trigger_count)):clamp(s.trigger_value,0,1)*(s.trigger_type==='hp_below_chance'?0.5:1);
  function assess(party,profile){
    const alive=party.filter(m=>m.hp>0);
    if(!alive.length)return {key:'empty',label:'파티를 선택하세요',reasons:['선택한 직원의 장비·스킬·현재 HP로 보스 대응력을 확인합니다.']};
    const n=alive.length,hpScale=.8+.35*(n-1),atkScale=.9+.2*(n-1),enemyHp=profile.hp*hpScale,enemyAtk=profile.atk*atkScale;
    const enemySkill=profile.skill||{},period=Math.max(1,Number(enemySkill.every||999)),skillFraction=1/period;
    const weights=alive.map(m=>Math.max(.1,Number(m.skill?.taunt_weight||1))),weightSum=weights.reduce((a,b)=>a+b,0);
    let damage=0,healing=0;
    alive.forEach(m=>{
      const s=m.stats,k=m.skill,p=skillRate(k),hit=1-clamp(profile.evade+Math.max(0,profile.spd-s.spd)*.002,0,.35),crit=1+clamp(s.crit,0,.45)*.7;
      const base=Math.max(1,s.atk*(1+s.human)-profile.def*.55);
      const proc=Math.max(1,s.atk*(1+s.human)*Number(k?.damage_multiplier||1)-profile.def*(k?.effect_type==='magic'?.38:.55)*(1-clamp(k?.defense_ignore,0,.9)));
      damage+=(base*(1-p)+proc*p)*hit*crit;
      if(k?.effect_type==='heal')healing+=Math.max(...alive.map(x=>x.stats.hp))*Number(k.heal_ratio||0)*p;
    });
    const enemyHealing=enemyHp*Number(enemySkill.heal||0)*skillFraction;
    const rounds=damage>enemyHealing?enemyHp/(damage-enemyHealing):Infinity;
    const survival=alive.map((m,i)=>{
      const s=m.stats,hit=1-clamp(s.evade+Math.max(0,s.spd-profile.spd)*.002,0,.35),reduction=1-clamp(m.skill?.damage_reduction,0,.55),share=weights[i]/weightSum;
      const base=Math.max(1,enemyAtk-s.def*.58),proc=Math.max(1,enemyAtk*Number(enemySkill.multiplier||1)-s.def*.58*(1-clamp(enemySkill.ignore,0,.9)));
      const incoming=(base*(1-skillFraction)+proc*skillFraction)*(1+Number(profile.crit||0)*.65)*hit*reduction*share;
      // Healing cannot be assumed perfectly timed or perfectly distributed.
      return m.hp/Math.max(1,incoming-healing*share*.65);
    });
    const margin=Math.min(...survival)/Math.max(1,rounds),hpRatio=alive.reduce((v,m)=>v+m.hp,0)/alive.reduce((v,m)=>v+m.stats.hp,0);
    const hasHealer=alive.some(m=>m.skill?.effect_type==='heal'),hasTank=alive.some(m=>m.skill?.effect_type==='tank');
    let key=margin>=1.6&&hpRatio>.7&&alive.length===party.length?'good':margin>=.85&&hpRatio>.4?'warn':'danger';
    if(!Number.isFinite(rounds))key='danger';
    const reasons=[];
    if(alive.length<party.length)reasons.push('전투불능 직원이 있습니다. 파티를 재편하세요.');
    if(hpRatio<.7)reasons.push('누적 부상이 큽니다. 회복을 기다리거나 파티를 재편하세요.');
    if(!hasTank)reasons.push('도발 탱커가 없으면 체력이 약한 직원에게 공격이 분산됩니다.');
    if(!hasHealer)reasons.push('회복 담당을 넣으면 긴 전투와 연속 탐험에 유리합니다.');
    if(!Number.isFinite(rounds)||rounds>16)reasons.push('화력이 부족합니다. 전직·무기 강화·마법 공격수를 확인하세요.');
    if(!reasons.length)reasons.push(key==='good'?'현재 구성은 화력과 생존력이 균형을 이룹니다.':'보스 강공격 전에 피해를 줄일 장비를 준비하세요.');
    return {key,label:{good:'안정권 예상',warn:'교전 주의',danger:'재정비 권장'}[key],reasons,rounds,margin,hpRatio};
  }
  const api={assess,skillRate};root.CampaignMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
