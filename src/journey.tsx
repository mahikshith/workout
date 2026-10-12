// Weight journey: for fat-loss and weight-gain goals, the numbers that actually move the scale.
// Energy balance = eaten - (daily burn + workouts); 7700 kcal is roughly 1 kg of body weight.
import { View } from 'react-native';
import { dayKey, targets } from './calc';
import { byId } from './data/exercises';
import { kcalPerMin } from './data/muscles';
import type { Meal, Profile, Session } from './store';
import { c } from './theme';
import { Card, Row, Stat, T } from './ui';

const DAY = 86400000;

// Approximate workout burn: each logged set counts as about 45 seconds of work at the exercise's MET value.
export const sessionKcal = (s: Session, kg: number) =>
  Math.round(s.items.reduce((sum, it) => (byId[it.exId] ? sum + it.sets.filter((x) => x.done).length * 0.75 * kcalPerMin(byId[it.exId], kg) : sum), 0));

export function journey(p: Profile, sessions: Session[], meals: Meal[], weights: { day: string; kg: number }[], now = Date.now()) {
  const t = targets(p);
  const maintain = t.kcal - ({ 'lose fat': -Math.min(500, t.kcal * 0.2), 'build muscle': t.kcal * 0.09, 'get stronger': t.kcal * 0.05, 'stay fit': 0 }[p.goal] ?? 0);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(now - i * DAY));
  const logged = days.filter((d) => meals.some((m) => m.day === d));
  const eaten = logged.length ? Math.round(logged.reduce((a, d) => a + meals.filter((m) => m.day === d).reduce((x, m) => x + m.kcal, 0), 0) / logged.length) : null;
  const workout = Math.round(sessions.filter((s) => now - s.startedAt < 7 * DAY).reduce((a, s) => a + sessionKcal(s, p.weightKg), 0) / 7);
  const burned = Math.round(maintain + workout);
  const balance = eaten === null ? null : eaten - burned;
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const start = sorted[0]?.kg ?? p.weightKg;
  const recent = sorted.filter((w) => now - Date.parse(w.day + 'T12:00:00') < 28 * DAY);
  const span = recent.length > 1 ? (Date.parse(recent[recent.length - 1].day) - Date.parse(recent[0].day)) / (7 * DAY) : 0;
  const perWeek = span >= 1 ? (recent[recent.length - 1].kg - recent[0].kg) / span : null;
  const toGo = p.goalWeightKg - p.weightKg;
  const weeksLeft = perWeek && Math.sign(perWeek) === Math.sign(toGo) && Math.abs(perWeek) > 0.05 ? Math.ceil(toGo / perWeek) : null;
  return { eaten, burned, workout, balance, start, now: p.weightKg, change: p.weightKg - start, perWeek, weeksLeft, toGo };
}

export function Journey({ p, sessions, meals, weights }: { p: Profile; sessions: Session[]; meals: Meal[]; weights: { day: string; kg: number }[] }) {
  const j = journey(p, sessions, meals, weights);
  const losing = p.goal === 'lose fat' || p.goalWeightKg < p.weightKg;
  const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
  const onTrack = j.balance === null ? null : losing ? j.balance < -100 : j.balance > 100;
  return (
    <Card style={{ marginTop: 14, gap: 14 }}>
      <T v="h3">{losing ? 'Weight-loss journey' : 'Weight-gain journey'}</T>
      <Row>
        <Stat label="Started" value={j.start.toFixed(1)} unit="kg" />
        <Stat label="Now" value={j.now.toFixed(1)} unit="kg" />
        <Stat label="Change" value={sign(j.change)} unit="kg" color={(losing ? j.change < 0 : j.change > 0) ? c.ok : c.text} />
      </Row>
      <Row>
        <Stat label="Eaten / day" value={j.eaten ?? '-'} unit={j.eaten ? 'kcal' : undefined} />
        <Stat label="Burned / day" value={j.burned} unit="kcal" />
        <Stat label="Workouts / day" value={j.workout} unit="kcal" />
      </Row>
      <View style={{ gap: 4 }}>
        <T v="body">
          {j.balance === null
            ? 'Log your meals for a few days to see your daily calorie balance.'
            : `Average balance ${sign(j.balance).replace('.0', '')} kcal a day, about ${sign((j.balance * 7) / 7700)} kg a week.`}
        </T>
        {onTrack !== null && (
          <T v="small" color={onTrack ? c.ok : c.warm}>
            {onTrack ? 'You are eating right for your goal.' : losing ? 'To lose weight, eat a little less than you burn: about 300 to 500 kcal a day.' : 'To gain, eat a little more than you burn: about 300 kcal a day.'}
          </T>
        )}
        <T v="small">
          {j.perWeek === null
            ? 'Weigh in once a week, same day and time, to see your trend.'
            : `Your trend: ${sign(j.perWeek)} kg a week${j.weeksLeft ? `, about ${j.weeksLeft} weeks to your goal at this pace` : ''}.`}
        </T>
        <T v="small" color={c.dim}>Burn is estimated from your body and workouts; treat it as a guide, not an exact number.</T>
      </View>
    </Card>
  );
}
