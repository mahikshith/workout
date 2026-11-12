// The month calendar: what happened each day, from our own log and from the watch, plus the day sheet that explains one
// day. Used by Consistency (app/history.tsx). Pure helpers first (no React), then the grid, the legend and the sheet.
//
// Sources, each counted once:
// - our sessions (src/store.ts)
// - watch workouts imported from Health Connect, files or straps (src/tracker.ts `workouts`)
// - watch workouts merged into one of our sessions (`merged`): shown on that session, never as a second workout
// - the watch's day totals (`daily`: steps, active and total kcal, sleep). A day's active kcal already includes the
//   watch's workouts, so workout calories are never added on top of it.
// - calories for our own workouts (src/health/energy.ts): the watch's count for that time, else worked out from heart
//   rate, else an estimate. Without a watch day total, the day shows its workouts added up.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS, useReducedMotion } from 'react-native-reanimated';
import { dayKey, doneSets, volume } from './calc';
import { byId } from './data/exercises';
import { planById, type Plan } from './data/plans';
import { sessionMinutes } from './glance';
import { SOURCE_LABEL, type EnergySource, type SessionEnergy } from './health/energy';
import { originName } from './health/guides';
import { burnOn, energyFor, useEnergyData } from './health/useEnergy';
import { ml, toMl } from './water';
import { plannedOn } from './notify';
import { Sheet } from './sheet';
import { useStore, type Excuse, type Reminder, type Session } from './store';
import { c, dom, r, tint } from './theme';
import { mergedFor, useTracker, type DailyMetrics, type ImportedWorkout } from './tracker';
import { Chip, haptic, IconBox, Row, T, Tap, Thumb } from './ui';

type Icon = ComponentProps<typeof Ionicons>['name'];

// ---------- Pure helpers ----------

export type DayKind = 'ours' | 'watch' | 'both' | 'rest' | 'excused' | 'missed' | 'planned' | 'blank';
export type DayInfo = {
  key: string;
  kind: DayKind;
  sessions: Session[];
  watch: ImportedWorkout[]; // imported, not merged into one of ours
  daily?: DailyMetrics;
  excuse?: Excuse;
  planned: boolean;
  kcal?: number; // calories burned that day, counted once (src/health/energy.ts dayBurn)
  est?: boolean; // that number leans on an estimate (no watch total that day)
};

// Friendly names for where a number came from. The Fitbit app now ships as Google Health, but people know their watch
// as a Fitbit, so the calendar names the watch.
const SOURCE: Record<ImportedWorkout['source'], string> = {
  health_connect: 'Health Connect', ble: 'Heart rate strap', fit: 'FIT file', takeout: 'Fitbit export', gpx: 'GPX file', manual: 'Added by you',
};
export const appName = (pkg: string) => {
  if (pkg === 'com.fitbit.FitbitMobile') return 'Fitbit';
  const n = originName(pkg);
  return n ? n[0].toUpperCase() + n.slice(1) : pkg;
};
export const sourceName = (w: ImportedWorkout) => (w.originApp ? appName(w.originApp) : SOURCE[w.source] ?? 'Your watch');
export const appList = (pkgs: string[]) => [...new Set(pkgs.map(appName))];

// A planned day: a weekday with a workout reminder on, or, without workout reminders, a training day in the plan's week.
export function plannedDay(d: Date, reminders: Reminder[], plan?: Plan) {
  if (reminders.some((x) => x.kind === 'workout' && x.on)) return plannedOn(reminders, d);
  return plan?.week?.length === 7 ? plan.week[(d.getDay() + 6) % 7] !== null : false;
}

export type MonthCtx = {
  sessions: Session[]; workouts: Record<string, ImportedWorkout>; merged: Record<string, ImportedWorkout>;
  daily: Record<string, DailyMetrics>; excuses: Record<string, Excuse>; reminders: Reminder[]; planId: string; planStart?: number;
  energy?: (s: Session) => SessionEnergy; // calories for one of our workouts; defaults to the stores' current numbers
};

