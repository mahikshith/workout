# Reads BodyParts3D OBJ parts (muscles, bones, cartilage, skin) into flat arrays.
import sys, os, re, json, glob, collections, numpy as np
B=sys.argv[1]; OUT=sys.argv[2]
rows=[l.rstrip('\n').split('\t') for l in open(B+'/isa_element_parts.txt')][1:]
isa=collections.defaultdict(set)
for cid,name,e in rows: isa[e].add(name)
MUS=re.compile(r'pectoralis|deltoid|trapezius|biceps|triceps|gastrocnemius|rectus femoris|vastus|flexor (carpi|hallucis|pollicis)|pronator teres|longus colli|interossei|lumbricals|intertransversarii|interspinales|levatores|coccygeus|puborectalis',re.I)
BONE=re.compile(r'sternum|manubrium|xiphoid',re.I)
CART=re.compile(r'costal cartilage',re.I)
LIG=re.compile(r'linea alba|interosseous membrane|calcaneal tendon',re.I)
DROP=re.compile(r'rectus$|oblique$|palpebrae|aryt|pharyn|palat|uvul|vocal|glossus|cricoid|thyroid|cuneiform cartilage|corniculate|nasal|alar|anal|trochlea|intermediate tendon|levator ani|epiglott',re.I)
def kind_of(e,name):
    s=isa[e]; n=re.sub(r'\b(left|right)\b ?','',name,flags=re.I).strip()
    if name=='Skin': return 'skin'
    if DROP.search(n) and 'femoris' not in n and 'abdom' not in n and 'external oblique' not in n.lower() and 'capitis' not in n: return None
    if 'bone organ' in s or BONE.search(n): return 'bone'
    if 'muscle organ' in s or MUS.search(n): return 'muscle'
    if 'cartilage organ' in s or CART.search(n): return 'cart'
    if LIG.search(n): return 'lig'
    return None
parts=[]; V=[]; F=[]; off=0; nf=0
for p in sorted(glob.glob(f'{B}/isa_BP3D_4.0_obj_99/*.obj')):
    e=os.path.basename(p)[:-4]; name=''; vs=[]; fs=[]; k=None
    with open(p) as fh:
        for l in fh:
            if l.startswith('# English name'):
                name=l.split(':',1)[1].strip(); k=kind_of(e,name)
                if not k: break
            elif l.startswith('v '): vs.append(l.split()[1:4])
            elif l.startswith('f '): fs.append([int(x.split('/')[0])-1 for x in l.split()[1:4]])
    if not k or not vs: continue
    v=np.array(vs,dtype=np.float32); f=np.array(fs,dtype=np.uint32)
    parts.append(dict(id=e,name=name,kind=k,v0=off,nv=len(v),f0=nf,nf=len(f),lo=v.min(0).tolist(),hi=v.max(0).tolist(),c=v.mean(0).tolist()))
    V.append(v); F.append(f+off); off+=len(v); nf+=len(f)
V=np.concatenate(V); F=np.concatenate(F)
np.save(OUT+'/V.npy',V); np.save(OUT+'/F.npy',F); json.dump(parts,open(OUT+'/parts.json','w'))
print(len(parts),V.shape,F.shape); print(collections.Counter(p['kind'] for p in parts))
