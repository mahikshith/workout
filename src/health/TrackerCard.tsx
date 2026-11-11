// Today's tracker pane. Connected: live heart rate while a strap, ring or watch broadcast streams, otherwise a glance
// at steps, calories and resting HR with when it last synced; opens the Tracker. Nothing connected: one line with the
// small data-path picture that opens Connect your watch.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { dayKey } from '../calc';
import { c, dom, r } from '../theme';
import { latest, useTracker } from '../tracker';
import { T, Tap } from '../ui';
import { DataPath, hcPath, syncedAgo, useWatchLink } from './DataPath';
import { useLiveHr } from './live';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export function TrackerCard() {
  const link = useWatchLink();
  const daily = useTracker((s) => s.daily);
  const bpm = useLiveHr();

  if (!link.any) {
    return (
      <Tap onPress={() => router.push({ pathname: '/watch', params: { connect: '1' } })} style={[s.card, s.row]} scale={0.98} accessibilityLabel="Connect a watch">
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" numberOfLines={1}>Connect a watch</T>
          <T v="small" numberOfLines={1}>Heart rate, sleep, steps</T>
        </View>
        <DataPath nodes={hcPath({ seen: false, allowed: false })} size="sm" />
      </Tap>
    );
  }

  const t = daily[dayKey()];
  const rhr = latest(daily, 'restingHr', 1);
  const kcal = t?.activeKcal ?? t?.totalKcal;
  const stats: { icon: keyof typeof Ionicons.glyphMap; color: string; v?: string; label: string }[] = [
    { icon: 'footsteps', color: dom.steps, v: t?.steps?.toLocaleString(), label: 'steps' },
    { icon: 'flame', color: dom.kcal, v: kcal?.toLocaleString(), label: 'kcal' },
    { icon: 'heart', color: dom.heart, v: rhr !== undefined ? String(Math.round(rhr)) : undefined, label: 'resting' },
  ];
  const meta = bpm !== null ? 'Live now'
    : link.allowed ? cap(syncedAgo(link.lastSync))
      : link.ring ? link.ring.name : link.strap ? link.strap.name : 'Tracker';

  return (
    <Tap onPress={() => router.push('/tracker')} style={[s.card, { gap: 12 }]} scale={0.98} accessibilityLabel="Open tracker">
      <View style={s.row}>
        <Ionicons name="pulse" size={18} color={dom.heart} />
        <T v="h3" style={{ flex: 1 }}>Tracker</T>
        <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{meta}</T>
        <Ionicons name="chevron-forward" size={18} color={c.dim} />
      </View>
      {bpm !== null ? (
        <View style={[s.row, { gap: 8 }]}>
          <Ionicons name="heart" size={22} color={dom.heart} />
          <T v="num">{bpm}</T>
          <T v="small" style={{ marginTop: 6 }}>bpm</T>
        </View>
      ) : (
        <View style={s.row}>
          {stats.map((x) => (
            <View key={x.label} style={{ flex: 1, gap: 2 }}>
              <View style={[s.row, { gap: 6 }]}>
                <Ionicons name={x.icon} size={14} color={x.color} />
                <T v="small" numberOfLines={1}>{x.label}</T>
              </View>
              <T v="h2" numberOfLines={1} color={x.v ? c.text : c.dim}>{x.v ?? '—'}</T>
            </View>
          ))}
        </View>
      )}
    </Tap>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
