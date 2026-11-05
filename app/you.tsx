import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOALS, optLabel } from '../src/context';
import { title } from '../src/data/exercises';
import { planById } from '../src/data/plans';
import { EASE, Header, toToday, useMiniBarSpace } from '../src/kit';
import { Sheet } from '../src/sheet';
import { answered } from '../src/glance';
import { useStore } from '../src/store';
import { ACCENTS, c, r, type AccentId } from '../src/theme';
import { useTracker } from '../src/tracker';
import { Button, IconBox, T, Tap } from '../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const clock12 = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

// Profile and settings, behind the avatar on every tab: a profile card, then one grouped list. Rows open a section of
// /profile, a sheet (appearance, data) or their own page (watch, reminders, etiquette).
export default function You() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const reminders = useStore((s) => s.reminders);
  const setProfile = useStore((s) => s.setProfile);
  const reset = useStore((s) => s.reset);
  const connected = useTracker((s) => s.hc.connected);
  const periods = useStore((s) => s.periods);
  const logPeriod = useStore((s) => s.logPeriod);
  const dismissed = useStore((s) => s.dismissed);
  const weighIns = useStore((s) => s.weights.length);
  const [sheet, setSheet] = useState<'look' | 'data' | null>(null);
  const [confirm, setConfirm] = useState(false);

  const accent = profile.accent ?? 'lime';
  // Changing the accent remounts the app from the root (new colours everywhere), which drops the screen stack.
  // Come back here once it has remounted.
  const pickAccent = (id: AccentId) => {
    if (id === accent) return;
    setSheet(null);
    setProfile({ ...useStore.getState().profile, accent: id });
    setTimeout(() => router.replace('/you'), 60);
  };
  const closeData = () => { setSheet(null); setConfirm(false); };
  // Everything this app keeps, as one JSON file: the share sheet on a phone, a download on the web.
  const exportData = async () => {
    const plain = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function'));
    const json = JSON.stringify({ app: 'gym-buddy', exportedAt: new Date().toISOString(), store: plain(useStore.getState()), tracker: plain(useTracker.getState()) }, null, 2);
    const name = `gym-buddy-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      await Share.share({ title: name, message: json }).catch(() => {});
    }
  };
  const erase = () => { closeData(); reset();
    useTracker.setState({ daily: {}, workouts: {}, hc: { connected: false, granted: [] }, strap: null, strapHrv: {} });
    toToday();
  };

  const next = reminders.filter((x) => x.kind === 'workout' && x.on).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))[0];
  const gentle = profile.gentle || profile.concerns?.includes('food');
  // Only what the person actually answered; untouched guest defaults are not shown as answers.
  const has = (k: Parameters<typeof answered>[2]) => answered(profile, dismissed, k);
  const about = [
    has('age') ? `${profile.age} y` : '', has('heightCm') ? `${profile.heightCm} cm` : '',
    gentle || !(has('weightKg') || weighIns > 1) ? '' : `${profile.weightKg} kg`,
  ].filter(Boolean).join(' · ') || 'Not set';
  const place = profile.place === 'both' ? 'Gym and home' : title(profile.place);

  // Cycle tracking's permanent home (Today only keeps a dismissible shortcut). Same rule as Today: a period counts as
  // running for up to 10 days after its logged start.
  const last = periods[periods.length - 1];
  const inPeriod = !!last && !last.end && Date.now() - Date.parse(last.start) < 10 * 86400000;
  const cycle = profile.women?.mode === 'cycle';
  const dayLabel = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const rows: { icon: Icon; color?: string; t: string; v?: string; go: () => void; act?: boolean }[] = [
    { icon: 'watch-outline', color: c.blue, t: 'Watch & health', v: connected ? 'Connected' : 'Not connected', go: () => router.push('/watch') },
    { icon: 'flag-outline', t: 'Plan and goal', v: optLabel(GOALS, profile.goal), go: () => router.push({ pathname: '/profile', params: { s: 'plan' } }) },
    { icon: 'person-outline', t: 'About you', v: about, go: () => router.push({ pathname: '/profile', params: { s: 'about' } }) },
    ...(cycle ? [{ icon: 'water-outline' as Icon, color: c.pink, t: inPeriod ? 'Period ended' : 'Log period start',
      v: last ? `${inPeriod ? 'Started' : 'Last'} ${dayLabel(last.start)}` : 'Today', go: () => logPeriod(inPeriod ? 'end' : 'start'), act: true }] : []),
    { icon: 'location-outline', t: 'Where you train', v: place, go: () => router.push({ pathname: '/profile', params: { s: 'place' } }) },
    { icon: 'notifications-outline', t: 'Reminders', v: next ? clock12(next.hour, next.minute) : 'Off', go: () => router.push('/reminders') },
    { icon: 'color-palette-outline', t: 'Appearance', v: ACCENTS[accent]?.name, go: () => setSheet('look') },
    { icon: 'people-outline', t: 'Gym etiquette', go: () => router.push('/etiquette') },
    { icon: 'server-outline', color: c.muted, t: 'Your data', v: 'On this phone', go: () => setSheet('data') },
  ];
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="You" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 40 + mini, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <Tap onPress={() => router.push({ pathname: '/profile', params: { s: 'about' } })} scale={0.98} style={s.card}>
            <View style={[s.avatar, { backgroundColor: c.accent }]}>
              {profile.name ? <T v="h2" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={24} color={c.accentInk} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h2" numberOfLines={1}>{profile.name || 'Guest'}</T>
              <T v="small" numberOfLines={1}>{optLabel(GOALS, profile.goal)} · {profile.daysPerWeek} days a week</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.dim} />
          </Tap>
        </Animated.View>

        <Animated.View entering={enter(1)} style={s.group}>
          {rows.map((x, i) => (
            <Tap key={x.t} onPress={x.go} scale={0.99} style={[s.row, i > 0 && s.rule]}>
              <IconBox icon={x.icon} color={x.color} size={32} />
              <T v="body" numberOfLines={1} style={{ flex: 1 }}>{x.t}</T>
              {x.v ? <T v="small" numberOfLines={1} style={{ flexShrink: 1, maxWidth: '45%' }}>{x.v}</T> : null}
              <Ionicons name={x.act ? 'add-circle-outline' : 'chevron-forward'} size={x.act ? 20 : 16} color={x.act ? c.pink : c.dim} />
            </Tap>
          ))}
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <T v="small" color={c.dim} style={{ textAlign: 'center' }}>
            {planById[planId] ? `Plan: ${planById[planId].name} · ` : ''}Not medical advice
          </T>
        </Animated.View>
      </ScrollView>

      <Sheet open={sheet === 'look'} onClose={() => setSheet(null)}>
        <View style={{ gap: 16 }}>
          <T v="h3">Accent colour</T>
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
            const on = accent === id;
            return (
              <Tap key={id} onPress={() => pickAccent(id)} scale={0.98} style={s.swatchRow}>
                <View style={[s.swatch, { backgroundColor: ACCENTS[id].hex }]}>
                  {on && <Ionicons name="checkmark" size={18} color={c.accentInk} />}
                </View>
                <T v="body" style={{ flex: 1 }} color={on ? c.text : c.muted}>{ACCENTS[id].name}</T>
              </Tap>
            );
          })}
        </View>
      </Sheet>

      <Sheet open={sheet === 'data'} onClose={closeData}>
        <View style={{ gap: 12 }}>
          <T v="h3">Your data</T>
          <T v="small">Everything stays on this phone. Nothing is uploaded.</T>
          {confirm ? (
            <>
              <T v="body" color={c.danger}>This deletes your profile, workouts, meals, weights and watch data on this phone.</T>
              <Button title="Yes, erase everything" kind="danger" onPress={erase} />
              <Button title="Cancel" kind="ghost" onPress={() => setConfirm(false)} />
            </>
          ) : (
            <>
              <Button title="Export data" kind="ghost" icon="download-outline" onPress={exportData} />
              <Button title="Erase all data" kind="danger" icon="trash-outline" onPress={() => setConfirm(true)} />
            </>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
  rule: { borderTopWidth: 1, borderTopColor: c.card2 },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
