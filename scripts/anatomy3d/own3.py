# Final-build figure, generated entirely in code. A body envelope with true (non-round) sections carries the muscles,
# which are continuous sheets that hug it: fine fibres, grooves between neighbours and pale tendon ends come from the
# shader via the per-vertex fibre coordinates written here. Output: web_own3/ (same layout as build.py).
import json, os, sys, numpy as np
SEG=['pelvis','lumbar','chest','neck','head','Lupper','Lfore','Lhand','Rupper','Rfore','Rhand','Lthigh','Lshank','Lfoot','Rthigh','Rshank','Rfoot']
si={s:i for i,s in enumerate(SEG)}
J={'pel':[0,0,930],'lum':[0,20,1040],'chest':[0,25,1160],'neck':[0,15,1500],'head':[0,0,1590]}
for k,sg in (('L',1),('R',-1)):
    J.update({k+'hip':[sg*92,0,930],k+'knee':[sg*88,0,500],k+'ank':[sg*84,0,80],k+'sh':[sg*210,0,1440],k+'el':[sg*234,0,1140],k+'wr':[sg*244,-12,885],k+'tip':[sg*250,-20,700]})
J={k:np.array(v,float) for k,v in J.items()}
V=[];F=[];BI=[];BW=[];FIB=[];parts=[]
def add(name,kind,groups,v,f,bi,bw,fib=None):
    v0=sum(len(x) for x in V); f0=sum(len(x) for x in F); v=np.asarray(v,float)
    V.append(v); F.append(np.asarray(f,int).reshape(-1,3)+v0); BI.append(np.asarray(bi,int)); BW.append(np.asarray(bw,float))
    FIB.append(np.tile([-1.0,0,0],(len(v),1)) if fib is None else np.asarray(fib,float))
    parts.append(dict(name=name,kind=kind,groups=groups,v0=v0,nv=len(v),f0=f0,nf=len(f)))
def ss(a,b,x): t=np.clip((np.asarray(x,float)-a)/(b-a),0,1); return t*t*(3-2*t)
def grid_faces(n,k,closed=True):
    f=[]
    for i in range(n-1):
        for j in range(k if closed else k-1):
            a=i*k+j; b=i*k+(j+1)%k; c=a+k; d=b+k; f+=[[a,b,c],[b,d,c]]
    return f
INSET=6.0
# ---- torso: half width, front depth, back depth by height (own figure; proportions checked against measurements)
TP=[(868,118,92,98),(904,166,108,114),(954,167,113,122),(1004,160,121,110),(1054,150,126,84),(1104,142,128,77),(1154,145,135,84),(1204,151,141,94),
    (1254,158,143,105),(1304,166,146,114),(1354,173,142,121),(1404,178,124,121),(1450,172,92,112),(1486,118,72,92),(1512,64,60,64),(1600,56,58,60)]
NE=2.35
def tprof(z): xs=[p[0] for p in TP]; return [np.interp(z,xs,[p[i] for p in TP]) for i in (1,2,3)]
def torso_pt(z,phi,inset=0.0):
    a,df,db=tprof(z); p=np.radians(phi); s,c=np.sin(p),np.cos(p); d=df if c>=0 else db
    return np.array([(a-inset)*np.sign(s)*abs(s)**(2/NE),-(d-inset)*np.sign(c)*abs(c)**(2/NE),z])
def torso(z,phi,inset=INSET):
    p=torso_pt(z,phi,inset); e=1.5; t1=torso_pt(z,phi+e,inset)-torso_pt(z,phi-e,inset); t2=torso_pt(z+4,phi,inset)-torso_pt(z-4,phi,inset)
    n=np.cross(t1,t2); n/=np.linalg.norm(n)
    if n@np.array([p[0],p[1],0])<0: n=-n
    return p,n
def torso_phi(x,y,z):
    a,df,db=tprof(z); d=df if y<=0 else db; return np.degrees(np.arctan2(np.sign(x)*abs(x/a)**(NE/2),np.sign(-y)*abs(y/d)**(NE/2)))
def trunk_w(z):
    a=ss(1000,1060,z); b=ss(1120,1185,z); c=ss(1490,1525,z); d=ss(1575,1605,z)
    w=np.zeros(len(SEG)); w[0]=1-a; w[1]=a*(1-b); w[2]=b*(1-c); w[3]=c*(1-d); w[4]=d; return w
def two(w):
    o=np.argsort(-w)[:2]; ww=w[o]/w[o].sum(); return o,ww
K=48; zs=np.concatenate([np.arange(868,1600,10),[1600]]); v=[];bi=[];bw=[]
for z in zs:
    o,ww=two(trunk_w(z))
    for j in range(K): v.append(torso_pt(z,360*j/K,INSET)); bi.append(o); bw.append(ww)
add('torso','core',[],v,grid_faces(len(zs),K),bi,bw)
def ellipsoid(c,r,seg,name,n=14,k=20,kind='core'):
    v=[]
    for i in range(n+1):
        t=np.pi*i/n
        for j in range(k): p=2*np.pi*j/k; v.append([c[0]+r[0]*np.sin(t)*np.cos(p),c[1]+r[1]*np.sin(t)*np.sin(p),c[2]+r[2]*np.cos(t)])
    add(name,kind,[],v,grid_faces(n+1,k),[[si[seg],si[seg]]]*len(v),[[1,0]]*len(v))
