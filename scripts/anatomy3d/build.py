# Joints, skin weights and highlight groups for the BodyParts3D figure. Output: web/*.bin + web/meta.json
import json, re, numpy as np, os
V=np.load('V.npy').astype(np.float64); F=np.load('F.npy'); P=json.load(open('parts.json'))
N=len(V); part=np.zeros(N,np.int32)
for i,p in enumerate(P): part[p['v0']:p['v0']+p['nv']]=i
def pv(name): 
    p=next(p for p in P if p['name']==name); return V[p['v0']:p['v0']+p['nv']]
def cen(v,mask): return v[mask].mean(0)
J={}
for S,sg in (('Left',1),('Right',-1)):
    fe=pv(f'{S} femur'); top=fe[fe[:,2]>fe[:,2].max()-50]; med=top[(top[:,0]*sg)<(top[:,0]*sg).min()+45]
    hip=np.array([sg*((fe[:,0]*sg).min()+26),med[:,1].mean(),fe[:,2].max()-27]); ti=pv(f'{S} tibia')
    knee=(cen(fe,fe[:,2]<fe[:,2].min()+25)+cen(ti,ti[:,2]>ti[:,2].max()-20))/2
    ta=pv(f'{S} talus'); ank=np.array([ta[:,0].mean(),cen(ti,ti[:,2]<ti[:,2].min()+20)[1],ta[:,2].max()-8])
    hu=pv(f'{S} humerus'); sh=cen(hu,hu[:,2]>hu[:,2].max()-42); el=cen(hu,hu[:,2]<hu[:,2].min()+18)
    ra=pv(f'{S} radius'); ul=pv(f'{S} ulna'); wr=(cen(ra,ra[:,2]<ra[:,2].min()+12)+cen(ul,ul[:,2]<ul[:,2].min()+12))/2
    mf=pv(f'Distal phalanx of {S.lower()} middle finger'); tip=mf.mean(0)
    k=S[0]
    J.update({k+'hip':hip,k+'knee':knee,k+'ank':ank,k+'sh':sh,k+'el':el,k+'wr':wr,k+'tip':tip})
J['lum']=pv('Fifth lumbar vertebra').mean(0)*[0,1,1]; J['chest']=pv('Twelfth thoracic vertebra').mean(0)*[0,1,1]
J['neck']=pv('Seventh cervical vertebra').mean(0)*[0,1,1]; J['head']=pv('Atlas').mean(0)*[0,1,1]
J['pel']=(J['Lhip']+J['Rhip'])/2
for k,v in J.items(): print(k,np.round(v))
SEG=['pelvis','lumbar','chest','neck','head','Lupper','Lfore','Lhand','Rupper','Rfore','Rhand','Lthigh','Lshank','Lfoot','Rthigh','Rshank','Rfoot']
si={s:i for i,s in enumerate(SEG)}
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
W=np.zeros((N,len(SEG)))
z=V[:,2]
# trunk weights by height
def trunk(idx):
    zz=z[idx]; a=ss(905,965,zz); b=ss(1040,1110,zz); c=ss(1350,1400,zz); d=ss(1440,1485,zz)
    w=np.zeros((len(idx),len(SEG)))
    w[:,0]=1-a; w[:,1]=a*(1-b); w[:,2]=b*(1-c); w[:,3]=c*(1-d); w[:,4]=d
    return w
def segdist(p,a,b):
    ab=b-a; t=np.clip(((p-a)@ab)/(ab@ab),0,1); return np.linalg.norm(p-(a+t[:,None]*ab),axis=1)
def chain(idx,side,arm):
    k=side; p=V[idx]
    if arm: j=[J[k+'sh'],J[k+'el'],J[k+'wr'],J[k+'tip']]; bl=[(-15,45),(-30,30),(-14,14)]; r0,r1=48,95
    else:
        foot=J[k+'ank']+np.array([0,-150,-60.]); j=[J[k+'hip'],J[k+'knee'],J[k+'ank'],foot]; bl=[(-35,70),(-38,38),(-18,22)]; r0,r1=95,135
    d=np.minimum.reduce([segdist(p,j[i],j[i+1]) for i in range(3)])
    ax=[(j[i+1]-j[i])/np.linalg.norm(j[i+1]-j[i]) for i in range(3)]
    s2=ss(*bl[1],(p-j[1])@ax[1])
    s1=ss(*bl[0],(p-j[0])@ax[0])*(1-ss(r0,r1,d)*(1-s2))
    s3=ss(*bl[2],(j[2][2]-p[:,2]) if not arm else (p-j[2])@ax[1])
    s2=np.minimum(s2,1)*(s1>0); s3=s3*(s2>0.5)
    w=trunk(idx)*(1-s1)[:,None]
    names=[k+'upper',k+'fore',k+'hand'] if arm else [k+'thigh',k+'shank',k+'foot']
    w[:,si[names[0]]]=s1*(1-s2); w[:,si[names[1]]]=s1*s2*(1-s3); w[:,si[names[2]]]=s1*s2*s3
    return w
