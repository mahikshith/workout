import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { dayKey, targets } from './calc';
import { byId } from './data/exercises';
import { foodsFor, proteinPicks } from './data/foods';
import { MINDSET, motivation } from './data/motivation';
import { quick, type Quick } from './data/quick';
import { hidden, tone } from './engine';
import { useStore, type Profile } from './store';

// Every nudge is a local notification, rebuilt from the store: works offline, nothing leaves the phone.
type St = ReturnType<typeof useStore.getState>;
export type NudgeState = Pick<St, 'profile' | 'reminders' | 'hydration' | 'breaks' | 'motivation' | 'nudges' | 'sessions' | 'meals' | 'water' | 'active'>;
// rank: what survives the cap first. 0 repeating reminders, 1 missed and streak, 2 motivation, 3 water, 4 breaks. at = 0: repeating.
type Req = { rank: number; at: number; content: Notifications.NotificationContentInput; trigger: Notifications.NotificationTriggerInput };

const K = Notifications.SchedulableTriggerInputTypes;
const web = Platform.OS === 'web';
const MAX = 58; // iOS keeps at most 64 pending; this leaves room for the rest timer
const GENTLE = [
  'Whenever you are ready. Even ten minutes counts.',
  'A little movement can make the day feel lighter.',
  'No pressure. A short session is still a win.',
  'Your session is here when you want it.',
];
const PLAYFUL = [
  'Your future self is already proud. Let’s train.',
  'Twenty minutes counts. Show up today.',
  'Small sets, big streaks. Tap to start.',
  'The first rep is the hardest. Tap to start.',
  'Rest is done. Time to move.',
];
const WATER = ['Time for a glass of water.', 'A few sips now keeps you sharp.', 'Water break. Your body will thank you.'];
const MEAL_KIND = ['Regular meals help you train and recover.', 'A small snack between meals keeps your energy steady.', 'Food is part of the plan. Eat something you enjoy.'];
const DAY = 86400000;
const a = (m: number) => ([8, 11, 18].includes(m) ? 'An' : 'A');

if (!web) Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function channels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('nudges', { name: 'Workout nudges', importance: Notifications.AndroidImportance.HIGH });
  await Notifications.setNotificationChannelAsync('water', { name: 'Water, breaks and tips', importance: Notifications.AndroidImportance.DEFAULT });
}

export const hasPermission = async () => !web && (await Notifications.getPermissionsAsync()).granted;

