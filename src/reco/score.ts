// Exercise scoring: for one person and one target (a muscle, a movement or a kind of work), which exercises fit best
// and why. Two steps:
//   1. blocked(): hard rules. An exercise the person cannot do here, should not do (safety), or has not earned yet is
//      never suggested. The same string explains it when they open that exercise.
//   2. scoreExercise(): 40 points plus or minus small amounts for goal, level, body and age, history and balance.
//      Every amount that counts can carry a short reason; the top three are shown.
// Pure TypeScript. The scoring table is documented in docs/round14/engine.md; keep the two in step.
import { available, byId, exercises, type Exercise } from '../data/exercises';
import { benefit, GROUPS, office } from '../data/muscles';
import { gate, hidden } from '../engine';
import type { Goal } from '../store';
import { buildPerson, type Person } from './model';
import { mainMuscle, sayMuscle, traitsOf, type Kind, type Pattern, type Traits } from './traits';

export type Target = { muscles?: string[]; pattern?: Pattern; kind?: Kind };
export type Scored = { ex: Exercise; score: number; reasons: string[] };

const HOUR = 3600000;

// --- 1. hard rules ---
// Returns why the exercise is not offered to this person right now, or null when it can be.
export function blocked(person: Person, e: Exercise): string | null {
  const p = person.profile, t = traitsOf(e);
  if (!available(e, person.place, person.gear)) return person.place === 'home' ? `Needs ${/pull-?up|chin|hang/i.test(e.name) ? 'a pull-up bar' : e.equipment === 'other' ? 'gym equipment' : e.equipment === 'machine' || e.equipment === 'cable' ? `a ${e.equipment}` : e.equipment}, which you do not have at home.` : 'Needs equipment you do not have here.';
  if (person.office && !office(e)) return 'Not a move for the office.';
  const safe = hidden(e, p);
  if (safe) return safe;
  const lock = gate(e, p, person.sessionsDone);
  if (lock.locked) return lock.reason ?? 'Not open for you yet.';
  if (t.kind === 'special') return null;
  // Level: a stated beginner never gets advanced moves, and gets harder ones only after six sessions.
  const allowed = person.level === 2 ? 2 : person.level === 1 ? 1 : person.sessionsDone >= 6 ? 1 : 0;
  if (t.hardness > allowed) return t.hardness === 2 ? 'An advanced move. It opens when you have more training behind you.' : 'A harder move than you need right now. It opens after a few more sessions.';
  if (t.impact && person.lowImpact) return `${person.lowImpactWhy}.`;
  if (t.straining && (person.ageBand === 'senior' || person.ageBand === 'teen') && person.level < 2) return person.ageBand === 'teen' ? 'Very heavy lifts wait until you are older.' : 'Very heavy lifts are left out to protect your joints and back.';
  if (t.straining && person.back) return 'Left out for now because of your back.';
  if (t.risky && person.level < 2) return 'This position bothers many shoulders and backs. There are safer moves for the same muscle.';
  if (person.heavy && t.ownWeight && /pull-?up|chin-?up|\bdips?\b|handstand|muscle|pistol|burpee|sprawl|squat thrust/i.test(e.name)) return 'Very hard at a higher body weight. Supported versions work the same muscles.';
  return null;
}

// Suggestions also leave out specialist lifts that need unusual kit or coaching; the person can still pick them by hand.
function suggestable(person: Person, e: Exercise, t: Traits): boolean {
  if (t.odd || t.risky) return false;
  if (e.category === 'olympic weightlifting') return t.staple;
  if (e.category === 'powerlifting') return t.staple || (person.level >= 1 && person.profile.goal === 'get stronger' && !/band|chain/i.test(e.name));
  if (e.equipment === 'foam roll' && person.place === 'home' && !person.gear.includes('foam roll')) return false;
  return true;
}

