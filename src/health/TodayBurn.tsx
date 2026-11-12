// Home's burn row: today's calories burned and the heart rate, in one quiet line that opens the Tracker.
// Calories: the watch's active total for today when it shares one (it already holds today's workouts), else today's
// workouts added up (measured by the watch, worked out from heart rate, or estimated; src/health/energy.ts).
// Heart rate: live while a strap, ring or watch broadcast streams, else the last reading the watch shared today.
// Shows nothing when there is nothing honest to show (no workout and no watch numbers today), and never calories in
// no-numbers mode.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { appList } from '../calendar';
import { dayKey } from '../calc';
import { useStore } from '../store';
import { c, dom, r } from '../theme';
import { useTracker } from '../tracker';
import { IconBox, Row, T, Tap } from '../ui';
import { PHONE_ORIGINS } from './guides';
import { useLiveHr } from './live';
import { useTodayBurn } from './useEnergy';

export function TodayBurn() {
  const profile = useStore((s) => s.profile);
  const hrDay = useTracker((t) => t.hrDay);
  const burn = useTodayBurn();
  const live = useLiveHr();
  const gentle = !!(profile?.gentle || profile?.concerns?.includes('food'));

  const kcal = gentle ? undefined : burn.kcal;
  const lastBpm = hrDay && hrDay.date === dayKey() ? [...hrDay.bpm].reverse().find((v): v is number => v !== null) : undefined;
  const bpm = live ?? lastBpm;
  if (kcal === undefined && bpm === undefined) return null;

  const apps = appList(burn.origin.filter((p) => !PHONE_ORIGINS.includes(p)));
  const n = burn.parts.length;
  const sub = kcal === undefined ? (live !== null ? 'Live' : 'From your watch')
    : burn.from === 'day' ? `${apps.length ? apps.join(' and ') : 'Your watch'}${n ? ` · workout${n === 1 ? '' : 's'} included` : ' · active'}`
      : burn.parts.every((q) => q.source === 'heart rate') ? 'From heart rate'
      : burn.estimated ? `From today's workout${n === 1 ? '' : 's'}` : 'Measured by your watch';
  const said = [kcal !== undefined ? `${kcal} kcal burned today` : null, bpm !== undefined ? `${live !== null ? 'live' : 'last'} heart rate ${bpm}` : null, sub].filter(Boolean).join(', ');

  return (
    <Tap onPress={() => router.push('/tracker')} scale={0.98} accessibilityLabel={`${said}. Open tracker`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <IconBox icon={kcal !== undefined ? 'flame' : 'heart'} color={kcal !== undefined ? dom.kcal : dom.heart} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="h3" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
          {kcal !== undefined ? `${burn.from === 'workouts' && burn.estimated ? 'About ' : ''}${kcal.toLocaleString()} kcal burned today` : `${bpm} bpm`}
        </T>
        <T v="small" numberOfLines={1}>{sub}</T>
      </View>
      {kcal !== undefined && bpm !== undefined && (
        <Row gap={4} style={{ alignItems: 'baseline' }}>
          <Ionicons name="heart" size={14} color={dom.heart} />
          <T v="h3" style={{ fontVariant: ['tabular-nums'] }}>{bpm}</T>
          <T v="small">{live !== null ? 'live' : 'bpm'}</T>
        </Row>
      )}
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Tap>
  );
}
