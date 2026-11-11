// Tracker: everything your watch, band, ring or strap shares, in one place. Live heart rate while a strap, ring or
// watch broadcast is connected; today's numbers from Health Connect (steps, calories, resting HR, HRV, SpO2, breathing,
// skin temperature, sleep), today's heart-rate line and zones, and the workouts your watch recorded. Honest: a number
// the watch app doesn't share shows "—" and says so. Nothing connected: one card that explains the path and connects.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { dayKey } from '../src/calc';
import { sync, useBle } from '../src/health';
import { useRing } from '../src/health/colmiDevice';
import { APP_NAME, DataPath, directPath, hcPath, syncedAgo, useWatchLink } from '../src/health/DataPath';
import { subscribeLive, useLiveHr } from '../src/health/live';
import { hrMaxFor, zoneOf } from '../src/health/readiness';
import { EASE, Header, useMiniBarSpace } from '../src/kit';
import { useStore } from '../src/store';
import { c, dom, r, tint } from '../src/theme';
import { useTracker, type DailyMetrics, type ImportedWorkout } from '../src/tracker';
import { Button, IconBox, T, Tap } from '../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const ANDROID = Platform.OS === 'android';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hm = (min: number) => { const t = Math.round(min), h = Math.floor(t / 60), m = t % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`; }; // never "0h 10m" or "7h 60m"
const dayName = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  const diff = Math.round((new Date(`${dayKey()}T12:00:00`).getTime() - d.getTime()) / 86400000);
  return diff === 1 ? 'Yesterday' : WD[d.getDay()];
};
const when = (iso: string) => {
  const d = new Date(iso);
  const k = dayKey(d);
  const day = k === dayKey() ? 'Today' : dayName(k) === 'Yesterday' ? 'Yesterday' : `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
  return `${day}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const typeIcon = (t: string): Icon => (/run/i.test(t) ? 'walk' : /walk|hik/i.test(t) ? 'walk-outline' : /bik|cycl/i.test(t) ? 'bicycle' : /swim/i.test(t) ? 'water' : /strength|weight/i.test(t) ? 'barbell' : /yoga|pilates|stretch/i.test(t) ? 'body' : 'fitness');

// Zones 1-5 by heart-rate reserve (src/health/readiness.ts zoneOf), coloured from calm to hard with the app's domain colours.
const ZONE_NAMES = ['Below zones', 'Easy', 'Light', 'Steady', 'Hard', 'Max'];
const zoneColors = () => [c.dim, dom.sleep, dom.water, dom.steps, dom.kcal, dom.heart];

// A metric for today: today's value, or the latest of the last two days with its day, or why it's missing.
type Cell = { key: string; icon: Icon; color: string; label: string; value?: string; unit?: string; sub?: string };

export default function Tracker() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const still = useReducedMotion();
  const daily = useTracker((s) => s.daily);
  const workouts = useTracker((s) => s.workouts);
  const merged = useTracker((s) => s.merged);
  const hrDay = useTracker((s) => s.hrDay);
  const link = useWatchLink();
  const ble = useBle();
  const ring = useRing();
  const bpm = useLiveHr();
  const age = useStore((s) => s.profile.age);
  const [syncing, setSyncing] = useState(false);
  const today = dayKey();
  const app = link.apps[0];
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(Math.min(i, 6) * 60).duration(380).easing(EASE));

  const runSync = async () => {
    setSyncing(true);
    try { await sync(); } finally { setSyncing(false); }
  };

  // Live: who is streaming right now.
  // A device's own name can be empty, generic or just "Live" (some watches broadcast as "Live"/"HR"): then say what
  // it is, so the card never reads "Live from Live".
  const named = (n: string | undefined, fallback: string) => (n && n.trim().length > 2 && !/^(live|hr|heart ?rate( sensor)?)$/i.test(n.trim()) ? n.trim() : fallback);
  const liveFrom = bpm === null ? null
    : ring.status === 'connected' && ring.live ? named(link.ring?.name, 'your ring')
      : ble.status === 'connected' ? named(link.strap?.name, 'your strap') : 'your device';

  const rest = useMemo(() => {
    const xs = Object.values(daily).map((d) => d.restingHr).filter((x): x is number => !!x).slice(-28);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 60;
  }, [daily]);
  const max = hrMaxFor(age);

  const cells = useMemo<Cell[]>(() => {
    const keys = Object.keys(daily).sort().reverse();
    const ever = (f: keyof DailyMetrics) => keys.some((k) => daily[k][f] !== undefined);
    const why = (f: keyof DailyMetrics) => (ever(f) ? 'Nothing today yet' : app ? `Not shared by ${app}` : 'Not shared by your watch app');
    // Today, else yesterday or the day before (labelled), else why not.
    const pick = (f: keyof DailyMetrics, days = 2): { v?: number; sub?: string } => {
      for (const k of keys.slice(0, 5)) {
        if (k > today) continue;
        const back = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${k}T12:00:00`).getTime()) / 86400000);
        if (back > days) break;
        const v = daily[k][f];
        if (typeof v === 'number') return { v, sub: back === 0 ? undefined : dayName(k) };
      }
      return { sub: why(f) };
    };
    const t = daily[today];
    const steps = t?.steps;
    const kcalActive = t?.activeKcal;
    const kcalTotal = t?.totalKcal;
    const rhr = pick('restingHr');
    const hrv = pick('hrvMs');
    const spo2 = pick('spo2Pct');
    const resp = pick('respRate');
    const temp = pick('skinTempDelta');
    const sleep = t?.sleep;
    const out: Cell[] = [
      { key: 'steps', icon: 'footsteps', color: dom.steps, label: 'Steps', value: steps?.toLocaleString(), sub: steps === undefined ? why('steps') : undefined },
      kcalActive !== undefined || kcalTotal === undefined
        ? { key: 'kcal', icon: 'flame', color: dom.kcal, label: 'Active calories', value: kcalActive?.toLocaleString(), unit: 'kcal', sub: kcalActive === undefined ? why('activeKcal') : undefined }
        : { key: 'kcal', icon: 'flame', color: dom.kcal, label: 'Calories, total', value: kcalTotal.toLocaleString(), unit: 'kcal' },
      { key: 'rhr', icon: 'heart', color: dom.heart, label: 'Resting HR', value: rhr.v !== undefined ? String(Math.round(rhr.v)) : undefined, unit: 'bpm', sub: rhr.sub },
      { key: 'hrv', icon: 'pulse', color: dom.heart, label: 'HRV', value: hrv.v !== undefined ? String(Math.round(hrv.v)) : undefined, unit: 'ms', sub: hrv.sub },
      { key: 'spo2', icon: 'water', color: dom.water, label: 'SpO2', value: spo2.v !== undefined ? String(Math.round(spo2.v)) : undefined, unit: '%', sub: spo2.sub },
      { key: 'resp', icon: 'leaf-outline', color: dom.sleep, label: 'Breathing', value: resp.v !== undefined ? resp.v.toFixed(1) : undefined, unit: '/min', sub: resp.sub },
      { key: 'sleep', icon: 'moon', color: dom.sleep, label: 'Sleep', value: sleep ? hm(sleep.minutes) : undefined, sub: sleep ? (sleep.stages ? `${hm(sleep.stages.deep)} deep` : 'No stages') : why('sleep') },
    ];
    const vo2 = pick('vo2max', 30);
    const w = pick('weightKg', 7);
    // Skin temperature only when we have it: Health Connect can't hand it to us yet, and an always-empty tile read
    // like an error. Connect › What Gym Buddy gets still lists it as "We can't read it yet".
    if (temp.v !== undefined) out.push({ key: 'temp', icon: 'thermometer-outline', color: dom.kcal, label: 'Skin temp', value: `${temp.v > 0 ? '+' : ''}${temp.v.toFixed(1)}`, unit: '°C', sub: temp.sub ?? 'Against your usual' });
    if (vo2.v !== undefined) out.push({ key: 'vo2', icon: 'speedometer-outline', color: dom.train, label: 'VO2 max', value: vo2.v.toFixed(1), sub: vo2.sub });
    if (w.v !== undefined) out.push({ key: 'w', icon: 'scale-outline', color: dom.weight, label: 'Weight', value: w.v.toFixed(1), unit: 'kg', sub: w.sub });
    return out;
  }, [daily, today, app]);

  const list = useMemo(() => {
    const since = Date.now() - 14 * 86400000;
    return Object.values(workouts).filter((w) => Date.parse(w.start) >= since).sort((a, b) => b.start.localeCompare(a.start));
  }, [workouts]);
  const mergedCount = useMemo(() => Object.values(merged).filter((w) => Date.parse(w.start) >= Date.now() - 14 * 86400000).length, [merged]);

  const hrToday = hrDay && hrDay.date === today ? hrDay : null;

  // --- Nothing connected: explain the path, one action.
  if (!link.any) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Tracker" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={[s.card, { gap: 16 }]}>
            <DataPath nodes={hcPath({ seen: false, allowed: false })} />
            <View style={{ gap: 6 }}>
              <T v="h2">Bring your watch's numbers here</T>
              <T v="small">Heart rate, sleep, steps, calories, HRV and your watch workouts. Your watch's own app passes them to {APP_NAME} through Health Connect</T>
            </View>
            <Button title="Connect your watch" icon="watch-outline" onPress={() => router.push({ pathname: '/watch', params: { connect: '1' } })} />
          </Animated.View>
          <Animated.View entering={enter(1)}>
            <Tap onPress={() => router.push({ pathname: '/watch', params: { do: 'strap' } })} style={[s.card, s.row]} scale={0.98} accessibilityLabel="Pair a heart-rate strap">
              <DataPath nodes={directPath({ device: 'Strap', ok: false })} size="sm" />
              <View style={{ flex: 1 }}>
                <T v="h3">Strap or ring?</T>
                <T v="small" numberOfLines={3}>Straps and Colmi rings connect over Bluetooth</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.dim} />
            </Tap>
          </Animated.View>
          {!ANDROID && <WebNote />}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Tracker" actionIcon="settings-outline" onAction={() => router.push('/watch')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        {!ANDROID && <WebNote />}

        {/* Live heart rate */}
        <Animated.View entering={enter(0)}>
          {bpm !== null ? (
            <LiveCard bpm={bpm} from={liveFrom ?? 'your device'} rest={rest} max={max} />
          ) : (
            <Tap onPress={() => router.push({ pathname: '/watch', params: link.strap || link.ring ? {} : { do: 'strap' } })} style={[s.card, s.row]} scale={0.98} accessibilityLabel="Live heart rate">
              <IconBox icon="heart-outline" color={dom.heart} />
              <View style={{ flex: 1 }}>
                <T v="h3">Live heart rate</T>
                <T v="small" numberOfLines={2}>
                  {link.strap ? `${link.strap.name} · connects when you start a workout`
                    : link.ring ? `${link.ring.name} · live in workouts when it's near`
                      : 'Pair a strap, or turn on heart-rate broadcast on your watch'}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.dim} />
            </Tap>
          )}
        </Animated.View>

        {/* Where the numbers come from, and Sync now */}
        <Animated.View entering={enter(1)} style={[s.card, { gap: 12 }]}>
          <DataPath nodes={hcPath({ app: app ?? 'Watch app', seen: link.seen, allowed: link.allowed })} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <T v="small" color={c.text} numberOfLines={2}>{link.allowed ? (link.seen ? `From ${link.apps.join(', ')}` : 'Health Connect is on, no watch data yet') : 'Health Connect not connected'}</T>
              <T v="small">{link.allowed ? cap(syncedAgo(link.lastSync)) : link.ring ? `Ring: ${link.ring.name}` : 'Connect to fill this in'}</T>
            </View>
            {link.allowed
              ? <Button kind="ghost" title={syncing ? 'Syncing' : 'Sync now'} icon="refresh" onPress={runSync} disabled={syncing || !ANDROID} style={{ height: 44, paddingHorizontal: 16 }} />
              : <Button kind="ghost" title="Connect" icon="watch-outline" onPress={() => router.push({ pathname: '/watch', params: { connect: '1' } })} style={{ height: 44, paddingHorizontal: 16 }} />}
          </View>
        </Animated.View>

        {/* Today's numbers */}
        <Animated.View entering={enter(2)} style={{ gap: 10, marginTop: 12 }}>
          <T v="h2" style={{ paddingHorizontal: 4 }}>Today</T>
          <View style={s.grid}>
            {cells.map((x) => (
              <View key={x.key} style={s.tile} accessible accessibilityLabel={`${x.label}: ${x.value ? `${x.value} ${x.unit ?? ''}` : 'no data'}. ${x.sub ?? ''}`}>
                <View style={s.row}>
                  <Ionicons name={x.icon} size={16} color={x.color} />
                  <T v="small" numberOfLines={1} style={{ flex: 1 }}>{x.label}</T>
                </View>
                <T v="num" style={{ fontSize: 24, lineHeight: 30 }} color={x.value ? c.text : c.dim}>
                  {x.value ?? '—'}{x.value && x.unit ? <T v="small"> {x.unit}</T> : null}
                </T>
                <T v="small" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>{x.sub ?? ' '}</T>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Heart rate today */}
        <Animated.View entering={enter(3)} style={[s.card, { gap: 12, marginTop: 12 }]}>
          <View style={s.row}>
            <T v="h3" style={{ flex: 1 }}>Heart rate today</T>
            {hrToday && <T v="small">avg {hrToday.avg} bpm</T>}
          </View>
          {hrToday ? (
            <>
              <Sparkline values={hrToday.bpm} color={dom.heart} height={96} />
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <T v="small" style={{ fontSize: 12 }}>Midnight</T>
                <T v="small" style={{ fontSize: 12 }}>low {hrToday.min} · high {hrToday.max}</T>
                <T v="small" style={{ fontSize: 12 }}>Now</T>
              </View>
              <Zones minutes={hrToday.zoneMin} />
            </>
          ) : (
            <T v="small">
              {daily[today]?.avgHr !== undefined ? `Average ${daily[today].avgHr} bpm. Sync again to see the line`
                : link.allowed ? (app ? `Not shared by ${app}` : 'No heart rate from your watch app yet') : 'Shows once your watch shares heart rate'}
            </T>
          )}
        </Animated.View>

        {/* Watch workouts */}
        <Animated.View entering={enter(4)} style={{ gap: 10, marginTop: 12 }}>
          <T v="h2" style={{ paddingHorizontal: 4 }}>From your watch</T>
          {list.length ? list.slice(0, 12).map((w) => <WorkoutRow key={w.id} w={w} />) : (
            <View style={s.card}><T v="small">No workouts from your watch in the last 2 weeks. Ones you record on it show up here</T></View>
          )}
          {mergedCount > 0 && (
            <T v="small" style={{ paddingHorizontal: 4 }}>{mergedCount === 1 ? '1 more was' : `${mergedCount} more were`} added to workouts you logged here</T>
          )}
        </Animated.View>

        <T v="small" style={{ paddingHorizontal: 4, marginTop: 8 }}>Numbers come only from your devices. Not medical advice</T>
      </ScrollView>
    </View>
  );
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

function WebNote() {
  return (
    <View style={[s.note, { borderColor: c.blue + '55' }]}>
      <Ionicons name="phone-portrait-outline" size={18} color={c.blue} />
      <T v="small" color={c.text} style={{ flex: 1 }}>Health Connect and Bluetooth work in the Android app. Here you see what's saved</T>
    </View>
  );
}

function WorkoutRow({ w }: { w: ImportedWorkout }) {
  const bits = [`${Math.round(w.durationS / 60)} min`, w.kcal ? `${w.kcal} kcal` : null, w.avgHr ? `avg ${w.avgHr} bpm` : null, w.distanceM && w.distanceM > 100 ? `${(w.distanceM / 1000).toFixed(1)} km` : null].filter(Boolean);
  return (
    <View style={[s.card, s.row, { paddingVertical: 12 }]}>
      <IconBox icon={typeIcon(w.type)} color={dom.train} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.row}>
          <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{w.title ?? w.type}</T>
          <T v="small" style={{ fontSize: 12 }}>{when(w.start)}</T>
        </View>
        <T v="small" numberOfLines={1}>{bits.join(' · ')}</T>
      </View>
    </View>
  );
}