# ---- limbs: radius towards front, outer side, back, inner side at five stations
LIMB={'U':('sh','el','upper',[(0,52,56,60,48),(.25,53,62,66,50),(.5,45,52,62,46),(.75,41,50,56,44),(1,38,49,48,38)]),
      'F':('el','wr','fore',[(0,38,53,50,38),(.25,38,56,49,42),(.5,33,45,44,37),(.75,27,37,35,29),(1,24,31,24,25)]),
      'H':('hip','knee','thigh',[(0,96,106,110,82),(.25,92,106,86,68),(.5,95,93,76,61),(.75,78,73,63,55),(1,58,58,62,50)]),
      'S':('knee','ank','shank',[(0,57,58,65,49),(.25,45,62,86,55),(.5,35,54,72,41),(.75,31,41,47,33),(1,31,35,37,31)])}
def lrad(code,t,phi):
    prof=LIMB[code][3]; xs=[p[0] for p in prof]; r=[np.interp(t,xs,[p[i] for p in prof]) for i in (1,2,3,4)]
    q=(phi%360)/90; i=int(q)%4; f=q-int(q); a=r[i]; b=r[(i+1)%4]; c=np.cos(f*np.pi/2)**2; return a*c+b*(1-c)
def limb_pt(code,side,t,phi,inset=0.0):
    a,b=LIMB[code][0],LIMB[code][1]; sg=1 if side=='L' else -1; A=J[side+a]; B=J[side+b]; p=np.radians(phi)
    return A+t*(B-A)+(lrad(code,np.clip(t,0,1),phi)-inset)*np.array([sg*np.sin(p),-np.cos(p),0.0])
def limb(code,side,t,phi,inset=INSET):
    p=limb_pt(code,side,t,phi,inset); t1=limb_pt(code,side,t,phi+2,inset)-limb_pt(code,side,t,phi-2,inset); t2=limb_pt(code,side,t+.01,phi,inset)-limb_pt(code,side,t-.01,phi,inset)
    n=np.cross(t1,t2); n/=np.linalg.norm(n); ax=J[side+LIMB[code][0]]+t*(J[side+LIMB[code][1]]-J[side+LIMB[code][0]])
    if n@(p-ax)<0: n=-n
    return p,n
for side in 'LR':
    sg=1 if side=='L' else -1
    for code,(a,b,seg,prof) in LIMB.items():
        ts=np.linspace(0,1,22); v=[]
        for t in ts:
            for j in range(28): v.append(limb_pt(code,side,t,360*j/28,INSET))
        s=si[side+seg]; add(side+seg,'core',[],v,grid_faces(len(ts),28),[[s,s]]*len(v),[[1,0]]*len(v))
    for jn,r,seg in (('sh',(50,52,50),'upper'),('el',(40,42,40),'fore'),('hip',(88,92,90),'thigh'),('knee',(50,54,52),'shank')):
        ellipsoid(J[side+jn],r,side+seg,side+jn,12,18,'joint')
    ellipsoid(J[side+'knee']+[0,-52,4],[25,12,30],side+'shank',side+'kneecap',10,14,'bone')
    ellipsoid(J[side+'el']+[0,40,6],[17,12,22],side+'fore',side+'elbow tip',8,12,'bone')
# ---- muscle sheets
def tseg(z): return 'pelvis' if z<1000 else 'lumbar' if z<1130 else 'chest' if z<1500 else 'neck' if z<1590 else 'head'
def cp(side,c):
    sg=1 if side=='L' else -1
    if c[0]=='T': p,n=torso(c[1],sg*c[2]); return p,n,tseg(c[1])
    if c[0]=='X':
        p=np.array([sg*c[1],c[2],c[3]],float); n=np.array([p[0],p[1],0.0]); n=n/max(np.linalg.norm(n),1e-6)*0.75+np.array([0,0,0.66])
        s=c[4]; return p,n/np.linalg.norm(n),(side+s if s in('upper','fore','hand','thigh','shank','foot') else s)
    p,n=limb(c[0],side,c[1],c[2]); return p,n,side+LIMB[c[0]][2]
def project(p,ref,side,n0):
    c=ref[0]; sg=1 if side=='L' else -1
    if c=='T':
        z=float(np.clip(p[2],870,1598)); return torso(z,torso_phi(p[0],p[1],z))
    if c=='X': return p,n0
    a,b=LIMB[c][0],LIMB[c][1]; A=J[side+a]; B=J[side+b]; ab=B-A; t=float(np.clip((p-A)@ab/(ab@ab),-0.04,1.04)); d=p-(A+t*ab); return limb(c,side,t,np.degrees(np.arctan2(sg*d[0],-d[1])))
