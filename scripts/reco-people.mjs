// Prints the recommendation engine's answer for a set of varied people, to read as a coach would.
// Usage: node --experimental-strip-types --no-warnings scripts/reco-people.mjs [filter]
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
const { buildPerson, recommend } = await import(new URL('../src/reco/index.ts', import.meta.url));
const { byId } = await import(new URL('../src/data/exercises.ts', import.meta.url));
const { planById } = await import(new URL('../src/data/plans.ts', import.meta.url));

const now = Date.parse('2026-11-11T18:00:00');
const H = 3600000;
const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
  place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } };
const ses = (hoursAgo, ids, planId, n = 4, w = 30) => ({ id: `s${hoursAgo}`, title: 'x', place: 'gym', planId, startedAt: now - hoursAgo * H, endedAt: now - hoursAgo * H + 2700000,
  items: ids.map((exId) => ({ exId, target: '10', rest: 60, sets: Array.from({ length: n }, () => ({ reps: 10, weight: w, done: true })) })) });
const due = new Date(now + 110 * 24 * H).toISOString().slice(0, 10);

const people = [
  ['New to the gym, wants muscle', {}, {}],
  ['100 kg beginner with knee pain, lose fat, gym', { weightKg: 100, goal: 'lose fat', concerns: ['knee'], goalWeightKg: 85 }, {}],
  ['Woman 34, home, no kit, tone up, 4 days', { gender: 'female', age: 34, heightCm: 164, weightKg: 62, place: 'home', goal: 'tone up', daysPerWeek: 4, concerns: ['tone'] }, {}],
  ['Intermediate, home, dumbbells and bands, build muscle, 4 days', { level: 'intermediate', place: 'home', gear: ['dumbbell', 'bands'], daysPerWeek: 4 }, {}],
  ['Desk worker 45, move better, home', { age: 45, goal: 'mobility', place: 'home', lifestyle: 'desk', concerns: ['posture', 'back'] }, {}],
  ['Thin 19-year-old, gain weight, gym, 4 days', { age: 19, heightCm: 180, weightKg: 58, goal: 'gain weight', daysPerWeek: 4, body: 'lean' }, {}],
  ['Woman 62, stay healthy, gym, 2 days', { gender: 'female', age: 62, heightCm: 160, weightKg: 70, goal: 'stay fit', daysPerWeek: 2 }, {}],
  ['Advanced lifter, get stronger, 5 days, chest and shoulders yesterday', { level: 'advanced', goal: 'get stronger', daysPerWeek: 5, weightKg: 88 },
    { planId: 'phul', sessions: [ses(92, ['Barbell_Squat', 'Romanian_Deadlift', 'Leg_Press'], 'phul', 4, 100), ses(20, ['Barbell_Bench_Press_-_Medium_Grip', 'Standing_Military_Press', 'Incline_Dumbbell_Press', 'Triceps_Pushdown'], 'phul', 4, 70)] }],
  ['Runner, build stamina, gym, intermediate, 5 days', { goal: 'endurance', level: 'intermediate', daysPerWeek: 5, weightKg: 68, concerns: ['run'] }, {}],
  ['Footballer 24, sport fitness, both, intermediate, 4 days', { age: 24, goal: 'athletic', level: 'intermediate', place: 'both', daysPerWeek: 4 }, {}],
  ['Pregnant, week 24, home with dumbbells', { gender: 'female', heightCm: 166, weightKg: 70, place: 'home', gear: ['dumbbell', 'bands'], women: { mode: 'pregnant', date: due }, goal: 'stay fit' }, {}],
  ['Heavy man 120 kg, 50, home no kit, sport fitness (no plan, drained today)', { weightKg: 120, age: 50, place: 'home', goal: 'athletic' }, { checkins: { '2026-11-11': 1 } }],
  ['Pushes a lot, never pulls: intermediate build muscle, 6 days', { level: 'intermediate', daysPerWeek: 6 },
    { sessions: [ses(120, ['Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Pushups', 'Triceps_Pushdown']), ses(72, ['Barbell_Bench_Press_-_Medium_Grip', 'Side_Lateral_Raise', 'Dips_-_Chest_Version']), ses(44, ['Barbell_Squat', 'Leg_Press', 'Leg_Extensions'])] }],
];
const filter = process.argv[2];
for (const [label, prof, extra] of people) {
  if (filter && !label.toLowerCase().includes(filter.toLowerCase())) continue;
  const person = buildPerson({ profile: { ...base, ...prof }, now, ...extra });
  const r = recommend(person);
  const slots = (d) => d.slots.map((s) => `${byId[s.id].name} ${s.sets}×${s.reps}`).join(' · ');
  console.log(`\n=== ${label}`);
  console.log(`    BMI ${person.bmi.toFixed(1)} (${person.weightClass}), level ${person.level}, readiness ${person.readiness.score} ${person.readiness.level} (${person.readiness.why})${person.lowImpactWhy ? ', ' + person.lowImpactWhy : ''}`);
  console.log(`  TODAY [${r.today.kind}] ${r.today.title}, ${r.today.minutes} min`);
  console.log(`    ${slots(r.today.day)}`);
  for (const w of r.today.why) console.log(`    - ${w}`);
  for (const a of r.today.adjust) console.log(`    ~ ${a.reason}`);
  const e = r.nextBest.session;
  console.log(`  SOMETHING ELSE [${e.kind}] ${e.day.name}, ${e.minutes} min: ${slots(e.day)}`);
  for (const w of e.why) console.log(`    - ${w}`);
  console.log('  PLANS');
  for (const p of r.plans.filter((x) => x.suitable).slice(0, 6)) console.log(`    ${String(p.fit).padStart(3)}% ${p.pick ? '*' : ' '} ${planById[p.planId].name} (${p.planId}, ${p.days}d): ${p.reasons.slice(0, 3).join(' | ')}`);
  const no = r.plans.filter((x) => !x.suitable);
  console.log(`    not offered: ${no.slice(0, 4).map((x) => `${x.plan.name} (${x.caution})`).join('; ')}${no.length > 4 ? ` +${no.length - 4}` : ''}`);
  console.log(`  GROUPS ${r.groups.map((g) => `${g.title} ${g.plans.length}`).join(' · ')}`);
  for (const m of ['chest', 'back', 'legs']) console.log(`  ${m.toUpperCase()}: ${r.exercisesFor(m, 4).map((s) => `${s.ex.name} [${s.reasons[0]}]`).join(' · ')}`);
}
