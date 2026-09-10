#!/usr/bin/env python3
# v0.13.11 deterministic Monte-Carlo balance regression. Uses no production player data.
from dataclasses import dataclass,replace
from copy import deepcopy
import random,math,statistics,sys

N=48; H=(1/6,.5,1,4,8,24,72)
SITE={"ch1":(45,90,18,.92),"ch2":(100,190,29,.90125),"ch3":(190,340,46,.645)}

@dataclass
class M:
 f:str;lv:int;hp:float;atk:float;df:float;sp:float;cr:float;ev:float;tal:int=88;g:float=1.06;xp:int=0;trait:str="";skill:dict|None=None
SL=M("slime",1,145,15,11,9,.04,.03,88,1.06,0,"질긴 가죽")
GB=M("goblin",1,100,21,7,14,.08,.06,90,1.13,0,"야성")
TR=M("troll",1,175,24,13,7,.05,.02,84,1.06,0,"학습 본능")
E={
"slime":("holy_slime",20,1.20,1.10,1.18,1.04,.01,.02,("hp",.30,.65,1.70,0)),
"holy_slime":("saint_slime",30,1.28,1.14,1.18,1.04,.01,.03,("hp",.35,.75,1.85,.10)),
"goblin":("shadow_goblin",20,1.05,1.24,1.02,1.20,.04,.04,("chance",.18,0,2.10,.20)),
"shadow_goblin":("nightblade_goblin",30,1.08,1.28,1.04,1.16,.05,.04,("every",5,0,2.50,.15)),
"troll":("iron_troll",20,1.28,1.10,1.24,.96,0,0,("hp",.30,.60,1.85,.10)),
"iron_troll":("fortress_troll",30,1.32,1.14,1.28,.95,0,0,("every",4,0,2.00,.55))}
B={"slime","goblin","troll"}; T1={"holy_slime","shadow_goblin","iron_troll"}

def cap(m):return 20 if m.f in B else 30 if m.f in T1 else 60
def st(m):
 hp=m.hp+(m.lv-1)*9*m.g+max(0,m.tal-80)*2; a=m.atk+(m.lv-1)*2*m.g+max(0,m.tal-80)*.22
 d=(m.df+(m.lv-1)*.8*m.g)*(1.10 if m.trait=="질긴 가죽" else 1)*1.10
 return hp,a,d,m.sp+(m.lv-1)*.18*m.g,min(.45,m.cr),min(.35,m.ev+.02)
def evo(m,keep):
 if m.f not in E:return False
 t,req,hm,am,dm,sm,ca,ea,sk=E[m.f]
 if m.lv<req:return False
 m.f=t;m.hp=round(m.hp*hm);m.atk=round(m.atk*am);m.df=round(m.df*dm);m.sp=round(m.sp*sm);m.cr+=ca;m.ev+=ea;m.skill=sk
 if not keep:m.lv=1;m.xp=0
 return True
def addxp(m,x):
 while x and m.lv<cap(m):
  need=m.lv*100;z=min(x,need-m.xp);m.xp+=z;x-=z
  if m.xp>=need:m.xp-=need;m.lv+=1
 if m.lv>=cap(m):m.xp=0
def skill(m,n,hpr,r):
 if not m.skill:return 1,0
 k,v,c,mul,ig=m.skill; ok=(k=="chance" and r.random()<v) or (k=="every" and n%int(v)==0) or (k=="hp" and hpr<=c and r.random()<v)
 return (mul,ig) if ok else (1,0)

def fight(p,pow,boss,r):
 n=len(p);hp={i:round(st(m)[0]) for i,m in enumerate(p)};mx=hp.copy();ps=sum(st(m)[3] for m in p)/n
 eh=max(25,round(pow*1.40*(.8+.35*(n-1))));ea=max(5,pow*.44*(.9+.20*(n-1)));ed=max(2,pow*.17)
 role="b" if boss else r.randrange(4); es=9;ec=.05;ee=.03
 if role==2:eh=round(eh*.84);ea*=1.22;ed*=.78;es=14;ec=.13;ee=.07
 elif role==3:eh=round(eh*1.28);ea*=1.10;ed*=1.35;es=8;ec=.06;ee=.02
 elif role==1:eh=round(eh*1.10);ea*=1.16;ed*=.92;es=8;ec=.07
 elif role=="b":eh=round(eh*2.25);ea*=1.55;ed*=1.35;es=11;ec=.12;ee=.05
 turn=0 if r.random()<max(.25,min(.75,ps/(ps+es))) else 1; cnt=[0]*n;a=0
 while a<100:
  a+=1
  if turn==0:
   for i,m in enumerate(p):
    if hp[i]<=0:continue
    _,at,_,sp,cr,_=st(m);cnt[i]+=1
    if m.trait=="야성" and hp[i]<mx[i]*.4:at*=1.20
    mul,ig=skill(m,cnt[i],hp[i]/mx[i],r)
    if r.random()>=min(.35,ee+max(0,es-sp)*.002):
     dmg=max(1,round(at*(.88+r.random()*.24)*mul-ed*.55*(1-min(.90,ig))))
     if r.random()<cr:dmg=round(dmg*1.7)
     eh-=dmg
    if eh<=0:return True,a
   turn=1
  else:
   live=[i for i,v in hp.items() if v>0]
   if not live:return False,a
   i=r.choice(live);_,_,df,sp,_,ev=st(p[i])
   dmg=0 if r.random()<min(.35,min(.35,ev)+max(0,sp-es)*.002) else max(1,round(ea*(.88+r.random()*.24)-df*.58))
   if dmg and r.random()<ec:dmg=round(dmg*1.65)
   hp[i]=max(0,hp[i]-dmg)
   if not any(hp.values()):return False,a
   turn=0
 return False,a