// Every day of a month, Monday-first, with null padding at the start.
export function monthDays(month: Date, x: MonthCtx, today = dayKey()): (DayInfo | null)[] {
  const byDay: Record<string, Session[]> = {};
  for (const s of x.sessions) (byDay[dayKey(s.startedAt)] ??= []).push(s);
  const watchDay: Record<string, ImportedWorkout[]> = {};
  for (const w of Object.values(x.workouts)) (watchDay[dayKey(Date.parse(w.start))] ??= []).push(w);
  // Days before anything was logged or synced (or the plan was picked) are blank, not rest days.
  const firsts = [x.sessions.length ? dayKey(Math.min(...x.sessions.map((s) => s.startedAt))) : '', x.planStart ? dayKey(x.planStart) : '',
    Object.keys(x.daily).sort()[0] ?? '', Object.keys(watchDay).sort()[0] ?? ''].filter(Boolean);
  const floor = firsts.length ? firsts.sort()[0] : today;
  const plan = planById[x.planId];
  const lead = (month.getDay() + 6) % 7;
  const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const out: (DayInfo | null)[] = Array(lead).fill(null);
  for (let i = 1; i <= n; i++) {
    const d = new Date(month.getFullYear(), month.getMonth(), i, 12);
    const key = dayKey(d);
    const sessions = byDay[key] ?? [], watch = watchDay[key] ?? [], excuse = x.excuses[key];
    const planned = plannedDay(d, x.reminders, plan);
    const cal = burnOn(x.daily[key], watch, sessions, x.energy);
    let kind: DayKind;
    if (sessions.length && watch.length) kind = 'both';
    else if (sessions.length) kind = 'ours';
    else if (watch.length) kind = 'watch';
    else if (excuse) kind = 'excused';
    else if (key >= today) kind = planned ? 'planned' : 'blank'; // today isn't over yet
    else if (key < floor) kind = 'blank';
    else kind = planned ? 'missed' : 'rest';
    out.push({ key, kind, sessions, watch, daily: x.daily[key], excuse, planned, kcal: cal.kcal, est: cal.estimated || undefined });
  }
  return out;
}

export function monthSummary(days: (DayInfo | null)[]) {
  const ds = days.filter((d): d is DayInfo => !!d);
  const kcalDays = ds.filter((d) => d.kcal !== undefined);
  const total = kcalDays.reduce((a, d) => a + (d.kcal ?? 0), 0);
  // A weekly average needs at least a week between the first day with calories and the last day that has happened.
  const today = dayKey();
  const first = ds.findIndex((d) => d.kcal !== undefined), last = ds.filter((d) => d.key <= today).length - 1;
  const span = first >= 0 ? last - first + 1 : 0;
  return {
    kcalPerWeek: span >= 7 ? Math.round((total / span) * 7) : undefined,
    kcalEst: kcalDays.some((d) => d.est),
    workouts: ds.reduce((a, d) => a + d.sessions.length, 0),
    active: ds.filter((d) => d.kind === 'ours' || d.kind === 'watch' || d.kind === 'both').length,
    rest: ds.filter((d) => d.kind === 'rest' || d.excuse === 'rest').length,
    kcal: kcalDays.length ? total : undefined,
  };
}