export async function askPermission() {
  if (web) return false;
  await channels(); // Android 13+ only shows the system prompt once a channel exists
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// A 5 or 15 minute movement session for a missed workout: no gear the person lacks, nothing their safety filters hide,
// desk sessions during work hours for desk jobs, home or anywhere sessions otherwise.
const MOVE = ['desk', 'mobility', 'morning', 'cardio', 'strength', 'core'];
function pickQuick(p: Profile, d: Date, seed: number): Quick | undefined {
  const ok = quick.filter((q) => (q.minutes === 5 || q.minutes === 15) && q.tags.some((t) => MOVE.includes(t)) && !q.tags.includes('period')
    && !(q.tags.includes('morning') && d.getHours() >= 12) && !q.gear?.some((g) => !p.gear.includes(g))
    && q.slots.every((sl) => !byId[sl.id] || !hidden(byId[sl.id], p)));
  const work = !!(p.concerns?.includes('desk') || ['desk', 'student', 'driving'].includes(p.lifestyle ?? '')) && d.getDay() % 6 !== 0 && d.getHours() >= 9 && d.getHours() < 18;
  const pool = ok.filter((q) => q.where.includes('office') === work);
  return (pool.length ? pool : ok)[seed % (pool.length || ok.length)];
}

// Pure: what to schedule for this state, best first, capped.
export function plan(s: NudgeState, now = Date.now()): Req[] {
  const { profile: p, nudges: n } = s;
  const out: Req[] = [];
  const gentle = tone(p) === 'gentle';
  const name = p.name.trim();
  const today = dayKey(now);
  const at = (off: number, min: number) => { const d = new Date(now); d.setDate(d.getDate() + off); d.setHours(0, min, 0, 0); return d; };
  // Quiet hours wrap past midnight and mute the automatic nudges; reminders the person set themselves still ring.
  const quiet = (min: number) => { const x = n.quietFrom * 60, y = n.quietTo * 60; return x < y ? min >= x && min < y : x > y && (min >= x || min < y); };
  const repeat = (title: string, body: string, trigger: Notifications.NotificationTriggerInput, url = '/') =>
    out.push({ rank: 0, at: 0, content: { title, body, data: { url } }, trigger });
  const once = (d: Date, rank: number, title: string, body: string, channelId = 'nudges', url = '/') => {
    if (d.getTime() > now && !quiet(d.getHours() * 60 + d.getMinutes()))
      out.push({ rank, at: d.getTime(), content: { title, body, data: { url } }, trigger: { type: K.DATE, date: d, channelId } });
  };

  // Workout reminders: weekly per picked weekday (store 0 = Sunday, trigger 1 = Sunday), daily when none or all are picked.
  const workouts = s.reminders.filter((r) => r.kind === 'workout' && r.on);
  const everyDay = (days: number[]) => !days.length || days.length >= 7;
  const lines = gentle ? GENTLE : PLAYFUL;
  const title = gentle ? (name ? `Hi ${name}, a little time for you` : 'A little time for you') : name ? `${name}, it’s go time` : 'It’s go time';
  let k = new Date(now).getDate();
  for (const { hour, minute, days } of workouts) {
    if (everyDay(days)) repeat(title, lines[k++ % lines.length], { type: K.DAILY, hour, minute, channelId: 'nudges' });
    else for (const d of days) repeat(title, lines[k++ % lines.length], { type: K.WEEKLY, weekday: d + 1, hour, minute, channelId: 'nudges' });
  }

  for (const r of s.reminders) if (r.kind === 'meal' && r.on)
    repeat(`${r.label ?? 'Meal'} time`, 'Eating at regular times keeps your energy steady.', { type: K.DAILY, hour: r.hour, minute: r.minute, channelId: 'nudges' }, '/fuel');

  if (n.recap && !quiet(19 * 60)) repeat('Your week', 'Open to see how it went.', { type: K.WEEKLY, weekday: 1, hour: 19, minute: 0, channelId: 'nudges' }, '/progress');

  // Missed workout: two hours after the day's last reminder, a short session instead.
  const trained = s.sessions.some((x) => dayKey(x.startedAt) === today) || (!!s.active && dayKey(s.active.startedAt) === today);
  if (n.missed) for (let off = trained ? 1 : 0; off < 7; off++) {
    const wd = at(off, 0).getDay();
    const last = Math.max(-1, ...workouts.filter((r) => everyDay(r.days) || r.days.includes(wd)).map((r) => r.hour * 60 + r.minute));
    if (last < 0) continue;
    const d = at(off, last + 120);
    const q = pickQuick(p, d, off + k);
    const short = q ? `${a(q.minutes)} ${q.minutes}-minute ${q.name}` : 'Five minutes of movement';
    once(d, 1, name ? `Still time, ${name}` : 'Still time today',
      gentle ? `No pressure. ${short} still counts, if you feel like it.` : `Busy day? ${short} keeps your streak alive.`);
  }

  const lastSession = s.sessions[s.sessions.length - 1];
  if (n.streak && lastSession) {
    const d = new Date(lastSession.startedAt);
    d.setDate(d.getDate() + 2);
    d.setHours(19, 0, 0, 0);
    if (gentle) once(d, 1, 'Your streak is still here', 'A short, easy session today keeps it going. No pressure.');
    else once(d, 1, 'Your streak is on the line', 'Two days off already. A short session today keeps it alive.');
  }

  // Weekly weigh-in for weight goals (never in no-numbers mode): Monday morning, same time every week.
  if (!p.gentle && !p.concerns?.includes('food') && (p.goal === 'lose fat' || Math.abs(p.goalWeightKg - p.weightKg) >= 1))
    repeat('Weekly weigh-in', 'Same day, same time, before breakfast. Log it in Progress to see your trend.', { type: K.WEEKLY, weekday: 2, hour: 7, minute: 30, channelId: 'nudges' }, '/progress');

  // Milestones measured from the first workout: honest encouragement at the points where people usually give up.
  const firstAt = s.sessions[0]?.startedAt;
  if (firstAt) for (const [d, title, body] of [
    [7, 'One week in', 'Week one done. Strength comes before looks; keep showing up and it will.'],
    [30, 'One month of training', 'A month in. Visible change usually starts around weeks 6 to 8. You are right on track.'],
    [60, 'Two months strong', 'Two months of discipline. Compare yourself to week one, not to social media.'],
    [90, 'Three months', 'Twelve weeks. This is when people notice. Most never get here; you did.'],
  ] as const) {
    const at = new Date(firstAt);
    at.setDate(at.getDate() + d);
    at.setHours(19, 15, 0, 0);
    once(at, 1, title, body);
  }

  // Water: every N minutes from..to, today (until the day's glasses are reached) and tomorrow.
  const h = s.hydration, t = targets(p), drank = s.water[today] ?? 0;
  if (h.on) for (const off of [0, 1]) {
    if (!off && drank >= t.water) continue;
    for (let m = h.from * 60, j = 0; m <= h.to * 60; m += Math.max(15, h.every), j++)
      once(at(off, m), 3, 'Water break', off ? WATER[j % WATER.length] : `${drank} of ${t.water} glasses so far. ${WATER[j % WATER.length]}`, 'water');
  }

  // Desk and eye breaks on weekdays, alternating, after each stretch of work.
  const b = s.breaks, desk = quick.find((q) => q.tags.includes('desk')), eyes = quick.find((q) => q.tags.includes('eyes'));
  if (b.on) for (const off of [0, 1]) {
    if (at(off, 0).getDay() % 6 === 0) continue;
    for (let m = b.from * 60 + Math.max(15, b.every), j = 0; m <= b.to * 60; m += Math.max(15, b.every), j++)
      if (j % 2) once(at(off, m), 4, 'Eye break', eyes ? `Look away from the screen. ${a(eyes.minutes)} ${eyes.minutes}-minute ${eyes.name} rests your eyes.` : 'Look at something far away for 20 seconds. Your eyes will thank you.', 'water');
      else once(at(off, m), 4, 'Desk break', desk ? `Time to stand up. ${a(desk.minutes)} ${desk.minutes}-minute ${desk.name} loosens your back and shoulders.` : 'Time to stand up, roll your shoulders and stretch for a minute.', 'water');
  }

  // Motivation and tips, rotating: a line that fits their life right now, a mindset habit, a fuel tip.
  // No-numbers mode (gentle, or a hard relationship with food) never mentions calories, grams or weight.
  const mo = s.motivation;
  const noNumbers = !!(p.gentle || p.concerns?.includes('food'));
  const daysOff = lastSession ? Math.floor((now - lastSession.startedAt) / DAY) : 0;
  const mindset = noNumbers ? MINDSET.filter((x) => !/scale|weight/i.test(x.body)) : MINDSET;
  const heads = gentle ? ['A thought for you', 'Small steps', 'Go easy on yourself'] : ['Round two.', 'Keep going.', 'One more round.'];
  const eaten = s.meals.filter((m) => m.day === today).reduce((sum, m) => sum + m.protein, 0);
  const left = Math.round((t.protein - eaten) / 5) * 5; // only said once something is logged today, so it is never a guess
  const picks = proteinPicks(p.diet, 6), light = foodsFor(p.diet).filter((x) => x.light);
  const fuel = (d: Date, off: number, f: number) => {
    if (noNumbers) return MEAL_KIND[f % MEAL_KIND.length];
    const [x, y] = [picks[f % picks.length], picks[(f + 1) % picks.length]];
    const tips = [!off && eaten > 0 && left > 10 && x && y
      ? `About ${left} g of protein to go today. Try ${x.name.toLowerCase()} (${x.protein} g) or ${y.name.toLowerCase()} (${y.protein} g).`
      : `Aim for 3 meals and 1 snack, about ${Math.round(t.protein / 20) * 5} g of protein each.`];
    const l = light[f % Math.max(1, light.length)];
    if (p.goal === 'lose fat' && l) tips.push(`Hungry between meals? Try ${l.name.toLowerCase()}: about ${l.kcal} kcal for ${l.serving}, and filling.`);
    return tips[f % tips.length];
  };
  const fixed = s.reminders.filter((r) => r.on).map((r) => r.hour * 60 + r.minute);
  const busy = (d: Date) => out.some((x) => x.at && Math.abs(x.at - d.getTime()) < 15 * 60000)
    || fixed.some((m) => Math.abs(m - d.getHours() * 60 - d.getMinutes()) < 15);
  if (mo.on) for (let off = 0, j = 0, f = 0; off < 2; off++)
    for (let m = mo.from * 60; m <= mo.to * 60; m += Math.max(60, mo.every), j++) {
      const d = busy(at(off, m)) ? at(off, m + 20) : at(off, m); // never two banners at once
      const seed = k * 7 + j;
      if (j % 3 === 0) once(d, 2, name && j % 2 ? name : heads[j % heads.length], motivation(p, daysOff + off, seed), 'water');
      else if (j % 3 === 1) { const x = mindset[seed % mindset.length]; once(d, 2, x.title, x.body, 'water'); }
      else once(d, 2, 'Fuel tip', fuel(d, off, f++), 'water', '/fuel');
    }

  return out.sort((x, y) => x.rank - y.rank || x.at - y.at).slice(0, MAX);
}

let restId: string | null = null;
let chain: Promise<void> = Promise.resolve();

// Cancels every scheduled nudge (old app versions' ones too, but not a running rest timer) and schedules the plan.
// Runs are queued so two quick changes can't interleave and double up.
export function rescheduleAll(s: NudgeState) {
  chain = chain.then(async () => {
    if (web) return;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((x) => x.identifier !== restId).map((x) => Notifications.cancelScheduledNotificationAsync(x.identifier)));
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await channels();
    for (const { content, trigger } of plan(s)) await Notifications.scheduleNotificationAsync({ content, trigger });
  }).catch((e) => console.warn('Could not schedule reminders', e));
  return chain;
}