def stage(p,key,keep=True,xpb=True,maxh=72,seed=1):
 rec,boss,xpk,_=SITE[key];r=random.Random(seed);p=deepcopy(p);t=w=ba=loss=kills=ground=0;b=False
 while t<maxh*3600:
  for m in p:
   while evo(m,keep):pass
  q=r.random();t+=2
  if q<.28:ground+=r.random()<.10
  elif q<.48:ground+=r.random()<.18
  elif q>=.72:
   win,acts=fight(p,boss if b else rec,b,r);t+=acts*2
   if win:
    kills+=1
    if b:return {"clear":1,"h":t/3600,"wins":w,"ba":ba+1,"loss":loss,"lv":[m.lv for m in p],"kills":kills,"ground":ground}
    w+=1;n=len(p);each=math.ceil(xpk*(1+.10*(n-1))/n) if xpb else max(1,math.floor(xpk/n))
    for m in p:addxp(m,round(each*1.12) if m.trait=="학습 본능" else each)
    if w>=500:b=True
   else:
    loss+=1
    for m in p:m.xp=math.floor(m.xp*.8)
    if b:ba+=1;w=0;b=False
 return {"clear":0,"h":maxh,"wins":w,"ba":ba,"loss":loss,"lv":[m.lv for m in p],"kills":kills,"ground":ground}

def med(p,k,keep=True,xpb=True,maxh=72,n=N):
 z=[stage(p,k,keep,xpb,maxh,1000+i) for i in range(n)];c=[x for x in z if x["clear"]]
 return len(c)/n,statistics.median(x["h"] for x in c) if c else 999
def static(p,k,seed):
 r=random.Random(seed);rec,_,_,_=SITE[k];t=kill=ground=0
 while t<3600:
  q=r.random();t+=2
  if q<.28:ground+=r.random()<.10
  elif q<.48:ground+=r.random()<.18
  elif q>=.72:
   w,a=fight(deepcopy(p),rec,False,r);t+=a*2;kill+=w
 return kill,ground
def caploot(n):return min(9000,3000+max(0,n-1)*1500)

def main():
 ch1=[SL];ch2=[replace(SL,lv=19),GB,TR];ch3=[replace(SL,lv=26),replace(GB,lv=19),replace(TR,lv=20)]
 old2=med(ch2,"ch2",False,False,48);a=med(ch1,"ch1",True,True,24);b=med(ch2,"ch2",True,True,48);c=med(ch3,"ch3",True,True,72)
 stable={"ch1":[replace(SL,lv=15)],"ch2":[replace(SL,lv=25),replace(GB,lv=20),replace(TR,lv=20)],"ch3":[replace(SL,lv=35),replace(GB,lv=30),replace(TR,lv=30)]}
 mat={};killh={}
 for k,p in stable.items():
  for m in p:
   while evo(m,True):pass
  z=[static(p,k,2000+i) for i in range(20)];kh=statistics.mean(x[0] for x in z);gh=statistics.mean(x[1] for x in z)
  killh[k]=kh;mat[k]=gh+kh*SITE[k][3]
 horizons={}
 for k,p in (("ch1",ch1),("ch2",ch2),("ch3",ch3)):
  horizons[k]=[(h,sum(stage(p,k,True,True,h,5000+i)["clear"] for i in range(6))/6) for h in H]
 raw={"거친 천":2,"나무 조각":2,"낡은 동전":1,"마른 약초":3,"마대 천":4,"가죽 조각":5,"은화 주머니":8,"철편":12,"단단한 가죽":10,"왕국 동전":15,"왕국 문양 조각":8}
 recipes=[({"거친 천":2,"나무 조각":2,"낡은 동전":4},30,90,75),({"거친 천":1,"마른 약초":3},42,126,105),({"마대 천":3,"가죽 조각":4},80,240,200),({"거친 천":4,"가죽 조각":6,"은화 주머니":1},110,330,275),({"철편":5,"단단한 가죽":2},180,540,450),({"철편":3,"왕국 동전":1,"왕국 문양 조각":4},260,780,650)]
 craft=[(sale/sum(raw[x]*q for x,q in ins.items()),sale/((ct+st)/3600)) for ins,sale,ct,st in recipes]
 xp1=killh["ch1"]*18;xp2=killh["ch2"]*math.ceil(29*1.2/3);xp3=killh["ch3"]*math.ceil(46*1.2/3)
 checks=[3.4<=a[1]<=5.5,5<=b[1]<=10 and b[0]>=.98,7<=c[1]<=15 and c[0]>=.95,b[1]<=old2[1]*.7,all(120<=mat[k]<=400 for k in mat),all(500<=g<=800 and u>=2 for u,g in craft),4000<=xp1<=6000,2500<=xp2<=5000,3000<=xp3<=6000,all(dict(horizons[k])[1]==0 for k in horizons),all(dict(horizons[k])[24]>=.66 for k in horizons)]
 print("chapter median h",round(a[1],2),round(b[1],2),round(c[1],2),"ch2 old",round(old2[1],2))
 for k in mat:print(k,"kills/h",round(killh[k],1),"material/h",round(mat[k],1),"cargo 1p/3p",round(caploot(1)/mat[k],1),round(caploot(3)/(mat[k]*3),1))
 print("xp/h",round(xp1),round(xp2),round(xp3));print("horizons",horizons);print("PASS" if all(checks) else "FAIL",sum(checks),"/",len(checks))
 return 0 if all(checks) else 1
if __name__=="__main__":raise SystemExit(main())