// Live heart rate: the number with a beating heart, its zone, and the last minute as a line.
function LiveCard({ bpm, from, rest, max }: { bpm: number; from: string; rest: number; max: number }) {
  const still = useReducedMotion();
  const [buf, setBuf] = useState<number[]>([]);
  const last = useRef(0);
  useEffect(() => subscribeLive((x) => {
    if (!x || x.contact === false || !(x.bpm > 0)) return;
    if (x.at - last.current < 900) return; // one point a second
    last.current = x.at;
    setBuf((b) => [...b.slice(-59), x.bpm]);
  }), []);
  const beat = useSharedValue(1);
  useEffect(() => {
    if (still) return;
    const ms = Math.max(300, Math.min(1500, 60000 / bpm));
    beat.value = withRepeat(withSequence(withTiming(1.18, { duration: ms * 0.25 }), withTiming(1, { duration: ms * 0.75 })), -1, false);
  }, [bpm, still]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const z = zoneOf(bpm, rest, max);
  return (
    <View style={[s.card, { gap: 12, borderColor: tint(dom.heart, 3) }]}>
      <View style={s.row}>
        <Animated.View style={a}><Ionicons name="heart" size={30} color={dom.heart} /></Animated.View>
        <T v="display" style={{ fontSize: 44, lineHeight: 50 }}>{bpm}</T>
        <T v="small" style={{ marginTop: 14 }}>bpm</T>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={[s.pill, { backgroundColor: tint(zoneColors()[z], 1.4) }]}><T v="small" color={c.text}>{z ? `Zone ${z} · ${ZONE_NAMES[z]}` : 'Resting'}</T></View>
        </View>
      </View>
      {buf.length > 2 && <Sparkline values={buf} color={dom.heart} height={56} dot />}
      <T v="small">Live from {from}</T>
    </View>
  );
}

// One line over time, gaps where there is no reading, a soft fill under it. Single series: no legend.
function Sparkline({ values, color, height, dot }: { values: (number | null)[]; color: string; height: number; dot?: boolean }) {
  const [w, setW] = useState(0);
  const nums = values.filter((v): v is number => v !== null);
  const lo = Math.min(...nums) - 4, hi = Math.max(...nums) + 4;
  const n = Math.max(2, values.length);
  const x = (i: number) => (i / (n - 1)) * (w - 6) + 3;
  const y = (v: number) => 4 + (1 - (v - lo) / Math.max(1, hi - lo)) * (height - 8);
  let d = '', area = '', runStart = -1;
  values.forEach((v, i) => {
    if (v === null) { if (runStart >= 0) { area += ` L${x(i - 1)},${height} L${x(runStart)},${height} Z`; runStart = -1; } return; }
    const pt = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    if (runStart < 0) { d += ` M${pt}`; area += ` M${pt}`; runStart = i; } else { d += ` L${pt}`; area += ` L${pt}`; }
  });
  if (runStart >= 0) area += ` L${x(values.length - 1)},${height} L${x(runStart)},${height} Z`;
  const lastI = values.length - 1 - [...values].reverse().findIndex((v) => v !== null);
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && nums.length > 0 && (
        <Svg width={w} height={height}>
          <Path d={area} fill={tint(color, 0.9)} />
          <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {dot && values[lastI] != null && <Circle cx={x(lastI)} cy={y(values[lastI] as number)} r={4} fill={color} stroke={c.card} strokeWidth={2} />}
        </Svg>
      )}
    </View>
  );
}

// Minutes in each heart-rate zone today: one bar split by zone, and the minutes under it.
function Zones({ minutes }: { minutes: number[] }) {
  const cols = zoneColors();
  const z = minutes.slice(1);
  const total = z.reduce((a, b) => a + b, 0);
  if (total < 1) return <T v="small">No time in heart-rate zones yet today</T>;
  return (
    <View style={{ gap: 8 }}>
      <View style={s.bar}>
        {z.map((m, k) => (m > 0 ? <View key={k} style={{ flex: m, backgroundColor: cols[k + 1] }} /> : null))}
      </View>
      <View style={[s.row, { flexWrap: 'wrap', columnGap: 14, rowGap: 6 }]}>
        {z.map((m, k) => (m > 0 ? (
          <View key={k} style={[s.row, { gap: 6 }]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cols[k + 1] }} />
            <T v="small" color={c.text}>{ZONE_NAMES[k + 1]} <T v="small">{hm(m).replace(/^0h /, '')}</T></T>
          </View>
        ) : null))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.4%', gap: 4, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1 },
  pill: { paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center' },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
});
