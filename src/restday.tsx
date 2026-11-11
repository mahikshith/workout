// The rest-day sheet (docs/REDESIGN.md, Start on a rest day). Start does not begin a workout on a rest day; it opens
// this sheet with three ways in: Train anyway (the plan's next day), Quick 20 min (short sessions from quickFor and
// the cardio ladder from cardioFor) or Pick exercises (the library). useToday().start in kit.tsx opens it.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Place } from './data/exercises';
import { cardioFor } from './data/cardio';
import { planById, type Day } from './data/plans';
import { asDay, type Quick } from './data/quick';
import { quickFor, suggest, type Suggestion } from './engine';
import { openWorkout } from './kit';
import { Sheet } from './sheet';
import { useStore, type Profile, type Session } from './store';
import { c, r } from './theme';
import { Button, Chip, haptic, Row, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
export type QuickPick = { id: string; name: string; minutes: number; icon: Icon; sub: string; place: Place; q: Quick };

export const placeOf = (p: Profile): Place => (p.place === 'home' || p.place === 'office' ? 'home' : 'gym');

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
          {opts.picks.length > 0 && <T v="small" color={c.label} style={{ marginTop: 4 }}>Quick 20 min</T>}
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

// Change workout (the workout's ⋯ sheet, and Change next to Start on Today): another day of the current plan, a quick
// session around 20 minutes, or a one-muscle focus day. The caller decides what a pick does (start it, or replace the
// running workout with it).
export type ChangePick = { day: Day; place: Place; planId?: string; dayIndex?: number };
const FOCUS: { label: string; planId: string }[] = [
  { label: 'Chest', planId: 'chest-day' }, { label: 'Back', planId: 'back-day' }, { label: 'Shoulders', planId: 'shoulder-day' },
  { label: 'Arms', planId: 'arm-day' }, { label: 'Legs', planId: 'leg-day' }, { label: 'Glutes', planId: 'glute-day' },
  { label: 'Core', planId: 'core-day' }, { label: 'Mobility', planId: 'mobility' },
];

export function ChangeList({ place, current, note, onPick }: {
  place: Place; current?: { planId?: string; dayIndex?: number; title?: string }; note?: string; onPick: (p: ChangePick) => void;
}) {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const planId = useStore((s) => s.planId);
  const plan = planById[planId];
  const picks = useMemo(() => quickPicks(profile, sessions), [profile, sessions]);
  const focus = FOCUS.filter((x) => planById[x.planId]?.days[0]);
  const pick = (p: ChangePick) => { haptic('medium'); onPick(p); };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T v="h2">Change workout</T>
        <T v="small" numberOfLines={1}>{note ?? 'Pick what you want to do instead'}</T>
      </View>
      <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {plan && <T v="small" color={c.label} style={{ marginTop: 4 }} numberOfLines={1}>{plan.name}</T>}
        {plan?.days.map((d, k) => {
          const now = current?.planId === plan.id && current.dayIndex === k;
          return (
            <Tap key={k} onPress={() => pick({ day: d, place, planId: plan.id, dayIndex: k })} disabled={now} style={s.row} scale={0.98}
              accessibilityLabel={`Change to ${d.name}`}>
              <View style={[s.icon, { backgroundColor: c.card }]}><T v="h3">{k + 1}</T></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="h3" numberOfLines={1}>{d.name}</T>
                <T v="small" numberOfLines={1}>{d.slots.length} exercises · {d.focus}</T>
              </View>
              {now ? <T v="small" color={c.accent}>Now</T> : <Ionicons name="chevron-forward" size={18} color={c.dim} />}
            </Tap>
          );
        })}
        {picks.length > 0 && <T v="small" color={c.label} style={{ marginTop: 8 }}>Quick 20 min</T>}
        {picks.map((q) => (
          <Tap key={q.id} onPress={() => pick({ day: asDay(q.q), place: q.place })} style={s.row} scale={0.98} accessibilityLabel={`Change to ${q.name}`}>
            <View style={[s.icon, { backgroundColor: c.accent + '22' }]}><Ionicons name={q.icon} size={20} color={c.accent} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3" numberOfLines={1}>{q.name}</T>
              <T v="small" numberOfLines={1}>{q.sub}</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.dim} />
          </Tap>
        ))}
        <T v="small" color={c.label} style={{ marginTop: 8 }}>Different focus</T>
        <View style={s.chips}>
          {focus.map((x) => (
            <Chip key={x.planId} label={x.label} on={current?.planId === x.planId}
              onPress={() => pick({ day: planById[x.planId].days[0], place, planId: x.planId, dayIndex: 0 })} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rest: { height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