// Older callers; useNudgeSync already reschedules on every relevant store change.
export const reschedule = (_p?: unknown, _s?: unknown) => rescheduleAll(useStore.getState());

const watched = (s: St) => [s.reminders, s.hydration, s.breaks, s.motivation, s.nudges, s.sessions, s.meals, s.water, s.profile, s.active?.id];

// Mounted once in the root layout: keeps the schedule in sync with the store and opens the screen a tapped nudge points to.
export function useNudgeSync() {
  useEffect(() => {
    if (web) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(() => { if (useStore.persist.hasHydrated()) rescheduleAll(useStore.getState()); }, 1500);
    };
    const unsub = useStore.subscribe((s, prev) => { const x = watched(s), y = watched(prev); if (x.some((v, i) => v !== y[i])) later(); });
    later();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Href);
    });
    return () => { clearTimeout(t); unsub(); sub.remove(); };
  }, []);
}

// Rest timer alert for when the phone is locked or the app is in the background.
export async function restAlert(seconds: number | null) {
  if (web) return;
  if (restId) { Notifications.cancelScheduledNotificationAsync(restId); restId = null; }
  if (!seconds || !(await Notifications.getPermissionsAsync()).granted) return;
  restId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over', body: 'Next set. Let’s go.' },
    trigger: { type: K.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'nudges' },
  });
}
