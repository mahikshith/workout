# Muscle table. Each entry: (name, group, control points, width(s) mm, thickness(es) mm, flatness 0..1 [, kind])
# Control points: ('T', z, angle) on the torso (angle 0 = front midline, 90 = side, 180 = back midline),
# ('U'|'F'|'H'|'S', t, angle) on upper arm / forearm / thigh / shank (t 0..1 down the limb; angle 0 front, 90 outer, 180 back, 270 inner),
# ('X', x, y, z, segment) a free point. Written for the LEFT side; the right side is mirrored automatically.
# kind: 'muscle' (default) or 'fascia' (pale connective tissue sheet).
M=[
 # ---- hip: gluteus maximus (fibres run down and outward), gluteus medius fan, tensor fasciae latae, iliotibial band
 ('iliotibial band','fascia',[('H',.04,97),('H',.3,96),('H',.55,99),('H',.8,98),('H',.98,92),('S',.05,68)],[34,25,19,19,16,11],2,1,'fascia'),
 # deep layer: stays on the pelvis and converges on the trochanter, so the buttock keeps a cover when the hip flexes (hidden under the next three when standing)
 ('glute max deep upper','glutes',[('T',1030,152),('T',990,134),('T',952,121),('H',.06,104)],[30,44,42,18],[4,10,12,6],.8),
 ('glute max deep middle','glutes',[('T',990,168),('T',945,152),('T',910,137),('H',.11,108)],[30,46,44,18],[4,10,14,6],.8),
 ('glute max deep lower','glutes',[('T',946,178),('T',904,168),('T',880,152),('H',.15,116)],[28,44,42,18],[4,10,16,6],.8),
 ('glute max upper','glutes',[('T',1036,150),('T',986,132),('H',.07,112),('H',.19,102)],[34,48,42,16],[12,22,20,6],.8),
 ('glute max middle','glutes',[('T',996,168),('T',944,150),('H',.12,134),('H',.25,116)],[34,50,44,16],[12,24,22,6],.8),
 ('glute max lower','glutes',[('T',950,178),('T',900,161),('H',.14,158),('H',.27,138)],[32,48,46,16],[12,24,20,6],.8),
 ('glute medius anterior','glutemed',[('T',1044,84),('T',1030,86),('T',985,90),('H',.02,91),('H',.05,92)],[40,40,34,18,12],[6,12,14,10,6],.9),
 ('glute medius posterior','glutemed',[('T',1046,122),('T',1032,120),('T',990,111),('H',.025,102),('H',.055,100)],[40,40,34,18,12],[6,12,14,10,6],.9),
 ('tensor fasciae latae','glutemed',[('T',1030,64),('T',1016,65),('T',968,66),('H',.1,68),('H',.27,90)],[16,22,32,34,10],[6,10,14,14,4],.3),
 ('inguinal ligament','fascia',[('T',1014,60),('T',968,38),('T',928,16)],5,3,1,'fascia'),
 # ---- front of thigh
 ('quadriceps tendon','fascia',[('H',.8,0),('H',.94,0)],26,3,1,'fascia'),
 ('medial knee capsule','fascia',[('H',.94,304),('S',.08,322)],18,0,1,'fascia'),('lateral retinaculum','fascia',[('H',.87,60),('S',.03,44)],[22,10],0,1,'fascia'),
 ('vastus lateralis','quads',[('H',.04,72),('H',.1,63),('H',.3,56),('H',.6,56),('H',.85,44),('H',.96,22)],[32,46,60,64,48,14],[6,12,18,20,14,5],.3),
 ('vastus medialis','quads',[('H',.3,332),('H',.6,330),('H',.82,324),('H',.93,332),('H',.985,348)],[8,28,46,44,14],[6,12,22,22,6],.3),
 ('rectus femoris','quads',[('H',.03,40),('H',.2,17),('H',.5,2),('H',.78,1),('H',.93,0)],[14,40,50,34,20],[8,18,21,11,4],.3),
 ('iliopsoas','hipflexors',[('T',986,47),('H',.04,6),('H',.14,350),('H',.22,344)],[40,28,18,5],[3,5,5,2],.3),
 ('pectineus','adductors',[('T',950,29),('H',.06,334),('H',.19,322)],[34,26,6],[3,6,2],.3),
 ('adductor longus','adductors',[('T',918,12),('H',.15,300),('H',.35,296),('H',.52,314)],[14,34,34,8],[8,14,13,2],.5),
 ('adductor magnus','adductors',[('H',-.02,232),('H',.25,242),('H',.5,247),('H',.75,250)],[40,40,34,8],[12,18,14,5],.8),
 ('gracilis','adductors',[('T',895,6),('H',.2,274),('H',.5,270),('H',.8,262),('H',.98,266),('S',.03,270),('S',.13,316)],[12,20,20,13,8,7,7],8,.6),
 ('sartorius','sartorius',[('T',1014,60),('H',.1,24),('H',.3,348),('H',.5,316),('H',.7,292),('H',.86,279),('H',.98,276),('S',.03,280),('S',.14,324)],[15,15,15,15,15,14,12,10,10],7,.7),
 # ---- back of thigh
 ('semimembranosus','hams',[('H',.25,198),('H',.55,218),('H',.8,224),('S',.02,242)],[12,30,38,14],[2,14,16,6],.3),
 ('semitendinosus','hams',[('H',.08,192),('H',.4,188),('H',.7,190),('H',.88,204),('S',.04,246)],[22,38,30,10,6],[8,17,14,6,5],.5),
 ('biceps femoris','hams',[('H',.08,170),('H',.35,146),('H',.65,140),('H',.86,136),('S',.04,106)],[22,58,56,34,8],[8,18,18,10,5],.4),
 # ---- lower leg
 ('achilles tendon','fascia',[('S',.4,180),('S',.6,180),('S',.8,180),('S',1.0,180)],[44,34,16,11],[2,3,6,8],1,'fascia'),
 ('soleus lateral','calves',[('S',.1,116),('S',.14,117),('S',.35,124),('S',.6,146),('S',.76,165)],[12,16,24,22,8],10,.4),
 ('soleus medial','calves',[('S',.08,278),('S',.25,276),('S',.45,262),('S',.66,226),('S',.78,200)],[12,18,26,22,8],[5,8,10,10,8],.3),
 ('gastrocnemius lateral','calves',[('H',.93,160),('H',.97,158),('S',.08,160),('S',.27,164),('S',.44,172)],[12,22,44,50,20],[6,10,20,22,8],.4),
 ('gastrocnemius medial','calves',[('H',.93,198),('H',.97,202),('S',.08,216),('S',.3,215),('S',.5,192)],[12,22,60,70,20],[6,10,22,24,8],.4),
 ('deep flexors','calves',[('S',.34,268),('S',.52,284),('S',.75,268),('S',.97,250)],[6,12,14,8],[2,5,5,5],.2),
 ('tibial condyles','fascia',[('S',.06,292),('S',.06,330),('S',.06,0),('S',.06,30),('S',.06,64)],18,0,1,'fascia'),
 ('tibia','fascia',[('S',.07,324),('S',.4,316),('S',.75,304),('S',.99,292)],[20,17,14,13],0,1,'fascia'),
 ('fibula','fascia',[('S',.7,84),('S',.99,96)],9,1,1,'fascia'),
 ('patellar tendon','fascia',[('S',.04,0),('S',.16,0)],12,6,1,'fascia'),
 ('tibialis anterior','shins',[('S',.05,30),('S',.09,28),('S',.3,18),('S',.6,8),('S',.98,345)],[12,18,27,20,6],[6,10,14,10,4],.2),
 ('toe extensors','shins',[('S',.07,62),('S',.11,61),('S',.4,54),('S',.75,38),('S',.98,20)],[8,12,18,14,8],8,.3),
 ('fibularis','shins',[('S',.03,94),('S',.07,93),('S',.3,90),('S',.65,104),('S',.98,128)],[8,12,22,15,5],[6,8,12,8,4],.3),
 # ---- kept from the earlier table (upper back/neck)
 ('neck extensors','neck',[('T',1596,150),('T',1525,166)],34,9,.6),
 ('rhomboids','rhomboids',[('T',1420,176),('T',1380,150)],60,8,.7),
]
