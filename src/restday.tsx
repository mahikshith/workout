// The rest-day sheet (docs/REDESIGN.md, Start on a rest day). Start does not begin a workout on a rest day; it opens
// this sheet with three ways in: Train anyway (the plan's next day), Quick 20 min (short sessions from quickFor and
// the cardio ladder from cardioFor) or Pick exercises (the library). useToday().start in kit.tsx opens it.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Place } from './data/exercises';
import { cardioFor } from './data/cardio';
import { asDay, type Quick } from './data/quick';
import { quickFor, suggest, type Suggestion } from './engine';
import { openWorkout } from './kit';
import { Sheet } from './sheet';
import { useStore, type Profile, type Session } from './store';
import { c, r } from './theme';
import { Button, haptic, Row, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
export type QuickPick = { id: string; name: string; minutes: number; icon: Icon; sub: string; place: Place; q: Quick };

const placeOf = (p: Profile): Place => (p.place === 'home' || p.place === 'office' ? 'home' : 'gym');

// Short sessions for a rest day: the best quick session around 20 minutes, then the cardio ladder's picks for this
// person. At most three, so the sheet stays short.
export function quickPicks(p: Profile, sessions: Session[], now = Date.now()): QuickPick[] {
  const home = placeOf(p);
  const quick = quickFor(p, now).filter((q) => q.minutes >= 10 && (home === 'gym' ? true : !q.where.includes('gym')))
    .sort((a, b) => Math.abs(a.minutes - 20) - Math.abs(b.minutes - 20)).slice(0, 1)
    .map((q): QuickPick => ({ id: q.id, name: q.name, minutes: q.minutes, icon: q.icon, sub: `${q.minutes} min · ${q.blurb}`, place: home, q }));
  const ladder = cardioFor(p, sessions);
  const cardio = ladder.picks.slice(0, 2).map((q): QuickPick => ({
    id: q.id, name: q.name, minutes: q.minutes, icon: q.icon, sub: `${q.minutes} min · Cardio, ${ladder.name.toLowerCase()} stage`,
    place: q.at === 'gym' ? 'gym' : q.at === 'home' ? 'home' : home, q,
  }));
  return [...quick, ...cardio].slice(0, 3);
}

// Everything the rest-day sheet offers, from the store as it is right now.
export function restDayOptions(now = Date.now()): { next: Suggestion; place: Place; picks: QuickPick[] } {
  const st = useStore.getState();
  const next = suggest({ profile: st.profile, sessions: st.sessions, meals: st.meals, water: st.water, checkins: st.checkins,
    planId: st.planId, nextDay: st.nextDay, planStart: st.planStart }, now);
  return { next, place: placeOf(st.profile), picks: quickPicks(st.profile, st.sessions, now) };
}

// True when Start should open the rest-day sheet instead of starting a workout.
export const isRestDay = (now = Date.now()) => !useStore.getState().active && restDayOptions(now).next.kind === 'rest';

export function RestDaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const opts = useMemo(() => (open ? restDayOptions() : null), [open, profile, sessions]);

  const go = (fn: () => void) => {
    if (useStore.getState().active) { onClose(); openWorkout(); return; }
    haptic('medium');
    fn();
    onClose();
    openWorkout();
  };
  const trainAnyway = () => {
    if (!opts) return;
    const { next, place } = opts;
    go(() => useStore.getState().start(next.day, place, next.planId, next.dayIndex));
  };
  const startQuick = (q: QuickPick) => go(() => useStore.getState().start(asDay(q.q), q.place));
  const pick = () => { onClose(); router.push('/library'); };

  return (
    <Sheet open={open} onClose={onClose}>
      {opts && (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{opts.next.reason.startsWith('Done') ? 'Done for today' : 'Rest day'}</T>
            <T v="small" numberOfLines={2}>{opts.next.reason.split('. ')[0]}</T>
          </View>
          <Button title={`Train anyway · ${opts.next.day.name}`} icon="play" onPress={trainAnyway} />
          {opts.picks.length > 0 && <T v="label" style={{ marginTop: 4 }}>Quick 20 min</T>}
          {opts.picks.map((q) => (
            <Tap key={q.id} onPress={() => startQuick(q)} style={s.row} scale={0.98}>
              <View style={[s.icon, { backgroundColor: c.accent + '22' }]}><Ionicons name={q.icon} size={20} color={c.accent} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="h3" numberOfLines={1}>{q.name}</T>
                <T v="small" numberOfLines={1}>{q.sub}</T>
              </View>
              <Ionicons name="play" size={16} color={c.accent} />
            </Tap>
          ))}
          <Tap onPress={pick} style={s.row} scale={0.98}>
            <View style={[s.icon, { backgroundColor: c.card }]}><Ionicons name="list" size={20} color={c.text} /></View>
            <T v="h3" style={{ flex: 1 }}>Pick exercises</T>
            <Ionicons name="chevron-forward" size={18} color={c.dim} />
          </Tap>
          <Row style={{ justifyContent: 'center' }}>
            <Tap onPress={onClose} style={s.rest}><T v="h3" color={c.muted}>Rest today</T></Tap>
          </Row>
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rest: { height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
