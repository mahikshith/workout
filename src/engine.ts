// The reasoning engine: plain rules over the profile, today's check-in, body context and history.
// Every decision carries a one-line reason in plain words. Pure functions, so a backend can later return the same shapes.
import type { Ionicons } from '@expo/vector-icons';
import { cycle, dayKey, postpartumWeek, pregnancyWeek, targets } from './calc';
import { byId, title, type Exercise } from './data/exercises';
import { proteinPicks } from './data/foods';
import { planById, type Day } from './data/plans';
import { quick, type Quick } from './data/quick';
import type { Meal, Mood, Profile, Session } from './store';

export type EngineInput = {
  profile: Profile; sessions: Session[]; meals: Meal[]; water: Record<string, number>;
  checkins: Record<string, Mood>; planId: string; nextDay: number; dismissed?: Record<string, string>;
};

const DAY = 86400000;
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0;
const pick = <T,>(xs: T[], seed: string) => xs[hash(seed) % xs.length];

// --- exercise traits (from names and categories; conservative on purpose) ---
const has = (e: Exercise, re: RegExp) => re.test(e.name);
const impact = (e: Exercise) => e.category === 'plyometrics' || has(e, /jump|hop|burpee|skip|sprint|bound|jack|scissor|run|plyo|clap/i);
const onBackOrFront = (e: Exercise) => has(e, /lying|supine|prone|bench press|floor press|crunch|sit-?up|dead bug|bridge|hip thrust|leg raise|flutter|pullover|skull|superman|reverse fly/i);
const straining = (e: Exercise) =>
  ['olympic weightlifting', 'strongman', 'powerlifting'].includes(e.category) || e.level === 'expert' || has(e, /deadlift|clean|snatch|jerk|good morning/i);
const crunchy = (e: Exercise) => has(e, /crunch|sit-?up|v-?up|jackknife|roller|rollout|toes to bar|leg raise|russian twist|bicycle|air bike|knee raise|jack ?knife/i);
const kneeHeavy = (e: Exercise) => impact(e) || has(e, /lunge|pistol|sissy|leg extension|step-?up|split squat|full squat|deep squat/i);
const backHeavy = (e: Exercise) =>
  has(e, /deadlift|good morning|bent over|hyperextension|back extension|clean|snatch|sit-?up|superman/i) ||
  (e.equipment === 'barbell' && has(e, /squat|row|military|overhead/i));

// Safety filters: a hidden exercise is never offered, only explained. Lifted by changing the mode, not by a tap.
export function hidden(e: Exercise, p: Profile): string | null {
  const pw = pregnancyWeek(p);
  if (pw !== null) {
    if (impact(e)) return 'Jumping and impact moves are paused during pregnancy.';
    if (straining(e)) return 'Heavy straining moves are paused during pregnancy.';
    if (crunchy(e)) return 'Crunch-style moves are paused during pregnancy.';
    if (pw >= 14 && onBackOrFront(e)) return 'Lying flat on your back or front is paused after the first trimester.';
  }
  const pp = postpartumWeek(p);
  if (pp !== null && pp < 12) {
    if (impact(e) || crunchy(e) || has(e, /plank/i)) return 'Paused until about 12 weeks after birth, or until your doctor clears you.';
    if (pp < 6 && (straining(e) || e.level !== 'beginner')) return 'Easy moves only in the first 6 weeks after birth.';
  }
  if (p.concerns?.includes('knee') && kneeHeavy(e)) return 'Hidden for now because of your knee. Gentler options are below.';
  if (p.concerns?.includes('back') && backHeavy(e)) return 'Hidden for now because of your back. Gentler options are below.';
  return null;
}

export const UNLOCK = { intermediate: 6, expert: 20 };
const FUNNY = [
  'Whoa there, future legend.',
  'Easy, superhero.',
  'Respect the ambition.',
  'Your future self says hi. Not yet, though.',
];

export type Lock = { locked: boolean; title?: string; reason?: string; safety?: boolean; sessionsLeft?: number };

// Level locks: beginners earn harder moves by training, so the first week doesn't end in soreness and an uninstall.
export function gate(e: Exercise, p: Profile, sessionsDone: number): Lock {
  const safe = hidden(e, p);
  if (safe) return { locked: true, title: 'Paused for your safety', reason: safe, safety: true };
  if (e.level === 'intermediate' && p.level === 'beginner' && sessionsDone < UNLOCK.intermediate) {
    const left = UNLOCK.intermediate - sessionsDone;
    return {
      locked: true, sessionsLeft: left, title: pick(FUNNY, e.id),
      reason: `Moves like this can wreck your week if your body isn't ready. Finish ${left} more session${left > 1 ? 's' : ''} and it unlocks.`,
    };
  }
  if (e.level === 'expert' && p.level !== 'advanced' && sessionsDone < UNLOCK.expert) {
    const left = UNLOCK.expert - sessionsDone;
    return {
      locked: true, sessionsLeft: left, title: pick(FUNNY, e.id),
      reason: `This is an expert move. Most people who jump straight in get sore, frustrated and quit. ${left} more sessions and it's yours.`,
    };
  }
  return { locked: false };
}

