import type { Day, Plan, Slot } from './plans';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export type ProgramWeek = { week: number; title: string; note: string; days: { day: Day | null; index: number | null }[] };

// Gentle plans (recovery, pregnancy, after birth) keep the same work every week; only the note changes.
const gentle = (p: Plan) => p.category === 'Recovery' || p.id === 'pregnancy-safe' || p.id === 'after-birth';

// "10" -> "11", "30s" -> "35s"; ranges, minutes and breaths stay as written (the note says to aim higher in the range).
const addRep = (reps: string) =>
  /^\d+$/.test(reps) ? String(+reps + 1) : /^\d+s$/.test(reps) ? `${parseInt(reps, 10) + 5}s` : reps;

const PHASES: { title: string; note: string; slot: (s: Slot) => Slot }[] = [
  { title: 'Learn', note: 'Learn the moves. Pick weights you could lift 2-3 more times and focus on clean form.', slot: (s) => s },
  { title: 'Build', note: 'Add one rep to each set, or aim for the top of the range.', slot: (s) => ({ ...s, reps: addRep(s.reps) }) },
  { title: 'Push', note: 'Add one set to each lift. Same weights, a little more work.', slot: (s) => ({ ...s, sets: Math.min(5, s.sets + 1), reps: addRep(s.reps) }) },
  { title: 'Deload', note: 'Easy week: one set less and lighter weights so your body catches up. Then start again a little heavier.', slot: (s) => ({ ...s, sets: Math.max(1, s.sets - 1) }) },
];
// Beginner versions of fitted plans (plan.easy): same four weeks, but reps go up instead of sets, with an effort guide.
// RPE is effort out of 10: RPE 6 leaves about 4 reps in the tank, RPE 8 about 2.
const EASY: typeof PHASES = [
  { title: 'Learn', note: 'Learn the moves with light weights. Stop each set with about 4 reps to spare (RPE 6).', slot: (s) => s },
  { title: 'Build', note: 'Add one rep to each set. Still 3 reps to spare (RPE 7).', slot: (s) => ({ ...s, reps: addRep(s.reps) }) },
  { title: 'Push', note: 'Same sets and reps, a little heavier if your form stays clean (RPE 7-8).', slot: (s) => ({ ...s, reps: addRep(s.reps) }) },
  { title: 'Deload', note: 'Easy week: one set less and lighter weights so your body catches up. Then start again a little heavier.', slot: (s) => ({ ...s, sets: Math.max(1, s.sets - 1) }) },
];
const phases = (p: Plan) => (p.easy ? EASY : PHASES);
const GENTLE = [
  'Get to know each move. Stop anything that hurts.',
  'Same moves. Go a little longer only if it felt easy.',
  'Same moves, steady and calm. Notice what feels easier now.',
  'Keep it easy this week and see how far you have come.',
];

// Weekly blocks for a month view: the 7-day schedule from plan.week, with simple 4-week progression that repeats.
export function program(plan: Plan, weeks = plan.weeks ?? 4): ProgramWeek[] {
  return Array.from({ length: weeks }, (_, w) => {
    const ph = phases(plan)[w % 4];
    const soft = gentle(plan);
    const days = plan.week.map((i) => {
      const d = i === null ? undefined : plan.days[i];
      return { index: d ? i : null, day: d ? (soft ? d : { ...d, slots: d.slots.map(ph.slot) }) : null };
    });
    return { week: w + 1, title: soft ? `Week ${w + 1}` : ph.title, note: soft ? GENTLE[w % 4] : ph.note, days };
  });
}

const assert = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
export function selfCheck() {
  const day: Day = { name: 'A', focus: '', slots: [{ id: 'Plank', sets: 3, reps: '10', rest: 60 }] };
  const p = { id: 't', category: 'Muscle', days: [day], week: [0, null, 0, null, 0, null, null], weeks: 4 } as Plan;
  const pr = program(p);
  assert(pr.length === 4 && pr[0].days.length === 7 && pr[0].days[1].day === null, 'seven days, rest is null');
  assert(pr[1].days[0].day!.slots[0].reps === '11' && pr[2].days[0].day!.slots[0].sets === 4, 'reps then sets go up');
  assert(pr[3].days[0].day!.slots[0].sets === 2, 'deload drops a set');
  assert(phasedDay(p, 0, 0).slots[0].sets === 3 && phasedDay(p, 0, 2).slots[0].sets === pr[2].days[0].day!.slots[0].sets, 'phased day matches the week view');
  const easy = program({ ...p, easy: true });
  assert(easy[2].days[0].day!.slots[0].sets === 3 && easy[2].days[0].day!.slots[0].reps === '11' && /RPE/.test(easy[0].note), 'beginner weeks add reps, not sets, with RPE notes');
  const t0 = Date.parse('2026-01-05T12:00:00');
  assert(planWeek(p, t0, [], t0 + 3 * 86400000) === 0 && planWeek(p, t0, [], t0 + 9 * 86400000) === 1 && planWeek(p, t0, [], t0 + 29 * 86400000) === 0, 'plan week counts from the start and repeats');
}

// Which week of the plan this is (0-based, repeating over plan.weeks). Counted from when the plan was picked; older
// saves without that date count from the first session logged on the plan, else from now.
export function planWeek(plan: Plan, start: number | undefined, sessions: { planId?: string; startedAt: number }[] = [], now = Date.now()) {
  const from = start ?? sessions.find((s) => s.planId === plan.id)?.startedAt ?? now;
  const w = Math.max(0, Math.floor((now - from) / (7 * 86400000)));
  return w % Math.max(1, plan.weeks || 4);
}

// One plan day as it runs in a given week: the same sets and reps the plan page shows for that week.
export function phasedDay(plan: Plan, dayIndex: number, week: number): Day {
  const d = plan.days[dayIndex];
  if (!d || gentle(plan)) return d;
  return { ...d, slots: d.slots.map(phases(plan)[week % 4].slot) };
}
