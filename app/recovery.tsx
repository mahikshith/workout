// Recovery: today's readiness (HRV and resting HR against your own baseline, plus sleep), what drives it, last
// night's sleep stages, workout effort and load, and the 14-day trend. Home of the readiness and effort numbers;
// HRV, resting HR and sleep themselves live in Progress › Body & watch (linked at the bottom).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bars, LineChart } from '../src/charts';
import { LEVEL_WORD, MIN_NIGHTS, effortScore, dayBefore, type Factor } from '../src/health/readiness';
import { levelColor, readinessAdvice, useEffort, useReadiness, useReadinessTrend } from '../src/health/useReadiness';
import { DoorCard, EASE, Header, useMiniBarSpace } from '../src/kit';
import { c, r } from '../src/theme';
import { dayKey } from '../src/calc';
import { Button, Ring, T } from '../src/ui';

const FACTOR_ICON: Record<Factor['key'], keyof typeof Ionicons.glyphMap> = { hrv: 'pulse', rhr: 'heart', sleep: 'moon', regular: 'time-outline' };
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const hm = (min: number) => { const t = Math.round(min), h = Math.floor(t / 60), m = t % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`; }; // never "0h 10m" or "7h 60m"
const clock = (iso?: string) => { const d = new Date(iso ?? NaN); return Number.isFinite(d.getTime()) ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };

export default function Recovery() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const still = useReducedMotion();
  const rd = useReadiness();
  const trend = useReadinessTrend(14);
  const effort = useEffort();
  const advice = readinessAdvice(rd);
  const today = dayKey();
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(Math.min(i, 6) * 60).duration(380).easing(EASE));
  const col = levelColor(rd.level);
  const noData = rd.score === null && rd.nights === 0 && !rd.sleep;
  const st = rd.sleep?.stages;
  const trendVals = trend.filter((x): x is number => x !== null);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Recovery" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* Readiness */}
        <Animated.View entering={enter(0)} style={[s.card, { alignItems: 'center', gap: 10 }]}>
          <Ring size={168} stroke={14} progress={(rd.score ?? 0) / 100} color={col}>
            {rd.score !== null ? (
              <View style={{ alignItems: 'center' }}>
                <T v="num" style={{ fontSize: 52, lineHeight: 58 }}>{rd.score}</T>
                <T v="label">Readiness</T>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingHorizontal: 18 }}>
                <Ionicons name="hourglass-outline" size={26} color={c.muted} />
                <T v="small" style={{ textAlign: 'center' }}>{noData ? 'No watch data yet' : `${Math.max(0, MIN_NIGHTS - rd.nights)} more nights`}</T>
              </View>
            )}
          </Ring>
          <T v="h2" color={rd.level ? col : c.text}>{rd.level ? LEVEL_WORD[rd.level] : noData ? 'Connect a watch' : 'Learning your baseline'}</T>
          <T v="small" style={{ textAlign: 'center' }}>
            {advice ?? (rd.level ? 'Your body is about where it usually is' : noData ? 'Readiness needs HRV or resting HR from a watch' : 'Wear your watch to bed a few more nights')}
          </T>
          {noData && <Button title="Connect your watch" icon="watch-outline" onPress={() => router.push({ pathname: '/watch', params: { connect: '1' } })} style={{ alignSelf: 'stretch' }} />}
        </Animated.View>

        {rd.flags.map((f) => (
          <View key={f} style={[s.flag, { borderColor: c.warm + '66' }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.warm} />
            <T v="body" style={{ flex: 1 }}>{f}</T>
          </View>
        ))}

        {/* What moves the score */}
        {rd.factors.length > 0 && (
          <Animated.View entering={enter(1)} style={s.card}>
            <T v="h3">What moves it</T>
            {rd.factors.map((f) => (
              <View key={f.key} style={s.row}>
                <Ionicons name={FACTOR_ICON[f.key]} size={18} color={c.muted} />
                <T v="body" style={{ flex: 1 }}>{f.label}</T>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="body" color={c.text}>{f.value}</T>
                  <T v="small">{f.vs}</T>
                </View>
                <Ionicons name={f.effect > 0 ? 'arrow-up-circle' : f.effect < 0 ? 'arrow-down-circle' : 'remove-circle-outline'} size={20}
                  color={f.effect > 0 ? c.ok : f.effect < 0 ? c.warm : c.dim} />
              </View>
            ))}
          </Animated.View>
        )}

        {/* Last night */}
        {rd.sleep && (
          <Animated.View entering={enter(2)} style={s.card}>
            <View style={s.row}>
              <T v="h3" style={{ flex: 1 }}>Last night</T>
              {!!clock(rd.sleep.start) && !!clock(rd.sleep.end) && <T v="small">{clock(rd.sleep.start)} – {clock(rd.sleep.end)}</T>}
            </View>
            {Number.isFinite(rd.sleep.minutes) && <T v="num">{hm(rd.sleep.minutes)}</T>}
            {st ? (
              <>
                <View style={s.stageBar}>
                  {STAGES.map((x) => (st[x.k] > 0 ? <View key={x.k} style={{ flex: st[x.k], backgroundColor: x.color }} /> : null))}
                </View>
                <View style={s.legend}>
                  {STAGES.map((x) => (
                    <View key={x.k} style={s.legendItem}>
                      <View style={[s.dot, { backgroundColor: x.color }]} />
                      <T v="small">{x.label} {hm(st[x.k])}</T>
                    </View>
                  ))}
                </View>
              </>
            ) : <T v="small">No sleep stages from this watch</T>}
          </Animated.View>
        )}

        {/* Effort */}
        <Animated.View entering={enter(3)} style={s.card}>
          <View style={s.row}>
            <T v="h3" style={{ flex: 1 }}>Effort</T>
            <T v="small">{effort.load.trend === 'up' ? 'Higher than usual this week' : effort.load.trend === 'down' ? 'Lighter than usual this week' : effort.load.trend === 'steady' ? 'Usual week' : 'Last 7 days'}</T>
          </View>
          {effort.load.week.some((t) => t > 0) && <Bars items={effort.load.week.map((t, k) => ({ label: WD[new Date(`${dayBefore(today, 6 - k)}T12:00:00`).getDay()], value: effortScore(t) }))} height={90} color={c.pink} />}
          {effort.last ? (
            <View style={{ gap: 8 }}>
              <View style={s.row}>
                <Ionicons name={/run|walk|bik|cycl|swim|hik/i.test(effort.last.title) ? 'walk-outline' : 'barbell-outline'} size={18} color={c.muted} />
                <T v="body" numberOfLines={1} style={{ flex: 1 }}>{effort.last.title}</T>
                <T v="small">Effort</T>
                <T v="body" color={c.text}>{effort.last.score}<T v="small"> / 100</T></T>
              </View>
              <T v="small">
                {effort.last.minutes} min · {effort.last.avgHr ? `avg ${Math.round(effort.last.avgHr)} bpm` : 'no heart rate, estimated'}
              </T>
              {effort.last.zones.some((z) => z > 0) && (
                <>
                  <View style={s.stageBar}>
                    {effort.last.zones.map((z, k) => (z > 0 ? <View key={k} style={{ flex: z, backgroundColor: ZONE_COLORS[k] }} /> : null))}
                  </View>
                  <T v="small">Sets by heart-rate zone, 1 easy to 5 max</T>
                </>
              )}
            </View>
          ) : <T v="small">Finish a workout and its effort shows here, from 0 (easy) to 100 (all out)</T>}
        </Animated.View>

        {/* Trend */}
        {trendVals.length >= 2 && (
          <Animated.View entering={enter(4)} style={s.card}>
            <View style={s.row}>
              <T v="h3" style={{ flex: 1 }}>Readiness, 14 days</T>
              <T v="small">Avg {Math.round(trendVals.reduce((a, b) => a + b, 0) / trendVals.length)}</T>
            </View>
            <LineChart values={trendVals} height={110} color={c.blue} />
          </Animated.View>
        )}

        <Animated.View entering={enter(5)}>
          <DoorCard icon="stats-chart" color={c.blue} title="Body & watch" meta="HRV, resting HR and sleep over time"
            onPress={() => router.push({ pathname: '/chart/[kind]', params: { kind: 'body' } })} />
        </Animated.View>
        <T v="small" style={{ paddingHorizontal: 4 }}>Our own score from your HRV, resting HR and sleep. Not medical advice</T>
      </ScrollView>
    </View>
  );
}

const STAGES: { k: 'deep' | 'light' | 'rem' | 'awake'; label: string; color: string }[] = [
  { k: 'deep', label: 'Deep', color: '#3B5BDB' },
  { k: 'light', label: 'Light', color: '#5AC8FA' },
  { k: 'rem', label: 'REM', color: '#AF7AF5' },
  { k: 'awake', label: 'Awake', color: '#FF8A3D' },
];
const ZONE_COLORS = ['#55555C', '#5AC8FA', '#30D158', '#E6C36A', '#FF8A3D', '#FF453A'];

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1 },
  stageBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