// Quick sessions in the order that fits this person right now. A desk day gets desk, eye and Kegel breaks in work hours;
// a standing job gets floor-based recovery; an active job gets mobility; chores at home get short no-space strength.
// Sessions needing gear the person lacks, or containing moves their safety filters hide, are left out.
export function quickFor(p: Profile, now = Date.now()): Quick[] {
  const hour = new Date(now).getHours();
  const work = hour >= 9 && hour < 18;
  const sitting = p.lifestyle === 'desk' || p.lifestyle === 'student' || p.lifestyle === 'driving' || p.concerns?.includes('desk');
  const period = cycle(p)?.phase === 'period';
  const score = (q: Quick) => {
    const t = (x: string) => q.tags.includes(x as never);
    let s = -q.minutes / 10;
    if (t('period')) s += period ? 50 : -50;
    if (sitting && work && (t('desk') || t('eyes') || t('pelvic'))) s += 30;
    if (p.lifestyle === 'standing' && (t('mobility') || t('calm'))) s += 25;
    if (p.lifestyle === 'active' && t('mobility')) s += 25;
    if (p.lifestyle === 'home' && (t('strength') || t('core')) && q.minutes <= 15) s += 20;
    if (hour < 11 && t('morning')) s += 25;
    if (hour >= 19 && (t('calm') || t('mobility'))) s += 20;
    return s;
  };
  return quick
    .filter((q) => !(q.tags.includes('period') && p.gender !== 'female'))
    .filter((q) => !q.gear?.some((g) => !p.gear.includes(g)) && q.slots.every((sl) => !byId[sl.id] || !hidden(byId[sl.id], p)))
    .sort((a, b) => score(b) - score(a));
}

export const tone = (p: Profile) => (p.concerns?.some((x) => x === 'stressed' || x === 'breakup' || x === 'food') ? 'gentle' : 'playful');

// --- today's suggestion ---
export type Suggestion = { kind: 'plan' | 'light' | 'rest' | 'gentle'; title: string; reason: string; day: Day; dayIndex?: number; planId?: string; minutes: number };

const minutesOf = (d: Day) => Math.max(5, Math.round(d.slots.reduce((m, s) => m + s.sets * (45 + s.rest), 0) / 60 / 5) * 5);
const musclesOf = (d: Day) => new Set(d.slots.map((s) => byId[s.id]?.primary[0]).filter(Boolean));

