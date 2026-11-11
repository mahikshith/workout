// What comes into Gym Buddy from the watch, and what happens to it: calories and heart rate are attached to every
// workout logged here; the day's calories go on the calendar. Shown on the Tracker and on Watch & health. A tick means
// that number arrived in the last 7 days; without one it reads as "this is what you'd get".
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from '../store';
import { c, dom, r, tint } from '../theme';
import { useTracker } from '../tracker';
import { Row, T, Tap } from '../ui';
import { APP_NAME } from './DataPath';
import { SOURCE_LABEL } from './energy';
import { energyFor, useEnergyData } from './useEnergy';

type Icon = keyof typeof Ionicons.glyphMap;

export function WatchGives() {
  const daily = useTracker((t) => t.daily);
  const hc = useTracker((t) => t.hc);
  const strap = useTracker((t) => t.strap);
  const ring = useTracker((t) => t.ring);
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const data = useEnergyData();
  const gentle = !!(profile?.gentle || profile?.concerns?.includes('food'));

  const got = useMemo(() => {
    const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const days = Object.values(daily).filter((d) => d.date >= since);
    const hrs = Object.values(data.sessionHr);
    return {
      kcal: days.some((d) => d.activeKcal !== undefined || d.totalKcal !== undefined) || Object.values(data.sessionKcal ?? {}).some((k) => k.activeKcal !== undefined || k.totalKcal !== undefined),
      hr: days.some((d) => d.avgHr !== undefined || d.restingHr !== undefined) || hrs.length > 0,
      steps: days.some((d) => d.steps !== undefined),
      sleep: days.some((d) => !!d.sleep),
    };
  }, [daily, data]);
  const last = useMemo(() => {
    const s = [...sessions].filter((x) => x.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0];
    return s ? { s, e: energyFor(s, data, profile) } : null;
  }, [sessions, data, profile]);

  const items: { key: keyof typeof got; icon: Icon; color: string; label: string; to: string }[] = [
    ...(gentle ? [] : [{ key: 'kcal' as const, icon: 'flame' as Icon, color: dom.kcal, label: 'Calories', to: 'each workout, calendar' }]),
    { key: 'hr', icon: 'heart', color: dom.heart, label: 'Heart rate', to: 'each workout and set' },
    { key: 'steps', icon: 'footsteps', color: dom.steps, label: 'Steps', to: 'your day' },
    { key: 'sleep', icon: 'moon', color: dom.sleep, label: 'Sleep', to: 'recovery' },
  ];
  const linked = hc.connected || !!strap || !!ring;
  const denied = hc.connected && !gentle && !hc.granted.includes('ActiveCaloriesBurned') && !hc.granted.includes('TotalCaloriesBurned');
  const lastLine = last && (last.e.kcal > 0 || last.e.avgHr)
    ? [last.s.title, !gentle && last.e.kcal > 0 ? `${last.e.source === 'watch' ? '' : 'about '}${last.e.kcal} kcal` : null, last.e.avgHr ? `avg ${last.e.avgHr} bpm` : null,
      !gentle && last.e.kcal > 0 ? SOURCE_LABEL[last.e.source].toLowerCase() : null].filter(Boolean).join(' · ')
    : null;

  return (
    <View style={s.card}>
      <T v="h3">What comes into {APP_NAME}</T>
      <View style={s.grid}>
        {items.map((x) => (
          <View key={x.key} style={s.item} accessible accessibilityLabel={`${x.label}${got[x.key] ? ', arriving' : ''}: goes to ${x.to}`}>
            <View style={[s.dot, { backgroundColor: tint(x.color, 1.2) }]}>
              <Ionicons name={x.icon} size={16} color={x.color} />
              {got[x.key] && <View style={[s.tick, { backgroundColor: c.ok }]}><Ionicons name="checkmark" size={10} color={c.accentInk} /></View>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="small" color={c.text} numberOfLines={1}>{x.label}</T>
              <T v="small" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{x.to}</T>
            </View>
          </View>
        ))}
      </View>
      <Row gap={10} style={s.flow}>
        <Ionicons name="watch-outline" size={16} color={c.muted} />
        <Ionicons name="arrow-forward" size={12} color={c.dim} />
        <Ionicons name="barbell" size={16} color={c.accent} />
        <T v="small" color={c.text} style={{ flex: 1 }}>
          {gentle ? 'Your watch cannot see sets and reps. Every workout you log here gets its heart rate attached by itself'
            : 'Your watch cannot see sets and reps. Every workout you log here gets its calories and heart rate attached by itself'}
        </T>
      </Row>
      {lastLine && (
        <Tap onPress={() => router.push('/history')} style={s.last} feedback="none" accessibilityLabel={`Last workout: ${lastLine}. Open the calendar`}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="small" style={{ fontSize: 12, lineHeight: 16 }}>Last workout</T>
            <T v="small" color={c.text} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{lastLine}</T>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.dim} />
        </Tap>
      )}
      {denied && <T v="small">Calories are switched off for {APP_NAME} in Health Connect, so workouts show an estimate. Allow them under Health Connect › App permissions</T>}
      {!linked && !lastLine && <T v="small">Until a watch is connected, workouts show an estimate from your sets and weight</T>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  item: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', right: -3, top: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  flow: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  last: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: r.md, backgroundColor: c.card2 },
});