// --- 2. scoring ---
// Per goal: points for the shape of a strength exercise. [compound, single-joint, barbell, dumbbell or kettlebell,
// machine or cable, body weight, one side at a time, hold]
const SHAPE: Record<Goal, number[]> = {
  'build muscle': [10, 4, 2, 3, 3, 0, 0, -2],
  'gain weight': [14, 0, 4, 3, 2, -2, 0, -4],
  'get stronger': [16, -6, 6, 2, 0, -2, 0, -2],
  'lose fat': [12, -4, 0, 3, 0, 3, 2, 0],
  'tone up': [8, 3, -2, 4, 2, 3, 2, 2],
  'stay fit': [10, -2, -2, 3, 1, 4, 1, 2],
  endurance: [8, -6, -4, 2, 0, 5, 2, 2],
  mobility: [4, -4, -10, 1, -2, 6, 3, 6],
  athletic: [12, -6, 2, 3, -4, 3, 5, 2],
};
const COMPOUND_WHY: Record<Goal, string> = {
  'build muscle': 'Works several muscles at once, the fastest way to grow',
  'gain weight': 'A big lift that adds the most size',
  'get stronger': 'A big lift you can keep adding weight to',
  'lose fat': 'Uses a lot of muscle, so it burns more',
  'tone up': 'Firms several muscles in one move',
  'stay fit': 'One move that trains a lot of you',
  endurance: 'Keeps many muscles working for longer',
  mobility: 'Strength through a full, easy range',
  athletic: 'Whole-body strength that carries over to sport',
};

type Factor = [number, string?];

function strengthFactors(person: Person, e: Exercise, t: Traits, f: Factor[]) {
  const g = person.profile.goal, s = SHAPE[g] ?? SHAPE['stay fit'];
  const free = e.equipment === 'dumbbell' || e.equipment === 'kettlebells';
  const guided = e.equipment === 'machine' || e.equipment === 'cable';
  f.push(t.compound ? [s[0], COMPOUND_WHY[g]] : [s[1], s[1] > 0 ? 'Works the muscle directly' : undefined]);
  if (e.equipment === 'barbell') f.push([s[2]]);
  if (free) f.push([s[3]]);
  if (guided) f.push([s[4]]);
  if (e.equipment === 'body only') f.push([s[5], s[5] >= 4 ? 'Uses your own body weight' : undefined]);
  if (t.unilateral) f.push([s[6], s[6] >= 3 ? 'One side at a time, for balance' : undefined]);
  if (t.hold) f.push([s[7], s[7] >= 4 ? 'A steady hold that builds control' : undefined]);

  // Level.
  if (person.level === 0) {
    if (t.hardness === 0) f.push([6]);
    if (t.supported) f.push([5, 'Guided, so it is easy to learn']);
    else if (free || e.equipment === 'body only') f.push([2]);
    if (e.equipment === 'barbell') f.push([t.staple ? -2 : -6]);
    if (t.unilateral && t.compound) f.push([-2]);
  } else if (person.level === 1) {
    if (t.hardness === 1) f.push([3]);
  } else {
    if (t.hardness >= 1) f.push([5, 'A harder move to match your experience']);
    if (guided && t.compound) f.push([-2]);
    if (e.equipment === 'barbell') f.push([3]);
  }

  // Body, age, joints.
  if (person.heavy) {
    if (t.supported) f.push([6, 'Supported, easy on your joints']);
    if (t.ownWeight) f.push([-10]);
    if (t.easedOwnWeight) f.push([5, 'A lighter version that suits you now']);
    if (t.unilateral && t.region === 'lower') f.push([-4]);
  }
  if (person.weightClass === 'under' && t.compound && (free || e.equipment === 'barbell' || guided)) f.push([3]);
  if (person.ageBand === 'senior') {
    if (t.supported) f.push([5, 'Steady and supported']);
    if (e.equipment === 'barbell' && /overhead|military|press/i.test(e.name) && t.pattern === 'press') f.push([-6]);
    if (t.unilateral && t.region === 'lower' && !t.supported) f.push([-3]);
    if (t.pattern === 'hinge' || t.pattern === 'squat' || t.pattern === 'carry') f.push([2]);
  }
  if (person.ageBand === 'teen' && (e.equipment === 'body only' || free)) f.push([3]);
  if (person.back && t.supported) f.push([4, 'Kind to your back']);
  if (person.knee && t.region === 'lower' && (t.supported || t.pattern === 'hinge')) f.push([4, 'Easy on your knees']);
  if (person.profile.concerns?.includes('posture') && (t.pattern === 'row' || /face pull|pull apart|rear|reverse fl|y-raise|t-raise/i.test(e.name))) f.push([5, 'Strengthens the muscles that hold you upright']);
  if (person.profile.concerns?.includes('tone') && person.profile.gender === 'female' && mainMuscle(e) === 'glutes') f.push([3]);

  // Balance over the last two weeks.
  const lag = person.history.lagging;
  if (t.side !== 'none' && lag.includes(t.side)) f.push([6, t.side === 'pull' ? 'Evens out your pushing and pulling' : 'You have pulled more than pushed lately']);
  if ((t.region === 'upper' || t.region === 'lower') && lag.includes(t.region)) f.push([5, t.region === 'lower' ? 'Your legs have had less work lately' : 'Your upper body has had less work lately']);
  if (t.face !== 'none' && lag.includes(t.face)) f.push([4, t.face === 'back' ? 'Works the back of your body, which is behind' : undefined]);
}