ARM=re.compile(r'deltoid|pectoralis major|teres|supraspinatus|infraspinatus|subscapularis|coracobrachialis|biceps brachii|triceps|brachialis|brachioradialis|anconeus',re.I)
PELV=re.compile(r'coccyg|puborect|sphincter|obturator internus|levator',re.I)
RIGID=[(r'femur','thigh'),(r'tibia|fibula|patella|interosseous membrane of leg','shank'),(r'calcaneus|talus|cuboid|cuneiform bone|navicular bone of|metatarsal|toe|sesamoid bone of \w+ foot','foot'),
       (r'humerus','upper'),(r'radius|ulna|interosseous membrane of forearm','fore'),(r'metacarpal|finger|thumb|capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetral','hand')]
for i,p in enumerate(P):
    idx=np.arange(p['v0'],p['v0']+p['nv']); n=p['name']; c=np.array(p['c']); side='L' if c[0]>0 else 'R'
    if p['kind']=='skin': continue
    done=False
    if p['kind'] in('bone','lig'):
        for rx,sname in RIGID:
            if re.search(rx,n,re.I) and not re.search('rib|vertebra',n,re.I):
                W[idx,si[side+sname]]=1; done=True; break
        if not done and p['kind']=='bone':
            if re.search('hip bone|sacrum',n,re.I): W[idx,0]=1
            elif 'lumbar' in n: W[idx]=trunk(np.array([idx[0]]*1))[0] if False else 0; W[idx,1 if 'Fifth' not in n else 1]=1
            elif re.search('cervical|Axis',n): W[idx,3]=1
            elif re.search('thoracic|rib|sternum|Manubrium|Xiphoid|clavicle|scapula',n): W[idx,2]=1
            else: W[idx,4]=1
            done=True
    if done: continue
    if p['kind']=='cart':
        if 'costal' in n: W[idx,2]=1
        else: W[idx]=trunk(idx)
        continue
    arm = bool(ARM.search(n)) or (abs(c[0])>185 and c[2]<1250)
    if arm: W[idx]=chain(idx,side,True)
    elif c[2]>965 or PELV.search(n): W[idx]=trunk(idx)
    else: W[idx]=chain(idx,side,False)
# skin: weights for every skin vertex by nearest region rule (used for head, hands, feet and filler patches)
sk=next(i for i,p in enumerate(P) if p['kind']=='skin'); sp=P[sk]; idx=np.arange(sp['v0'],sp['v0']+sp['nv']); p=V[idx]
w=trunk(idx)
for k in 'LR':
    sg=1 if k=='L' else -1
    armm=(p[:,0]*sg>150)&(p[:,2]<1330)&(segdist(p,J[k+'sh'],J[k+'el'])<95)|((p[:,0]*sg>178)&(p[:,2]<1100))
    armm&=~((np.abs(p[:,0])<165)&(p[:,2]>940)&(p[:,2]<1270)&(p[:,1]>-75))
    legm=(p[:,0]*sg>0)&(p[:,2]<J[k+'hip'][2]+40)&~armm
    if armm.any(): w[armm]=chain(idx[armm],k,True)
    if legm.any(): w[legm]=chain(idx[legm],k,False)
W[idx]=w
W/=W.sum(1,keepdims=True).clip(1e-9)
# keep the two largest influences
o=np.argsort(-W,axis=1)[:,:2]; ww=np.take_along_axis(W,o,1); ww/=ww.sum(1,keepdims=True)
# highlight groups
GR=[('quads',r'rectus femoris|vastus'),('glutes',r'gluteus maximus'),('hams',r'biceps femoris|semitendinosus|semimembranosus'),('adductors',r'adductor'),
    ('calves',r'gastrocnemius|soleus'),('chest',r'pectoralis major'),('delts',r'deltoid'),('frontdelt',r'clavicular part of \w+ deltoid'),('biceps',r'biceps brachii|coracobrachialis'),('triceps',r'triceps'),
    ('serratus',r'serratus anterior'),('erectors',r'longissimus thoracis|iliocostalis|spinalis'),('traps',r'trapezius')]
meta=[]
for p in P:
    g=[k for k,rx in GR if re.search(rx,p['name'],re.I)]
    meta.append(dict(name=p['name'],kind=p['kind'],v0=p['v0'],nv=p['nv'],f0=p['f0'],nf=p['nf'],groups=g))
os.makedirs('web',exist_ok=True)
V.astype(np.float32).tofile('web/V.bin'); F.astype(np.uint32).tofile('web/F.bin'); o.astype(np.uint8).tofile('web/bi.bin'); ww.astype(np.float32).tofile('web/bw.bin')
json.dump(dict(parts=meta,joints={k:v.tolist() for k,v in J.items()},seg=SEG,n=N),open('web/meta.json','w'))
print('ok',N)
