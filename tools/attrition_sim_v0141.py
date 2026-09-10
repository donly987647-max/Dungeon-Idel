#!/usr/bin/env python3
"""Synthetic starter-only attrition regression; no player data.
An encounter consumes one 2-second action; EACH subsequent combat turn also
consumes a 2-second action. This is not a full multi-chapter progression model.
"""
import math, random, statistics
RUNS=3000
ACTIONS=900
BASE=(145,15,11,9,.04,.03)
def rounded(x): return math.floor(x+.5)
def monster(level):
    hp,atk,de,spd,crit,ev=BASE;g=1.06
    return (rounded(hp+(level-1)*9*g+16),atk+(level-1)*2*g+1.76,(de+(level-1)*.8*g)*1.10*1.10,spd+(level-1)*.18*g,crit,ev+.02)
def enemy(role):
    hp=max(25,rounded(45*1.4*.8));atk=45*.44*.9;de=45*.17;spd=9;crit=.05;ev=.03
    if role=='archer':hp=rounded(hp*.84);atk*=1.22;de*=.78;spd=14;crit=.13;ev=.07
    elif role=='warrior':hp=rounded(hp*1.28);atk*=1.10;de*=1.35;spd=8;crit=.06;ev=.02
    elif role=='brawler':hp=rounded(hp*1.10);atk*=1.16;de*=.92;spd=8;crit=.07
    return hp,atk,de,spd,crit,ev
def fight(level,hp,rng,remaining):
    mx,atk,de,spd,crit,ev=monster(level)
    eh,ea,ed,es,ec,ee=enemy(rng.choice(('civil','brawler','archer','warrior')))
    turn='party' if rng.random()<max(.25,min(.75,spd/(spd+es))) else 'enemy'
    for step in range(remaining):
        if turn=='party':
            if rng.random()>=min(.35,ee+max(0,es-spd)*.002):
                d=max(1,rounded(atk*(.88+rng.random()*.24)-ed*.55))
                if rng.random()<min(.45,crit):d=rounded(d*1.7)
                eh=max(0,eh-d)
            if eh<=0:return hp,True,step+1
            turn='enemy'
        else:
            if rng.random()>=min(.35,min(.35,ev)+max(0,spd-es)*.002):
                d=max(1,rounded(ea*(.88+rng.random()*.24)-de*.58))
                if rng.random()<ec:d=rounded(d*1.65)
                hp=max(0,hp-d)
            if hp<=0:return 0,False,step+1
            turn='party'
    return hp,None,remaining

def recover(hp,mx,rng):
    if hp<=0 or hp>=mx:return hp
    ratio=hp/mx;chance=.90 if ratio<.35 else .72 if ratio<.60 else .50
    if rng.random()>=chance:return hp
    r=rng.random();frac=.42 if r<.25 else .58 if r<.65 else .22
    return min(mx,hp+max(1,rounded(mx*frac)))

def run(seed,actions=ACTIONS):
    rng=random.Random(seed);lv=1;xp=0;mx=monster(lv)[0];hp=mx;wins=0;elapsed=0
    while elapsed<actions:
        elapsed+=1;ratio=hp/mx
        # Marginal encounter chance from the server's conditional caution roll.
        encounter=.28 if ratio>=.60 else .28*.43 if ratio>=.35 else .28*.18
        if rng.random()<encounter:
            hp,won,turns=fight(lv,hp,rng,actions-elapsed);elapsed+=turns
            if won is False:return wins,elapsed,lv,False
            if won:
                wins+=1
                if lv<20:
                    xp+=18
                    while lv<20 and xp>=lv*100:xp-=lv*100;lv+=1
                    if lv>=20:xp=0
                mx=monster(lv)[0];hp=min(hp,mx)
        else:hp=recover(hp,mx,rng)
    return wins,elapsed,lv,True

def main():
    rows=[run(i) for i in range(RUNS)]
    survival=sum(alive for _,_,_,alive in rows)/RUNS
    early=sum(not alive and w<6 for w,_,_,alive in rows)/RUNS
    median=statistics.median(w for w,_,_,_ in rows)
    print(f'30 real minutes ({ACTIONS} total 2s actions), runs={RUNS}, survival={survival:.3f}, early_wipe_before_6_wins={early:.3f}, median_kills={median:.1f}')
    assert all(0<=t<=ACTIONS for _,t,_,_ in rows)
    assert .85<=survival<=.97,'starter survival outside target band'
    assert early<.10,'starter early wipe risk'
    assert 60<=median<=130,'starter throughput outside real-time action budget'
    assert recover(0,100,random.Random(1))==0,'dead members cannot revive'
    assert fight(1,161,random.Random(2),0)[2]==0,'combat cannot advance beyond time budget'
if __name__=='__main__':main()
