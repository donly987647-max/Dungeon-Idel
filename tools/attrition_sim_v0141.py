#!/usr/bin/env python3
"""v0.14.1 synthetic attrition check. Uses game formulas only; no live-player data."""
import random, statistics

RUNS=3000
ACTIONS=900  # 30 minutes at one action per 2 seconds

BASE=(145,15,11,9,.04,.03)  # starter B slime base

def monster(level):
    hp,atk,defense,spd,crit,evade=BASE
    growth=1.06; talent=88
    hp=round(hp+(level-1)*9*growth+max(0,talent-80)*2)
    atk=atk+(level-1)*2*growth+max(0,talent-80)*.22
    defense=(defense+(level-1)*.8*growth)*1.10*1.10  # tough skin + calm
    evade+=.02
    return hp,atk,defense,spd,crit,evade

def enemy(role):
    power=45
    hp=max(25,round(power*1.40*.8)); atk=max(5,power*.44*.9); defense=max(2,power*.17); spd=9; crit=.05; evade=.03
    if role=='archer': hp=round(hp*.84); atk*=1.22; defense*=.78; spd=14; crit=.13; evade=.07
    elif role=='warrior': hp=round(hp*1.28); atk*=1.10; defense*=1.35; spd=8; crit=.06; evade=.02
    elif role=='brawler': hp=round(hp*1.10); atk*=1.16; defense*=.92; spd=8; crit=.07
    return hp,atk,defense,spd,crit,evade

def fight(level,hp_now,rng):
    maxhp,atk,defense,spd,crit,evade=monster(level)
    eh,eatk,edef,espd,ecrit,eev=enemy(rng.choice(('civil','brawler','archer','warrior')))
    turn='party' if rng.random()<max(.25,min(.75,spd/(spd+espd))) else 'enemy'
    for _ in range(100):
        if turn=='party':
            if rng.random()>=min(.35,eev+max(0,espd-spd)*.002):
                dmg=max(1,round(atk*(.88+rng.random()*.24)-edef*.55))
                if rng.random()<min(.45,crit): dmg=round(dmg*1.7)
                eh=max(0,eh-dmg)
            if eh<=0:return hp_now,True
            turn='enemy'
        else:
            if rng.random()>=min(.35,min(.35,evade)+max(0,spd-espd)*.002):
                dmg=max(1,round(eatk*(.88+rng.random()*.24)-defense*.58))
                if rng.random()<ecrit:dmg=round(dmg*1.65)
                hp_now=max(0,hp_now-dmg)
            if hp_now<=0:return 0,False
            turn='party'
    return hp_now,False

def recover(hp_now,maxhp,rng):
    if hp_now<=0 or hp_now>=maxhp:return hp_now
    ratio=hp_now/maxhp
    chance=.90 if ratio<.35 else .72 if ratio<.60 else .50
    if rng.random()>=chance:return hp_now
    r=rng.random(); frac=.42 if r<.25 else .58 if r<.65 else .22
    return min(maxhp,hp_now+max(1,round(maxhp*frac)))

def add_xp(level,xp,amount=18):
    xp+=amount
    while level<20 and xp>=level*100:
        xp-=level*100; level+=1
    return level,xp

def run(seed):
    rng=random.Random(seed); level=1; xp=0; maxhp=monster(level)[0]; hp_now=maxhp; wins=0
    for action in range(ACTIONS):
        ratio=hp_now/maxhp
        encounter=.28 if ratio>=.60 else .12 if ratio>=.35 else .05
        if rng.random()<encounter:
            hp_now,won=fight(level,hp_now,rng)
            if not won:return wins,action+1,level
            wins+=1; level,xp=add_xp(level,xp); maxhp=monster(level)[0]; hp_now=min(hp_now,maxhp)
        else:
            hp_now=recover(hp_now,maxhp,rng)
    return wins,ACTIONS,level

def main():
    rows=[run(i) for i in range(RUNS)]
    survival=sum(a==ACTIONS for _,a,_ in rows)/RUNS
    early_wipe=sum(w<6 for w,_,_ in rows)/RUNS
    median_wins=statistics.median(w for w,_,_ in rows)
    print(f'30m survival={survival:.3f} early_wipe_before_6_wins={early_wipe:.3f} median_wins={median_wins:.1f}')
    assert .85<=survival<=.97, 'attrition survival outside target band'
    assert early_wipe<.10, 'starter soft-lock risk too high'
    assert median_wins>180, 'progression throughput collapsed'

if __name__=='__main__':main()