function cardioFactors(person: Person, e: Exercise, t: Traits, f: Factor[]) {
  const g = person.profile.goal;
  const smooth = /bike|bicycl|elliptical|walk|row|swim|march|recumbent|ski/i.test(e.name);
  const steady = e.category === 'cardio' || /march/i.test(e.name);
  if (e.equipment === 'machine') f.push([5, 'You set the pace yourself']);
  if (smooth) f.push([person.lowImpact ? 10 : 2, person.lowImpact ? 'No pounding on your joints' : undefined]);
  if (g === 'endurance') f.push(steady ? [8, 'Steady work builds stamina'] : [2]);
  if (g === 'lose fat' || g === 'tone up') f.push(steady ? [4, 'Burns energy without wearing you out'] : [5, 'Short bursts that burn a lot']);
  if (g === 'athletic') f.push(steady ? [0] : [8, 'Fast bursts, like sport']);
  if (g === 'stay fit' || g === 'mobility') f.push(steady ? [5, 'Good for your heart'] : [1]);
  if (person.level === 0) f.push([t.hardness === 0 && steady ? 5 : 0]);
  if (person.heavy && t.ownWeight) f.push([-12]);
  if (person.ageBand === 'senior' && /walk|bike|recumbent|march/i.test(e.name)) f.push([4]);
  if (/stairmaster|step mill/i.test(e.name) && person.knee) f.push([-10]);
}

function mobilityFactors(person: Person, e: Exercise, t: Traits, f: Factor[]) {
  const sits = person.profile.concerns?.some((c) => c === 'desk' || c === 'posture') || ['desk', 'wfh', 'student', 'driving'].includes(person.profile.lifestyle ?? '');
  if (e.level === 'beginner') f.push([4]);
  if (e.equipment === 'body only') f.push([3]);
  if (sits && ['chest', 'quadriceps', 'neck', 'middle back', 'glutes', 'lower back'].includes(mainMuscle(e))) f.push([4, 'Undoes hours of sitting']);
  if (person.back && mainMuscle(e) === 'lower back') f.push([3, 'Gentle on a sore back']);
  if (person.ageBand === 'senior' && /standing|wall|chair|seated/i.test(e.name)) f.push([3, 'No getting down on the floor']);
  if (person.heavy && /standing|wall|chair|seated/i.test(e.name)) f.push([3]);
}

export function scoreExercise(person: Person, e: Exercise, target?: Target): Scored {
  const t = traitsOf(e);
  const f: Factor[] = [];
  if (target?.muscles?.length) f.push(target.muscles.includes(mainMuscle(e)) ? [12] : e.secondary.some((m) => target.muscles!.includes(m)) ? [-6] : [-20]);
  if (target?.pattern) f.push(t.pattern === target.pattern ? [8] : [-4]);
  if (t.staple) f.push([10, 'A tried and tested basic']);
  if (t.odd) f.push([-14]);
  if (e.art || (!e.noPhoto && !e.noImages)) f.push([2]);

  if (t.kind === 'cardio') cardioFactors(person, e, t, f);
  else if (t.kind === 'mobility') mobilityFactors(person, e, t, f);
  else if (t.kind === 'power') {
    f.push(person.profile.goal === 'athletic' ? [12, 'Builds spring and speed'] : [-6]);
    if (person.level === 0 && t.hardness === 0) f.push([4]);
  } else if (t.kind === 'strength') strengthFactors(person, e, t, f);

  // What this exercise has done for them so far.
  const h = person.history.ex[e.id];
  if (h) {
    if (person.now - h.lastAt < 40 * HOUR) f.push([-10]);
    if (h.progressed) f.push([8, 'You are getting better at this one']);
    else if (h.stalled) f.push([-4]);
    else f.push([4, 'You know this one']);
  } else if (person.history.sessions >= 12 && t.staple) f.push([2, 'A new move for a muscle you train often']);

  const score = Math.max(0, Math.min(100, Math.round(40 + f.reduce((a, [w]) => a + w, 0))));
  const seen = new Set<string>();
  const reasons = f.filter(([w, why]) => w > 0 && !!why).sort((a, b) => b[0] - a[0]).map(([, why]) => why!).filter((w) => !seen.has(w) && !!seen.add(w)).slice(0, 3);
  if (!reasons.length) reasons.push(benefit(e).replace(/\.$/, ''));
  return { ex: e, score, reasons };
}