def sheet(name,group,side,cps,w,th,flat=0.0,kind='muscle',R=30):
    P=[cp(side,c) for c in cps]; pts0=np.array([p[0] for p in P]); nr0=np.array([p[1] for p in P]); sg_=[si[p[2]] for p in P]
    n=len(P); ws=list(w) if isinstance(w,(list,tuple)) else [w]*n; ths=list(th) if isinstance(th,(list,tuple)) else [th]*n
    ws=[x*1.45 for x in ws]; ef=0.4+0.6*flat; ws[0]*=ef; ws[-1]*=ef
    C=max(5,int(max(ws)/6)+1); us=np.linspace(0,1,R); grid=np.zeros((R,C,3)); nrm=np.zeros((R,C,3)); rowif=[]
    for c in range(C):
        s=-1+2*c/(C-1); pts=[];nr=[]
        for i in range(n):
            tg=pts0[min(i+1,n-1)]-pts0[max(i-1,0)]; tg/=np.linalg.norm(tg); b=np.cross(tg,nr0[i]); b/=np.linalg.norm(b)
            p,nn=project(pts0[i]+b*s*ws[i]/2,cps[i],side,nr0[i]); pts.append(p); nr.append(nn)
        pts=np.array(pts); nr=np.array(nr); ext=np.vstack([2*pts[0]-pts[1],pts,2*pts[-1]-pts[-2]])
        for r,u in enumerate(us):
            x=u*(n-1); i=min(int(x),n-2); f=x-i; p0,p1,p2,p3=ext[i],ext[i+1],ext[i+2],ext[i+3]
            grid[r,c]=0.5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f**3)
            nn=nr[i]*(1-f)+nr[i+1]*f; nrm[r,c]=nn/np.linalg.norm(nn)
            if c==0: rowif.append((i,f))
    v=[];bi=[];bw=[];fib=[]; nf=max(ws)/2.4
    L=float(np.linalg.norm(np.diff(grid[:,C//2],axis=0),axis=1).sum()); Lt=float(np.clip(0.11*L,10,42))
    for r,u in enumerate(us):
        i,f=rowif[r]; env=np.sin(np.pi*(0.015+0.97*u))**0.55; tk=(5.5+0.5*np.interp(u*(n-1),range(n),ths))*env
        fs=f*f*(3-2*f); a,bb=sg_[i],sg_[i+1]
        for c in range(C):
            s=-1+2*c/(C-1); dome=(1-abs(s)**3)**0.6
            v.append(grid[r,c]+nrm[r,c]*(tk*dome+0.6)); fib.append([float(1-ss(0.15*Lt,Lt,min(u,1-u)*L)),s,nf])
            if fs<0.5: bi.append([a,bb]); bw.append([1-fs,fs])
            else: bi.append([bb,a]); bw.append([fs,1-fs])
    add(side+' '+name,kind,[group] if isinstance(group,str) else group,v,grid_faces(R,C,False),bi,bw,fib)
def arg(k,d):
    return sys.argv[sys.argv.index(k)+1] if k in sys.argv else d
ALL=[]
for fn in arg('--m','muscles3_upper.py,muscles3_lower.py').split(','):
    g={}; exec(open(fn).read(),g); ALL+=g['M']
for side in 'LR':
    for m in ALL: sheet(m[0],m[1],side,m[2],m[3],m[4],m[5] if len(m)>5 else 0.0,m[6] if len(m)>6 else 'muscle')
if os.path.exists('extremities.py') and '--noext' not in sys.argv:
    sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import extremities as E
    for nm,v,f in E.head(): add(nm,'body',[],v,f,[[si['head']]*2]*len(v),[[1,0]]*len(v))
    for side in 'LR':
        for nm,v,f in E.hand(side): add(nm,'body',[],v,f,[[si[side+'hand']]*2]*len(v),[[1,0]]*len(v))
        for nm,v,f in E.foot(side): add(nm,'body',[],v,f,[[si[side+'foot']]*2]*len(v),[[1,0]]*len(v))
else:
    ellipsoid([0,-10,1705],[76,94,108],'head','head',kind='body'); ellipsoid([0,-42,1640],[60,64,62],'head','jaw',kind='body')
    for side in 'LR':
        sg=1 if side=='L' else -1; w=J[side+'wr']; ellipsoid(w+[sg*2,-5,-70],[42,17,80],side+'hand',side+'palm',10,16,'body')
        a=J[side+'ank']; ellipsoid(a+[sg*6,-60,-45],[46,130,36],side+'foot',side+'foot',10,16,'body')
Va=np.concatenate(V); Fa=np.concatenate(F); bi=np.concatenate(BI); bw=np.concatenate(BW); fb=np.concatenate(FIB)
D=arg('--out','web_own3'); os.makedirs(D,exist_ok=True)
Va.astype(np.float32).tofile(D+'/V.bin'); Fa.astype(np.uint32).tofile(D+'/F.bin'); bi.astype(np.uint8).tofile(D+'/bi.bin'); bw.astype(np.float32).tofile(D+'/bw.bin'); fb.astype(np.float32).tofile(D+'/fib.bin')
json.dump(dict(parts=parts,joints={k:v.tolist() for k,v in J.items()},seg=SEG,n=len(Va),own=True,fib3=True,ground=0),open(D+'/meta.json','w'))
print(len(Va),len(Fa),len(parts))
