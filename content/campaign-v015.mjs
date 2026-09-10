// Authoritative campaign content. Stats are initial tuning values, verified with
// the real PL/pgSQL battle implementation by tools/simulation before release.
const foe = (name, role, stats, materials, equipment, skill, counter, art) => ({
  name, role, hp:stats[0], atk:stats[1], def:stats[2], spd:stats[3],
  crit:stats[4]??0.05, evade:stats[5]??0.03, materials, equipment,
  skill, counter, art,
});
const skill = (name, every, multiplier=1, extra={}) => ({name,every,multiplier,...extra});
const gear = (id,slot,stats,description) => ({id,slot,...stats,description});

export const chapters = [
  {
    id:'mountain_village', name:'산골 마을', subtitle:'제1장 · 첫 영업은 조용하게',
    description:'민원은 받지 않습니다. 첫 박멸 실적을 쌓고 자경단의 영업 방해를 끝내세요.',
    objective:'3인 박멸조를 꾸려 자경단장 베르크 처치', level:[1,8],
    power:45, bossPower:85, xp:24, color:'#9fc778', art:'village',
    search:'빈 장작더미와 버려진 빨랫줄을 수색한다', move:'민원 접수함을 피해 다음 골목으로 이동한다',
    ground:['나무 조각','거친 천','낡은 동전'],
    enemies:[
      foe('산골 청년','민병',[55,14,3,10],['연습용 표적 조각','청년회 회비 봉투'],gear('청년회 돌팔매','weapon',{atk:7,spd:1},'회비 미납자를 찾을 때 쓰던 투석구.'),skill('겁 없는 돌진',3,1.35),'방어형 몬스터가 선두를 맡으면 안정적입니다.','villager'),
      foe('나무꾼','투사',[78,19,4,7],['나무꾼 도끼날','송진 묻은 장갑'],gear('나무 몽둥이','weapon',{atk:10},'인사 대신 몽둥이를 건넵니다.'),skill('장작 패기',3,1.65),'세 번째 공격 전에 빠르게 처치하세요.','lumberjack'),
      foe('마을 사냥꾼','궁수',[48,17,2,15,0.10,0.08],['마른 약초','사냥꾼 활시위'],gear('돌부적','accessory',{hp:20,evade:0.025},'사냥꾼의 행운은 이제 회사 자산입니다.'),skill('급소 조준',3,1.3,{ignore:0.35}),'빠른 몬스터와 회복 담당을 함께 배치하세요.','hunter'),
      foe('자경대장','전사',[91,15,10,8],['자경단 완장','근무 교대표'],gear('누더기 조끼','armor',{hp:30,def:6},'법정 근무 시간만큼 오래 버티는 조끼.'),skill('방패 밀치기',4,1.3),'임프의 마법은 높은 방어를 뚫기 좋습니다.','guard'),
    ],
    boss:foe('자경단장 베르크','보스',[320,39,9,10,0.07,0.03],[],null,skill('야간 순찰 총력전',3,1.65),'Lv.6 전후 3인 파티와 방어 장비를 권장합니다. 세 번째 공격이 강합니다.','village-boss'),
    legendary:[gear('베르크의 퇴근 종','weapon',{atk:18,hp:25},'종이 울리면 인간의 근무가 끝납니다.'),gear('민원 반사 조끼','armor',{hp:65,def:12},'접수된 민원은 담당 용사에게 반송됩니다.')],
    extraGear:[gear('청년회 출근표','accessory',{hp:18,spd:1},'첫 출근부터 인간 대신 몬스터가 찍혔습니다.'),gear('송진 작업복','armor',{hp:30,def:5,spd:1},'끈끈한 동료애를 물리적으로 표현합니다.'),gear('은닉처 단궁','weapon',{atk:8,crit:0.04},'발견한 시점부터 회사 비품입니다.'),gear('정시 순찰 완장','accessory',{def:4,hp:20},'순찰 종료 시간만큼은 철저하게 지켰습니다.')],
    products:['산골 판촉 꾸러미','야외 근무 키트','자경단 위장 세트','민원 파쇄 묶음'],
  },
  {
    id:'farm_road',name:'변두리 소국',subtitle:'제2장 · 소국 시장 진출',
    description:'밭 몇 개와 용병대로 버티는 변두리 소국. 왕실의 보급품을 회사 매출로 전환하고 첫 해외 지점을 여세요.',
    objective:'속도와 생존력을 갖추고 용병대장 브란 처치',level:[8,18],
    power:100,bossPower:165,xp:48,color:'#e4bb67',art:'farm',
    search:'뒤집힌 마차와 수확이 끝난 밭을 수색한다',move:'보급 마차의 바퀴 자국을 따라 이동한다',
    ground:['마대 천','가죽 조각','은화 주머니'],
    enemies:[
      foe('농부','투사',[120,30,8,9],['곡물 배급표','날 선 낫 조각'],gear('농부의 낫','weapon',{atk:16,crit:0.025},'수확 대상 변경 신청 완료.'),skill('풍년 베기',3,1.5),'회복 담당을 넣어 연속 전투를 버티세요.','farmer'),
      foe('짐꾼','수호자',[185,23,14,6],['운송장 묶음','짐꾼 어깨끈'],gear('과적 운반대','armor',{hp:75,def:8,spd:-1},'적재 한도보다 생존 의지가 중요합니다.'),skill('긴급 간식',4,1,{heal:0.12}),'자가 회복 전에 공격을 집중하세요.','porter'),
      foe('행상인 호위','궁수',[99,35,7,18,0.13,0.08],['호위 계약서','경량 화살촉'],gear('사냥꾼 부적','accessory',{spd:3,crit:0.04},'호위 계약의 작은 글씨는 읽지 마세요.'),skill('선금 일격',2,1.3,{ignore:0.25}),'도발 탱커로 약한 직원을 보호하세요.','escort'),
      foe('마을 경비병','전사',[155,28,18,10],['경비대 호루라기','가죽 방패끈'],gear('가죽 조끼','armor',{hp:45,def:11},'방어력에 비해 복리후생은 부족했습니다.'),skill('검문 강화',4,1.5),'마법 공격으로 단단한 방어를 공략하세요.','guard'),
    ],
    boss:foe('용병대장 브란','보스',[510,49,19,16,0.10,0.06],[],null,skill('위약금 청구',3,1.65,{ignore:0.20}),'탱커·회복 담당을 포함한 Lv.14 전후 파티를 권장합니다.','mercenary-boss'),
    legendary:[gear('브란의 계약 파기검','weapon',{atk:29,crit:0.045},'위약금은 인간 측에서 부담합니다.'),gear('무기한 호위 계약서','accessory',{hp:65,def:8,spd:2},'계약 기간: 몬스터가 원할 때까지.')],
    extraGear:[gear('소국 수확 장갑','accessory',{atk:6,spd:2},'경작지는 작아도 악행의 꿈은 큽니다.'),gear('짐꾼 운송 망치','weapon',{atk:18,spd:-1},'파손 주의 표시는 상대에게 붙입니다.'),gear('선불 호위 외투','armor',{hp:35,def:8,evade:0.03},'대금은 먼저, 방어는 나중에.'),gear('검문 면제 목걸이','accessory',{hp:45,def:5},'뇌물은 회사 경비로 처리해 드립니다.')],
    products:['수확물 위탁 상자','용병 복지 꾸러미','보급품 재포장 세트','위장 호위 증명서'],
  },
  {
    id:'border_outpost',name:'작은 왕국',subtitle:'제3장 · 왕실 납품 계약',
    description:'작지만 정규군과 기사단을 갖춘 왕국. 전직한 직원들과 왕실의 단단한 방어선을 돌파하세요.',
    objective:'첫 전직과 장비 강화 후 기사단 부관 처치',level:[18,30],
    power:190,bossPower:290,xp:86,color:'#94afcb',art:'outpost',
    search:'무너진 석벽과 폐기된 군수 상자를 수색한다',move:'초소 순찰 교대의 빈틈을 따라 전진한다',
    ground:['철편','왕국 동전','단단한 가죽'],
    enemies:[
      foe('신참 병사','전사',[210,45,21,12],['신병 인식표','훈련 일지'],gear('병사의 검','weapon',{atk:24,def:3},'훈련보다 실전에 더 빨리 투입됐습니다.'),skill('배운 대로 찌르기',3,1.5),'방어 장비 강화와 전직을 먼저 확인하세요.','soldier'),
      foe('석궁병','궁수',[161,54,13,17,0.12,0.05],['석궁 걸쇠','관통 볼트'],gear('초소 관통 석궁','weapon',{atk:27,crit:0.045,spd:-1},'왕국 보안 체계를 관통하는 회사 비품.'),skill('관통 사격',3,1.5,{ignore:0.5}),'관통 공격은 방어만으로 막기 어렵습니다. 체력도 필요합니다.','crossbow'),
      foe('초소 경비대','수호자',[295,39,36,8],['초소 열쇠','규율 수첩'],gear('경비병 철갑','armor',{hp:80,def:20,spd:-1},'무겁지만 초과 근무에 강합니다.'),skill('규율 집행',4,1.5),'마법 계열 전직 몬스터를 활용하세요.','guard'),
      foe('하급 기사','기사',[245,48,27,13,0.08,0.04],['왕국 문양 조각','기사 서약문'],gear('왕국 훈장','accessory',{hp:35,atk:7,def:7},'회사 게시판의 이달의 사원 칸에 걸어두세요.'),skill('명예의 결투',3,1.4,{heal:0.06}),'방어·회복·공격 역할을 나누는 편이 유리합니다.','knight'),
    ],
    boss:foe('왕국 기사단 부관','보스',[980,86,34,14,0.10,0.04],[],null,skill('왕국식 인사평가',4,1.9,{ignore:0.25}),'Lv.26 전후, 전직한 탱커와 회복 담당을 권장합니다.','outpost-boss'),
    legendary:[gear('부관의 결재 대검','weapon',{atk:43,def:7},'한 번 휘두르면 결재선이 짧아집니다.'),gear('반려 불가 철갑','armor',{hp:135,def:29,spd:-1},'인간의 공격 요청을 반려하는 데 특화됐습니다.')],
    extraGear:[gear('신병 생존 조끼','armor',{hp:95,def:14},'훈련소보다 회사의 안전 교육이 낫습니다.'),gear('탄도 계산 렌즈','accessory',{atk:7,crit:0.055},'인간의 급소를 결재선처럼 정확히 찾습니다.'),gear('경계 근무 철퇴','weapon',{atk:25,def:5,spd:-1},'밤샘 근무의 무게가 실렸습니다.'),gear('기사 서약 갑옷','armor',{hp:55,def:22},'서약의 수혜자가 회사로 바뀌었습니다.')],
    products:['변경 수리 공구함','왕국 출장 증빙','초소 보안 꾸러미','기사단 모조 기념품'],
  },
  {
    id:'grand_castle',name:'거대한 성',subtitle:'제4장 · 철벽 지점 인수',
    description:'겹겹의 성벽 안에서 근위대와 궁정 치유사가 버팁니다. 두 번째 전직과 역할 분담으로 철벽의 성주를 끌어내세요.',
    objective:'성채의 방어와 회복을 돌파하고 성주 발레리 처치',level:[30,45],
    power:340,bossPower:490,xp:168,color:'#aaacd1',art:'castle',
    search:'무너진 외성의 장식과 버려진 회랑을 수색한다',move:'겹겹의 성문을 지나 대연회장으로 전진한다',
    ground:['빛바랜 벽지','깨진 샹들리에','성벽 석재 조각'],
    enemies:[
      foe('성문 방패병','수호자',[440,68,50,9],['성문 열쇠고리','방패병 견갑'],gear('성문 돌파 장화','armor',{hp:125,def:27,evade:0.02},'노크는 생략해도 됩니다.'),skill('성문 봉쇄',4,1.45),'방어를 무시하는 스킬을 활용하세요.','castle-guard'),
      foe('왕성 징세관','주술사',[310,82,30,15],['왕성 세금 고지서','징세 인장'],gear('미납금 징수봉','weapon',{atk:41,human_damage:0.04},'세금 대상은 전 인류입니다.'),skill('미납 가산세',3,1.45,{ignore:0.6}),'체력과 피해 감소를 갖춘 탱커가 유리합니다.','tax-mage'),
      foe('궁정 치유사','치유사',[350,61,29,18],['궁정 성가 악보','치유 향낭'],gear('야근 면제 성가집','accessory',{hp:110,spd:3,def:9},'읽는다고 야근이 사라지지는 않습니다.'),skill('회복 성가',3,0.8,{heal:0.16}),'공격수가 부족하면 전투가 길어집니다.','court-healer'),
      foe('성채 근위대','기사',[480,76,47,12],['성채 임명장','은빛 방패편'],gear('봉인된 은빛 방패','armor',{hp:90,def:35},'해제 비밀번호: 정시 퇴근.'),skill('근위대 집행',4,1.7,{ignore:0.2}),'전직과 강화로 긴 전투에 대비하세요.','castle-knight'),
    ],
    boss:foe('철벽의 성주 발레리','보스',[1800,145,50,20,0.12,0.06],[],null,skill('성주의 비상 동원령',3,1.5,{heal:0.05,ignore:0.3}),'Lv.39 전후 4인 파티와 두 번째 전직을 권장합니다. 주기적인 회복과 강공격을 돌파하세요.','castle-boss'),
    legendary:[gear('발레리의 성문 절단검','weapon',{atk:65,def:8,crit:0.035},'성문 인수 절차를 단축하는 도구입니다.'),gear('기적의 유급 휴가증','accessory',{hp:180,def:14,spd:4},'서류상으로만 존재하던 전설의 복지.')],
    extraGear:[gear('공성 근무 철퇴','weapon',{atk:44,def:6,spd:-1},'거대한 성에도 퇴근 시간은 있습니다.'),gear('납세 거부 인장','accessory',{atk:11,def:10},'해당 세금은 몬스터에게 적용되지 않습니다.'),gear('궁정 응급 외투','armor',{hp:165,def:23,spd:2},'치료 담당의 생존도 복지입니다.'),gear('성채 반격 창','weapon',{atk:39,hp:55,crit:0.04},'서류 접수 창구와는 관계없습니다.')],
    products:['왕성 인테리어 꾸러미','세무 대응 증빙 세트','궁정 복지 꾸러미','성채 위장 근무복'],
  },
  {
    id:'hero_kingdom',name:'용사 왕국',subtitle:'제5장 · 인류 구원 사업 종료',
    description:'용사가 왕이 되고 영웅들이 군대를 이룬 최종 경쟁사. 용사 왕국을 박멸하고 회사의 새 간판을 거세요.',
    objective:'최종 파티를 완성해 대표 용사 아우렐 처치',level:[45,60],
    power:530,bossPower:750,xp:270,color:'#df998c',art:'royal',
    search:'폐쇄된 상가와 황금 대로의 잔해를 수색한다',move:'왕도 본사 결재선을 따라 최상층으로 전진한다',
    ground:['황동 장식편','비단 자투리','깨진 왕관 보석'],
    enemies:[
      foe('왕실 근위병','수호자',[720,105,69,15],['근위대 휘장','왕실 갑옷 나사'],gear('근위대 정장 갑옷','armor',{hp:190,def:44,spd:-1},'드레스 코드는 중갑입니다.'),skill('왕실 경호',4,1.6),'마법과 관통 공격을 파티에 포함하세요.','royal-guard'),
      foe('궁정 마도사','마법사',[465,127,38,23],['궁정 주문서','정제 마력 결정'],gear('궁정 비품 지팡이','weapon',{atk:60,human_damage:0.07},'반출 금지 도장은 이미 찍혀 있습니다.'),skill('왕실 화염 결재',3,1.65,{ignore:0.75}),'방어력보다 체력과 피해 감소가 중요합니다.','court-mage'),
      foe('왕실 재무관','치유사',[540,91,43,20],['왕실 채권','금고 암호판'],gear('성과급 압류 인장','accessory',{atk:16,hp:115,def:12},'올해의 성과급은 본사가 회수합니다.'),skill('예비비 충당',3,1,{heal:0.14}),'높은 지속 화력으로 회복량을 넘겨야 합니다.','treasurer'),
      foe('은퇴 예정 용사','용사',[630,116,56,25,0.16,0.09],['용사 경력 증명서','금빛 검집 장식'],gear('명예퇴직 대검','weapon',{atk:67,crit:0.06,spd:-1},'퇴직 사유: 몬스터 측 경영상 판단.'),skill('마지막 야근',3,1.7),'모든 역할이 필요합니다. 부상자를 재편하고 출정하세요.','veteran-hero'),
    ],
    boss:foe('대표 용사 아우렐','보스',[2500,205,66,26,0.14,0.07],[],null,skill('세계를 구하는 일격',4,2,{ignore:0.4,heal:0.04}),'Lv.55 이상, 강화된 탱커·지원·공격 파티를 권장합니다. 네 번째 공격을 경계하세요.','royal-boss'),
    legendary:[gear('아우렐의 사직서','weapon',{atk:91,human_damage:0.09,crit:0.04},'세계를 구할 사람이 퇴사했습니다.'),gear('용사 박멸 대표이사 인장','accessory',{hp:240,atk:22,def:18},'도장 한 번에 세계의 고용 관계가 바뀝니다.')],
    extraGear:[gear('왕실 정리해고 도끼','weapon',{atk:63,def:9},'인사권을 물리적으로 행사합니다.'),gear('마력 감사 렌즈','accessory',{atk:17,spd:4,crit:0.035},'불필요한 영웅 마력을 찾아냅니다.'),gear('왕실 예산 방어복','armor',{hp:170,def:47},'어떤 공격에도 예산 삭감만큼은 견딥니다.'),gear('용사 연금 수령증','accessory',{hp:155,def:15,evade:0.035},'연금 수령인은 회사로 변경됐습니다.')],
    products:['왕도 고급 판촉물','왕실 정비 세트','궁정 결재 대행 서류','용사 명예퇴직 패키지'],
  },
];

export const rules = {
  contentVersion:15,
  bossUnlockBattles:500,
  bossEncounterChance:0.015,
  normalEquipmentChance:0.004,
  bossEquipmentChance:0.025,
  bossLegendaryChance:0.015, // one roll, one of the two items: 0.75% each
  groundWeights:[0.45,0.35,0.20],
  groundSearchChance:0.10,
  groundLootChance:0.18,
};