// Everything the person can be offered, by kind. Worked out once per person (the hard rules don't depend on the target).
const POOL = new WeakMap<Person, Partial<Record<Kind, Exercise[]>>>();
function pool(person: Person, kind: Kind): Exercise[] {
  let cache = POOL.get(person);
  if (!cache) POOL.set(person, (cache = {}));
  return (cache[kind] ??= exercises.filter((e) => { const t = traitsOf(e); return t.kind === kind && suggestable(person, e, t) && !blocked(person, e); }));
}

// The best n exercises for a target, best first. Near-copies are thinned out (at most two per movement and
// equipment), so five suggestions are five different ideas, and ties break by id so the answer never shuffles.
export function rankExercises(person: Person, target: Target = {}, n = 5, exclude: Iterable<string> = []): Scored[] {
  const kind = target.kind ?? 'strength';
  const skip = new Set(exclude);
  const want = target.muscles;
  let list = pool(person, kind).filter((e) => !skip.has(e.id) && (!want?.length || want.includes(mainMuscle(e))));
  if (want?.length && list.length < n) list = [...list, ...pool(person, kind).filter((e) => !skip.has(e.id) && !want.includes(mainMuscle(e)) && e.secondary.some((m) => want.includes(m)))];
  const scored = list.map((e) => scoreExercise(person, e, target)).sort((a, b) => b.score - a.score || a.ex.id.localeCompare(b.ex.id));
  const out: Scored[] = [], seen: Record<string, number> = {};
  const roomy = scored.length > 3 * n; // with a small pool (home, no kit) every option is worth showing
  for (const s of scored) {
    const t = traitsOf(s.ex);
    const key = `${t.pattern}|${s.ex.equipment}|${mainMuscle(s.ex)}`;
    if (roomy && (seen[key] ?? 0) >= 2) continue;
    seen[key] = (seen[key] ?? 0) + 1;
    out.push(s);
    if (out.length >= n) break;
  }
  return out;
}

// A muscle name ("chest", "lats"), a group id from the Workouts tab ("back", "abs", "quads", "hips", "cardio",
// "mobility") or a wider word ("legs", "arms", "core") to a target.
export function targetFor(muscle: string): Target {
  const m = muscle.toLowerCase();
  if (m === 'cardio') return { kind: 'cardio' };
  if (m === 'mobility' || m === 'stretch') return { kind: 'mobility' };
  if (m === 'legs') return { muscles: ['quadriceps', 'hamstrings', 'glutes'] };
  if (m === 'arms') return { muscles: ['biceps', 'triceps'] };
  if (m === 'core') return { muscles: ['abdominals'] };
  const g = GROUPS.find((x) => x.id === m);
  if (g?.muscles) return { muscles: g.muscles };
  return { muscles: [m] };
}