export function suggest(i: EngineInput, now = Date.now()): Suggestion {
  const { profile: p, sessions } = i;
  const plan = planById[i.planId] ?? planById['full-body-gym'];
  const today = dayKey(now);
  const mood = i.checkins[today];
  const last = sessions[sessions.length - 1];
  const out = (kind: Suggestion['kind'], day: Day, reason: string, dayIndex?: number, planId = plan.id): Suggestion =>
    ({ kind, title: day.name, reason, day, dayIndex, planId, minutes: minutesOf(day) });

  if (last && dayKey(last.startedAt) === today)
    return out('rest', planById.mobility.days[0], 'You already trained today. A short stretch helps you recover for tomorrow.', undefined, 'mobility');

  const pp = postpartumWeek(p);
  if (pp !== null && pp < 6)
    return out('gentle', planById['pelvic-floor'].days[0], 'In the first weeks after birth, breathing and pelvic floor work come first.', undefined, 'pelvic-floor');

  const cyc = cycle(p);
  if (cyc?.phase === 'period' && (mood ?? 2) <= 2)
    return out('gentle', planById.mobility.days[0], 'Period days can feel heavy. Gentle movement like this can ease cramps.', undefined, 'mobility');

  // The plan's own week: a rest day suggests recovery. Training days follow the rotation, so a missed day is never lost.
  const weekday = (new Date(now).getDay() + 6) % 7; // Monday = 0
  if (plan.week?.length === 7 && plan.week[weekday] === null && mood !== 4)
    return out('rest', planById.mobility.days[0], `Rest day in ${plan.name}. Muscles grow on rest; a short stretch keeps you loose. Feeling great? Pick any quick session below.`, undefined, 'mobility');

  // Rest the muscles trained in the last day and a half: pick the plan day that overlaps least.
  let idx = i.nextDay % plan.days.length;
  let reason = '';
  if (last && now - last.startedAt < 1.5 * DAY && plan.days.length > 1) {
    const tired = new Set(last.items.map((it) => byId[it.exId]?.primary[0]).filter(Boolean));
    const overlap = (d: Day) => [...musclesOf(d)].filter((m) => tired.has(m)).length / Math.max(1, musclesOf(d).size);
    if (overlap(plan.days[idx]) > 0.5) {
      const best = plan.days.map((d, k) => ({ k, o: overlap(d) })).sort((a, b) => a.o - b.o)[0];
      if (best.o < overlap(plan.days[idx])) {
        idx = best.k;
        reason = `Your ${title([...tired][0] ?? 'muscles')} worked recently, so today trains something fresh.`;
      }
    }
  }
  const day = plan.days[idx];

  if (mood === 1) {
    const light: Day = { ...day, name: `${day.name}, light`, slots: day.slots.map((s) => ({ ...s, sets: Math.max(1, s.sets - 1), rest: s.rest + 15 })) };
    return out('light', light, "Low battery today? Same moves, one set fewer each and longer rests. Showing up still counts.", idx);
  }
  if (!reason) {
    const days = last ? Math.floor((now - last.startedAt) / DAY) : -1;
    const week = sessions.filter((s) => now - s.startedAt < 7 * DAY).length;
    reason =
      !last ? 'Day one. The hardest rep is walking in, and you are already here.'
      : mood === 4 ? 'You are fired up. Go for it, and chase a personal best if it feels right.'
      : mood === 2 ? 'Start with the first exercise. Most days the mood follows the movement.'
      : days >= 3 ? 'A few days off. No guilt: start with this, at your own pace.'
      : week >= p.daysPerWeek ? 'Weekly goal already hit. Anything extra today is a bonus.'
      : cyc?.phase === 'follicular' ? 'Many people feel strongest at this point in their cycle. A good day to push.'
      : `${p.daysPerWeek - week} more this week to hit your goal.`;
  }
  if (pregnancyWeek(p) !== null) reason += ' Pregnancy-safe moves only.';
  return out('plan', day, reason, idx);
}

// --- insights: one card at a time on Today ---
type Icon = keyof typeof Ionicons.glyphMap;
export type Insight = { id: string; icon: Icon; title: string; body: string };

