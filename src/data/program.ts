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
const GENTLE = [
  'Get to know each move. Stop anything that hurts.',
  'Same moves. Go a little longer only if it felt easy.',
  'Same moves, steady and calm. Notice what feels easier now.',
  'Keep it easy this week and see how far you have come.',
];

// Weekly blocks for a month view: the 7-day schedule from plan.week, with simple 4-week progression that repeats.
export function program(plan: Plan, weeks = plan.weeks ?? 4): ProgramWeek[] {
  return Array.from({ length: weeks }, (_, w) => {
    const ph = PHASES[w % 4];
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
}