export const kcalShort = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
const hm = (min: number) => { const t = Math.round(min), h = Math.floor(t / 60), m = t % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`; }; // never "0h 10m" or "7h 60m"
const ago = (iso?: string) => {
  if (!iso) return undefined;
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
export { ago as syncedAgo };

const EXCUSE: Record<Excuse, { icon: Icon; label: string }> = {
  rest: { icon: 'bed-outline', label: 'Rest day' }, sick: { icon: 'medkit-outline', label: 'Sick' }, travel: { icon: 'airplane-outline', label: 'Travel' },
};
const typeIcon = (t: string): Icon =>
  /run|jog/i.test(t) ? 'walk' : /walk|hike/i.test(t) ? 'footsteps' : /bik|cycl/i.test(t) ? 'bicycle' : /swim/i.test(t) ? 'water'
    : /yoga|pilates|stretch/i.test(t) ? 'body' : /strength|weight|gym|lift/i.test(t) ? 'barbell' : 'fitness';

// ---------- Month grid ----------

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MonthGrid({ days, onPick, onSwipe, showKcal }: {
  days: (DayInfo | null)[]; onPick: (key: string) => void; onSwipe: (dir: -1 | 1) => void; showKcal: boolean;
}) {
  const today = dayKey();
  // Swipe left for the next month, right for the last one. Vertical drags stay with the page scroll.
  const pan = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-14, 14])
    .onEnd((e) => { if (Math.abs(e.translationX) > 50) runOnJS(onSwipe)(e.translationX < 0 ? 1 : -1); });
  return (
    <GestureDetector gesture={pan}>
      <View style={s.grid}>
        {DOW.map((d, i) => <T key={`h${i}`} v="small" color={c.dim} style={s.head}>{d}</T>)}
        {days.map((d, i) => (d ? <DayCell key={d.key} d={d} today={d.key === today} onPress={() => onPick(d.key)} showKcal={showKcal} /> : <View key={`e${i}`} style={s.cell} />))}
      </View>
    </GestureDetector>
  );
}

// This week (Monday to Sunday) from the same day logic, for the Progress tab's calendar card.
export function weekDays(x: MonthCtx, now = new Date()): DayInfo[] {
  const mon = new Date(now); mon.setHours(12, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const keys = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const all: Record<string, DayInfo> = {};
  for (const d of [keys[0], keys[6]]) for (const info of monthDays(new Date(d.getFullYear(), d.getMonth(), 1), x)) if (info) all[info.key] = info;
  return keys.map((d) => all[dayKey(d)]);
}

// The week as a row of day cells with weekday letters. Not tappable itself: the card around it opens the calendar.
export function WeekStrip({ days, showKcal }: { days: DayInfo[]; showKcal: boolean }) {
  const today = dayKey();
  return (
    <View style={s.grid}>
      {DOW.map((d, i) => <T key={`h${i}`} v="small" color={c.dim} style={s.head}>{d}</T>)}
      {days.map((d) => <DayCell key={d.key} d={d} today={d.key === today} showKcal={showKcal} />)}
    </View>
  );
}

function DayCell({ d, today, onPress, showKcal }: { d: DayInfo; today: boolean; onPress?: () => void; showKcal: boolean }) {
  const n = Number(d.key.slice(8));
  const ours = d.kind === 'ours' || d.kind === 'both';
  const box = [s.box,
    ours && { backgroundColor: dom.train },
    d.kind === 'watch' && { backgroundColor: tint(c.blue, 1.5), borderWidth: 1, borderColor: c.blue + '66' },
    d.kind === 'rest' && { backgroundColor: tint(dom.sleep, 1.5) },
    d.kind === 'excused' && { backgroundColor: d.excuse === 'rest' ? tint(dom.sleep, 1.5) : c.card2 }, // a day you marked as rest wears the rest colour
    d.kind === 'missed' && { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: c.danger + '80' },
    d.kind === 'planned' && { borderWidth: 1.5, borderColor: dom.train + '99' },
  ];
  const ink = ours ? c.accentInk : d.kind === 'missed' || (d.kind === 'excused' && d.excuse !== 'rest') || (d.kind === 'blank' && d.key < dayKey()) ? c.muted : d.kind === 'blank' ? c.dim : c.text;
  const watch = d.kind === 'watch' || d.kind === 'both';
  const kcal = showKcal && d.kcal ? kcalShort(d.kcal) : null;
  const label = `${new Date(d.key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${KIND_WORD[d.kind]}${d.kcal && showKcal ? `, ${d.kcal} kcal burned` : ''}`;
  const body = (
    <>
      <View style={[s.ring, today && { borderColor: c.text }]}>
        <View style={box}>
          <T v="small" color={ink} style={s.num}>{n}</T>
          {watch && <View style={[s.watchDot, { backgroundColor: c.blue, borderColor: c.card }]} />}
          {d.kind === 'excused' && d.excuse && <Ionicons name={EXCUSE[d.excuse].icon} size={13} color={c.soft} style={s.corner} />}
        </View>
      </View>
      {/* Calories burned that day, under the date. Lighter when it is an estimate. */}
      <T v="small" numberOfLines={1} color={d.est ? c.muted : c.text} style={s.kcal}>{kcal ?? ' '}</T>
    </>
  );
  if (!onPress) return <View style={s.cell} accessible accessibilityLabel={label}>{body}</View>;
  return <Tap onPress={onPress} style={s.cell} scale={0.9} feedback="none" accessibilityLabel={label}>{body}</Tap>;
}

const KIND_WORD: Record<DayKind, string> = {
  ours: 'workout', watch: 'watch activity', both: 'workout and watch activity', rest: 'rest day', excused: 'excused', missed: 'missed planned day',
  planned: 'planned workout', blank: 'nothing logged',
};

// The key to the grid. Calories only show when there are some (and never in no-numbers mode).
export function Legend({ showKcal }: { showKcal: boolean }) {
  const items: { label: string; sw: object; dot?: boolean; icon?: Icon; bar?: boolean }[] = [
    { label: 'Workout', sw: { backgroundColor: dom.train } },
    { label: 'Watch activity', sw: { backgroundColor: tint(c.blue, 1.5), borderWidth: 1, borderColor: c.blue + '66' }, dot: true },
    { label: 'Rest day', sw: { backgroundColor: tint(dom.sleep, 1.5) } },
    { label: 'Excused', sw: { backgroundColor: c.card2 }, icon: 'medkit-outline' },
    { label: 'Missed', sw: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.danger + '80' } },
    { label: 'Planned', sw: { borderWidth: 1.5, borderColor: dom.train + '99' } },
    ...(showKcal ? [{ label: 'kcal burned', sw: {}, bar: true }] : []),
  ];
  return (
    <View style={s.legend}>
      {items.map((x) => (
        <Row key={x.label} gap={6} style={s.legendItem}>
          {x.bar ? <Row gap={3}><Ionicons name="flame" size={12} color={dom.kcal} /><T v="small" color={c.text} style={s.kcal}>320</T></Row> : (
            <View style={[s.swatch, x.sw]}>
              {x.dot && <View style={[s.swatchDot, { backgroundColor: c.blue }]} />}
              {x.icon && <Ionicons name={x.icon} size={10} color={c.muted} />}
            </View>
          )}
          <T v="small">{x.label}</T>
        </Row>
      ))}
    </View>
  );
}

// ---------- Day sheet ----------

export function DaySheet({ day, onClose }: { day: string | null; onClose: () => void }) {
  // Keeps the last day while the sheet slides away, so its content doesn't blank mid-animation.
  const [shown, setShown] = useState(day);
  if (day && day !== shown) setShown(day);
  return (
    <Sheet open={!!day} onClose={onClose}>
      {shown && <DayBody key={shown} k={shown} />}
    </Sheet>
  );
}

function DayBody({ k }: { k: string }) {
  const sessions = useStore((s) => s.sessions);
  const deleteSession = useStore((s) => s.deleteSession);
  const excuses = useStore((s) => s.excuses);
  const excuse = useStore((s) => s.excuse);
  const reminders = useStore((s) => s.reminders);
  const planId = useStore((s) => s.planId);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const profile = useStore((s) => s.profile);
  const workouts = useTracker((t) => t.workouts);
  const merged = useTracker((t) => t.merged);
  const daily = useTracker((t) => t.daily);
  const data = useEnergyData();
  const still = useReducedMotion();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const gentle = !!(profile?.gentle || profile?.concerns?.includes('food'));

  const date = new Date(k + 'T12:00:00');
  const today = dayKey();
  const ours = sessions.filter((x) => dayKey(x.startedAt) === k);
  const watch = Object.values(workouts).filter((w) => dayKey(Date.parse(w.start)) === k).sort((a, b) => a.start.localeCompare(b.start));
  const dm = daily[k];
  const why = excuses[k];
  const planned = plannedDay(date, reminders, planById[planId]);
  const cal = burnOn(dm, watch, ours, (x) => energyFor(x, data, profile));
  const partName = (id: string) => ours.find((x) => x.id === id)?.title ?? (() => { const w = watch.find((x) => x.id === id); return w ? `${w.title ?? w.type} · ${sourceName(w)}` : 'Workout'; })();
  const dayMeals = meals.filter((m) => m.day === k);
  const eaten = dayMeals.reduce((a, m) => a + m.kcal, 0), protein = dayMeals.reduce((a, m) => a + m.protein, 0);
  const glasses = water[k] ?? 0;
  const origins = appList(dm?.origin ?? []);

  const title = k === today ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const status = ours.length || watch.length ? null : why ? EXCUSE[why].label : k > today ? (planned ? 'Planned' : 'Nothing planned')
    : k === today ? (planned ? 'Planned' : 'Nothing logged yet') : planned ? 'Planned · not logged' : 'Rest day';

  const remove = (id: string) => {
    if (confirm !== id) { setConfirm(id); haptic('light'); return; }
    deleteSession(id); setConfirm(null); haptic('medium');
  };
  const stats: { icon: Icon; color: string; value: string; label: string }[] = [];
  if (dm?.steps !== undefined) stats.push({ icon: 'footsteps', color: dom.steps, value: dm.steps.toLocaleString(), label: 'steps' });
  if (dm?.sleep) stats.push({ icon: 'moon', color: dom.sleep, value: hm(dm.sleep.minutes), label: 'sleep' });
  if (dm?.restingHr !== undefined) stats.push({ icon: 'heart', color: dom.heart, value: String(Math.round(dm.restingHr)), label: 'resting bpm' });
  const nothing = !ours.length && !watch.length && !dm && !dayMeals.length && !glasses;

  return (
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 2 }}>
        <T v="h2">{title}</T>
        {status && <T v="small">{status}</T>}
      </View>

      {/* Calories burned: one honest number and where it came from. */}
      {!gentle && cal.kcal !== undefined && (
        <View style={[s.panel, { backgroundColor: tint(dom.kcal, 0.8) }]}>
          <Row gap={12}>
            <IconBox icon="flame" color={dom.kcal} size={40} />
            <View style={{ flex: 1 }}>
              <T v="num">{cal.kcal.toLocaleString()} <T v="small">kcal burned</T></T>
              <T v="small" numberOfLines={2}>
                {cal.from === 'day' ? `Active · ${origins.length ? origins.join(' and ') : 'your watch'}`
                  : cal.estimated ? `Workout${cal.parts.length === 1 ? '' : 's'} added up · part estimated` : `Workout${cal.parts.length === 1 ? '' : 's'} added up · by watch`}
              </T>
            </View>
          </Row>
          {cal.parts.length > 0 && (
            <View style={{ gap: 4 }}>
              <T v="small" color={c.soft}>{cal.from === 'day' ? 'Included above' : 'Made up of'}</T>
              {cal.parts.map((w) => (
                <Row key={w.id} gap={8}>
                  <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>{partName(w.id)}</T>
                  <T v="small" color={c.text} style={s.num}>{w.source === 'estimate' || w.source === 'heart rate' ? 'about ' : ''}{w.kcal} kcal</T>
                </Row>
              ))}
            </View>
          )}
          {cal.from === 'workouts' && dm?.activeKcal !== undefined && <T v="small">Watch: only {Math.round(dm.activeKcal).toLocaleString()} active kcal, likely off your wrist</T>}
          {dm?.totalKcal !== undefined && <T v="small">With resting: {Math.round(dm.totalKcal).toLocaleString()} kcal</T>}
        </View>
      )}

      {ours.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="label">Your workouts</T>
          {ours.map((ss) => {
            const w = mergedFor(merged, ss.id), en = cal.energies[ss.id], isOpen = open === ss.id;
            const hr = en?.avgHr && en.maxHr ? `${en.avgHr} avg · ${en.maxHr} max bpm` : en?.avgHr ? `avg ${en.avgHr} bpm` : null;
            return (
              <View key={ss.id} style={s.item}>
                <Row gap={12}>
                  <IconBox icon={ss.place === 'home' ? 'home' : 'barbell'} color={dom.train} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>{ss.title}</T>
                    <T v="small" numberOfLines={1}>{sessionMinutes(ss)} min · {doneSets(ss)} sets · {Math.round(volume(ss)).toLocaleString()} kg</T>
                  </View>
                </Row>
                {en && ((!gentle && en.kcal > 0) || hr) && (
                  <Row gap={12} style={{ flexWrap: 'wrap', rowGap: 6 }}>
                    {!gentle && en.kcal > 0 && <Row gap={6}><Ionicons name="flame" size={14} color={dom.kcal} /><T v="small" color={c.text} style={s.num}>{en.source === 'watch' ? '' : 'about '}{en.kcal} kcal</T></Row>}
                    {hr && <Row gap={6}><Ionicons name="heart" size={14} color={dom.heart} /><T v="small" color={c.text} style={s.num}>{hr}</T></Row>}
                    {!gentle && en.kcal > 0 && <SourceBadge source={en.source} />}
                  </Row>
                )}
                {w && (
                  <Row gap={8}>
                    <Ionicons name="watch-outline" size={14} color={c.blue} />
                    <T v="small" numberOfLines={1} style={{ flex: 1 }}>{`Matched with ${sourceName(w)}`}</T>
                  </Row>
                )}
                {isOpen && (
                  <Animated.View entering={still ? undefined : FadeIn.duration(200)} style={{ gap: 8 }}>
                    {ss.items.map((it, j) => (
                      <Row key={`${it.exId}-${j}`} gap={12}>
                        {byId[it.exId] ? <Thumb ex={byId[it.exId]} size={36} /> : <IconBox icon="barbell" size={36} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T v="body" numberOfLines={1}>{byId[it.exId]?.name ?? it.exId}</T>
                          {en?.perExercise[j] && (
                            <T v="small" numberOfLines={1} style={s.num}>
                              {[!gentle && en.perExercise[j].kcal > 0 ? `${en.source === 'watch' ? '' : 'about '}${en.perExercise[j].kcal} kcal` : null,
                                en.perExercise[j].avgHr ? `avg ${en.perExercise[j].avgHr} bpm` : null].filter(Boolean).join(' · ')}
                            </T>
                          )}
                        </View>
                        <T v="small" numberOfLines={1} style={{ maxWidth: '40%' }}>{it.sets.filter((x) => x.done).map((x) => (x.weight ? `${x.weight}×${x.reps}` : x.reps)).join('  ')}</T>
                      </Row>
                    ))}
                  </Animated.View>
                )}
                <Row gap={8}>
                  <Tap onPress={() => setOpen(isOpen ? null : ss.id)} style={s.btn} accessibilityLabel={isOpen ? 'Hide exercises' : 'Show exercises'}>
                    <Ionicons name={isOpen ? 'chevron-up' : 'list'} size={16} color={c.text} />
                    <T v="small" color={c.text}>{isOpen ? 'Hide' : 'Exercises'}</T>
                  </Tap>
                  <Tap onPress={() => remove(ss.id)} style={[s.btn, confirm === ss.id && { backgroundColor: c.dangerBg }]} accessibilityLabel="Delete workout">
                    <Ionicons name="trash-outline" size={16} color={confirm === ss.id ? c.danger : c.muted} />
                    <T v="small" color={confirm === ss.id ? c.danger : c.muted}>{confirm === ss.id ? 'Tap again to delete' : 'Delete'}</T>
                  </Tap>
                </Row>
              </View>
            );
          })}
        </View>
      )}

      {watch.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="label">From your watch</T>
          {watch.map((w) => (
            <Row key={w.id} gap={12} style={s.item}>
              <IconBox icon={typeIcon(w.type)} color={c.blue} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>{w.title ?? w.type}</T>
                <T v="small" numberOfLines={2}>
                  {[sourceName(w), `${Math.max(1, Math.round(w.durationS / 60))} min`, w.kcal && !gentle ? `${Math.round(w.kcal)} kcal` : null,
                    w.distanceM ? `${(w.distanceM / 1000).toFixed(1)} km` : null, w.avgHr ? `avg ${Math.round(w.avgHr)} bpm` : null].filter(Boolean).join(' · ')}
                </T>
              </View>
            </Row>
          ))}
        </View>
      )}

      {stats.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="label">Day totals{origins.length ? ` · ${origins.join(', ')}` : ''}</T>
          <Row gap={8}>
            {stats.map((x) => (
              <View key={x.label} style={s.stat}>
                <Ionicons name={x.icon} size={16} color={x.color} />
                <T v="h3" numberOfLines={1}>{x.value}</T>
                <T v="small" numberOfLines={1}>{x.label}</T>
              </View>
            ))}
          </Row>
        </View>
      )}

      {(dayMeals.length > 0 || glasses > 0) && (
        <View style={{ gap: 8 }}>
          <T v="label">Food and water</T>
          <Row gap={8}>
            {dayMeals.length > 0 && !gentle && <MiniStat icon="restaurant" color={dom.kcal} value={eaten.toLocaleString()} label="kcal eaten" />}
            {dayMeals.length > 0 && !gentle && <MiniStat icon="egg" color={dom.protein} value={`${Math.round(protein)} g`} label="protein" />}
            {dayMeals.length > 0 && gentle && <MiniStat icon="restaurant" color={dom.kcal} value={String(dayMeals.length)} label={dayMeals.length === 1 ? 'meal' : 'meals'} />}
            {glasses > 0 && <MiniStat icon="water" color={dom.water} value={ml(toMl(glasses))} label="water" />}
          </Row>
        </View>
      )}

      {/* Said once: today's status line already says "Nothing logged yet" when nothing was planned. */}
      {nothing && k <= today && !status?.startsWith('Nothing') && (
        <T v="body" color={c.muted}>{k === today ? 'Nothing logged yet' : 'Nothing logged or synced'}</T>
      )}

      {/* Excuse a day: the missed-workout nudge skips it and the calendar shows why. */}
      {!ours.length && (
        <View style={{ gap: 8 }}>
          <T v="label">{why ? 'Marked as' : 'Mark this day'}</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {(['rest', 'sick', 'travel'] as Excuse[]).map((e) => (
              <Chip key={e} label={EXCUSE[e].label} icon={EXCUSE[e].icon} on={why === e} color={c.text}
                onPress={() => { excuse(why === e ? null : e, k); haptic('light'); }} />
            ))}
          </Row>
        </View>
      )}
      {k === today && !ours.length && (
        <Tap onPress={() => router.navigate('/')} style={s.link}>
          <T v="h3" color={c.accent}>Today’s workout</T>
          <Ionicons name="chevron-forward" size={16} color={c.accent} />
        </Tap>
      )}
    </ScrollView>
  );
}

// Where a workout's calorie number comes from: measured by the watch, worked out from heart rate, or estimated.
export function SourceBadge({ source }: { source: EnergySource }) {
  const col = source === 'watch' ? c.blue : source === 'heart rate' ? dom.heart : c.muted;
  return (
    <View style={[s.badge, { backgroundColor: source === 'estimate' ? c.card : tint(col, 1.2) }]} accessibilityLabel={`Source: ${SOURCE_LABEL[source]}`}>
      <Ionicons name={source === 'watch' ? 'watch-outline' : source === 'heart rate' ? 'heart-outline' : 'calculator-outline'} size={12} color={source === 'estimate' ? c.muted : c.text} />
      <T v="small" color={source === 'estimate' ? c.muted : c.text} style={{ fontSize: 12, lineHeight: 16 }}>{SOURCE_LABEL[source]}</T>
    </View>
  );
}

const MiniStat = ({ icon, color, value, label }: { icon: Icon; color: string; value: string; label: string }) => (
  <View style={s.stat}>
    <Ionicons name={icon} size={16} color={color} />
    <T v="h3" numberOfLines={1}>{value}</T>
    <T v="small" numberOfLines={1}>{label}</T>
  </View>
);

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  head: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, height: 62, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  ring: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  box: { width: 38, height: 38, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center' },
  num: { fontVariant: ['tabular-nums'] },
  watchDot: { position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  corner: { position: 'absolute', top: -5, right: -5, backgroundColor: c.card, borderRadius: 8, padding: 1 },
  kcal: { fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'], textAlign: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 12 },
  legendItem: { minHeight: 20 },
  swatch: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: c.card },
  panel: { borderRadius: r.lg, padding: 14, gap: 10 },
  item: { borderRadius: r.md, padding: 12, gap: 10, backgroundColor: c.card2 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.card },
  stat: { flex: 1, minWidth: 0, borderRadius: r.md, padding: 12, gap: 2, backgroundColor: c.card2 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 44 },
});