export function insights(i: EngineInput, now = Date.now()): Insight[] {
  const { profile: p, sessions, meals } = i;
  const out: Insight[] = [];
  const today = dayKey(now);
  const t = targets(p);
  const gentle = p.gentle || p.concerns?.includes('food');
  const lastDays = [1, 2, 3].map((n) => dayKey(now - n * DAY));
  const mealsOn = (d: string) => meals.filter((m) => m.day === d);

  const pw = pregnancyWeek(p), pp = postpartumWeek(p), cyc = cycle(p);
  if (pw !== null) out.push({ id: 'pregnant', icon: 'heart', title: `Pregnancy-safe mode, week ${pw}`, body: 'Stop and call your doctor if you feel dizzy, bleed, or have pain. Follow their advice where it differs from ours.' });
  if (pp !== null) out.push({ id: 'postpartum', icon: 'heart', title: 'Recovering after birth', body: 'Wait for your postnatal check before harder work. Breathing and pelvic floor exercises are a great start.' });
  if (cyc?.phase === 'period') out.push({ id: 'cycle-period', icon: 'water', title: 'Period days', body: 'Gentle movement can ease cramps. Iron-rich foods like spinach, lentils and eggs help you feel less tired.' });
  if (cyc?.phase === 'luteal') out.push({ id: 'cycle-luteal', icon: 'moon', title: 'The week before your period', body: 'Cravings and bloating are common now. Water, fibre and a short walk help.' });

  // Six days in a row: a rest day, firmly so in gentle mode.
  const streakDays = [0, 1, 2, 3, 4, 5].every((n) => sessions.some((s) => dayKey(s.startedAt) === dayKey(now - n * DAY)));
  if (streakDays) out.push({ id: 'rest-day', icon: 'bed', title: 'Time for a rest day', body: 'Six days in a row is a lot. Muscles grow while you rest; tomorrow, try a walk or a stretch.' });

  if (p.concerns?.some((x) => x === 'stressed' || x === 'breakup'))
    out.push({ id: 'mood-support', icon: 'sunny', title: 'Be kind to yourself', body: 'Ten minutes of moving tends to make a heavy day lighter. Every session you show up for counts.' });

  if (gentle) {
    const sparse = lastDays.filter((d) => mealsOn(d).length > 0 && mealsOn(d).length <= 1).length;
    if (sparse >= 2) out.push({ id: 'meals-gentle', icon: 'restaurant', title: 'Regular meals help you train', body: 'Even a small snack between meals keeps your energy steady. If food feels hard right now, talking to a professional can really help.' });
  } else {
    const low = lastDays.filter((d) => mealsOn(d).length > 0 && mealsOn(d).reduce((a, m) => a + m.protein, 0) < 0.7 * t.protein).length;
    if (low >= 2) {
      const best = proteinPicks(p.diet, 2);
      out.push({ id: 'protein-low', icon: 'nutrition', title: 'Light on protein lately', body: `Try ${best[0].name.toLowerCase()} (${best[0].protein} g) or ${best[1].name.toLowerCase()} (${best[1].protein} g) today.` });
    }
  }

  // Muscle goals and lots of cardio pull in opposite directions.
  if (p.goal === 'build muscle' || p.goal === 'get stronger') {
    const cardioMin = sessions.filter((s) => now - s.startedAt < 7 * DAY).reduce((m, s) => {
      const share = s.items.filter((it) => ['cardio', 'plyometrics'].includes(byId[it.exId]?.category ?? '')).length / Math.max(1, s.items.length);
      return m + share * Math.max(0, ((s.endedAt ?? s.startedAt) - s.startedAt) / 60000);
    }, 0);
    if (cardioMin > 150) out.push({ id: 'cardio-balance', icon: 'pulse', title: 'Lots of cardio this week', body: 'Keep cardio to two or three short sessions so your muscles have the fuel to grow.' });
  }

  const water = i.water[today] ?? 0;
  if (new Date(now).getHours() >= 15 && water < 0.4 * t.water)
    out.push({ id: 'water-low', icon: 'water', title: 'Sip some water', body: `You're at ${water} of ${t.water} glasses today. A glass now keeps the afternoon slump away.` });

  const life = {
    desk: { title: 'Sitting most of the day?', body: 'Stand up and move for two minutes every hour. A desk reset or a few Kegels fit between meetings.' },
    student: { title: 'Long hours of study?', body: 'Every hour, stand up, rest your eyes and roll your shoulders. Your focus comes back faster.' },
    driving: { title: 'Long drives?', body: 'At each stop, stretch your hips and neck for two minutes. Kegels work even while you drive.' },
    standing: { title: 'On your feet all day?', body: 'Floor-based moves and calf stretches help tired legs recover. Put your legs up for a few minutes tonight.' },
    active: { title: 'Your job already moves you', body: 'Keep workouts shorter, focus on strength, and give mobility and sleep real time.' },
    home: { title: 'Housework counts', body: 'Chores keep you moving. Short strength sessions protect your back for all that lifting and bending.' },
  }[p.lifestyle ?? ('' as never)];
  if (life) out.push({ id: `life-${p.lifestyle}`, icon: 'briefcase', ...life });

  if (p.concerns?.includes('thyroid')) out.push({ id: 'thyroid', icon: 'medkit', title: 'Steady wins with thyroid', body: 'Strength training and daily walks help most. Your doctor manages medication; we keep calorie cuts small.' });

  const recent = (id: string) => { const d = i.dismissed?.[id]; return !!d && now - Date.parse(d + 'T12:00:00') < 7 * DAY; };
  return out.filter((x) => !recent(x.id));
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck() {
  const base = { name: 'A', gender: 'female', age: 30, heightCm: 165, weightKg: 60, goalWeightKg: 60, goal: 'stay fit', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } } as Profile;
  const ex = (id: string) => byId[id];
  assert(gate(ex('Barbell_Squat'), base, 0).locked === false || ex('Barbell_Squat').level !== 'beginner', 'beginner squat open');
  const inter = Object.values(byId).find((e) => e.level === 'intermediate' && !hidden(e, base))!;
  assert(gate(inter, base, 0).locked && !gate(inter, base, 6).locked, 'intermediate unlocks after 6 sessions');
  const preg = { ...base, women: { mode: 'pregnant' as const } };
  assert(!!hidden(ex('Freehand_Jump_Squat'), preg), 'pregnancy hides jumps');
  assert(!!hidden(ex('Crunches'), preg), 'pregnancy hides crunches');
  assert(!hidden(ex('Bodyweight_Squat'), preg), 'pregnancy keeps squats');
  assert(!!hidden(ex('Dumbbell_Lunges'), { ...base, concerns: ['knee'] }), 'knee hides lunges');
  const i = { profile: base, sessions: [], meals: [], water: {}, checkins: { [dayKey()]: 1 as Mood }, planId: 'full-body-gym', nextDay: 0 };
  assert(suggest(i).kind === 'light', 'drained gets a light session');
}