export type Explained = { ok: boolean; fit: number; reasons: string[]; caution: string | null; instead: Scored[] };
// Why an exercise suits this person, or why it is not offered and what to do in its place.
export function explainExercise(person: Person, exId: string): Explained {
  const e = byId[exId];
  if (!e) return { ok: false, fit: 0, reasons: [], caution: 'We do not know this exercise.', instead: [] };
  const t = traitsOf(e);
  const caution = blocked(person, e);
  const s = scoreExercise(person, e, { muscles: [mainMuscle(e)] });
  let instead = caution && t.kind !== 'special' ? rankExercises(person, { muscles: [mainMuscle(e)], kind: t.kind }, 3, [e.id]) : [];
  // A jump or a sprint with nothing safe of its own kind: offer strength work for the same muscle.
  if (caution && !instead.length && (t.kind === 'power' || t.kind === 'cardio')) instead = rankExercises(person, { muscles: [mainMuscle(e)] }, 3, [e.id]);
  return { ok: !caution, fit: caution ? Math.min(30, s.score) : s.score, reasons: caution ? [`Trains your ${sayMuscle(mainMuscle(e))}`] : s.reasons, caution, instead };
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error('reco score: ' + m); };
export function selfCheck() {
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as never;
  const who = (x: object) => buildPerson({ profile: { ...(base as object), ...x } as never, now: Date.parse('2026-11-11T18:00:00') });
  const ids = (p: Person, m: string, n = 5) => rankExercises(p, targetFor(m), n).map((s) => s.ex.id);
  const beginner = who({});
  const chest = rankExercises(beginner, targetFor('chest'), 5);
  assert(chest.length === 5 && chest.every((s) => mainMuscle(s.ex) === 'chest' && s.reasons.length > 0 && s.score > 0 && s.score <= 100), 'five chest picks with reasons');
  assert(chest.every((s) => traitsOf(s.ex).hardness === 0 && !traitsOf(s.ex).odd), 'a beginner gets easy, ordinary moves');
  assert(JSON.stringify(ids(beginner, 'chest')) === JSON.stringify(ids(who({}), 'chest')), 'same person, same answer');
  // Home with nothing: body weight only. With dumbbells: dumbbells show up.
  const home = who({ place: 'home' });
  assert(rankExercises(home, targetFor('back'), 5).every((s) => available(s.ex, 'home', [])), 'home without kit stays body weight');
  assert(ids(who({ place: 'home', gear: ['dumbbell'] }), 'chest').some((id) => byId[id].equipment === 'dumbbell'), 'dumbbells are used when owned');
  // Heavy, knee: nothing that jumps or lunges, and no push-ups from the floor as the first pick.
  const heavyKnee = who({ weightKg: 110, concerns: ['knee'], goal: 'lose fat' });
  const legs = rankExercises(heavyKnee, targetFor('legs'), 8);
  assert(legs.length > 0 && legs.every((s) => !traitsOf(s.ex).impact && !hidden(s.ex, heavyKnee.profile)), 'heavy with a knee: no impact, nothing hidden');
  assert(!!blocked(heavyKnee, byId.Freehand_Jump_Squat) && !!blocked(heavyKnee, byId.Dumbbell_Lunges) && !!blocked(heavyKnee, byId.Pullups), 'jump squats, lunges and pull-ups are out');
  assert(rankExercises(heavyKnee, { kind: 'cardio' }, 4).every((s) => !traitsOf(s.ex).impact), 'low-impact cardio only');
  // Goals change the answer: strength wants the bar, mobility does not.
  const strong = who({ goal: 'get stronger', level: 'intermediate' }), supple = who({ goal: 'mobility', level: 'intermediate' });
  const bar = (p: Person) => rankExercises(p, targetFor('legs'), 6).filter((s) => s.ex.equipment === 'barbell').length;
  assert(bar(strong) > bar(supple), 'get stronger leans on the barbell more than move better');
  assert(rankExercises(supple, { kind: 'mobility' }, 6).length === 6, 'mobility picks exist');
  // Experts only for the advanced; explainExercise says why not and what instead.
  assert(!!blocked(beginner, byId['wg_pistol-squat']) && !blocked(who({ level: 'advanced' }), byId['wg_pistol-squat']), 'pistol squats are for the advanced');
  const why = explainExercise(heavyKnee, 'Freehand_Jump_Squat');
  assert(!why.ok && !!why.caution && why.instead.length > 0 && why.instead.every((s) => !blocked(heavyKnee, s.ex)), 'explain offers safe stand-ins');
  assert(explainExercise(beginner, 'Goblet_Squat').ok && explainExercise(beginner, 'Goblet_Squat').reasons.length > 0, 'explain a good pick');
  // Pregnancy: nothing hidden is ever ranked.
  const preg = who({ gender: 'female', women: { mode: 'pregnant' } });
  for (const m of ['chest', 'back', 'legs', 'core', 'cardio', 'mobility']) assert(rankExercises(preg, targetFor(m), 6).every((s) => !hidden(s.ex, preg.profile)), `pregnancy-safe ${m}`);
}
