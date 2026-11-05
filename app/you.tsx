import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOALS, optLabel } from '../src/context';
import { setsCsv } from '../src/importApps';
import { title } from '../src/data/exercises';
import { planById } from '../src/data/plans';
import { EASE, Header, Segmented, toToday, useMiniBarSpace } from '../src/kit';
import { setPrefs, useLook } from '../src/look';
import { Sheet } from '../src/sheet';
import { answered } from '../src/glance';
import { useStore, type MediaPref } from '../src/store';
import { ACCENTS, accentHex, c, dom, r, tint, type AccentId, type Mode } from '../src/theme';
import { useTracker } from '../src/tracker';
import { Button, IconBox, T, Tap } from '../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const clock12 = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
const MODES: { k: Mode; label: string }[] = [{ k: 'system', label: 'System' }, { k: 'light', label: 'Light' }, { k: 'dark', label: 'Dark' }];
const DEMOS: { k: MediaPref; label: string; sub: string; icon: Icon }[] = [
  { k: 'animated', label: 'Animated', sub: 'Moving figure, works offline', icon: 'walk' },
  { k: 'drawing', label: 'Drawing', sub: 'Step-by-step drawings', icon: 'brush' },
  { k: 'photo', label: 'Photo', sub: 'Real photos, needs internet', icon: 'image' },
  { k: 'video', label: 'Video', sub: 'Short clips where we have them', icon: 'videocam' },
];
const web = Platform.OS === 'web';
// A theme change remounts the app (or reloads the page). This brings the theme sheet back afterwards.
let reopenLook = false;

// Profile and settings, behind the avatar on every tab: a profile card, the look of the app, then one grouped list.
// Rows open a section of /profile, a sheet (theme, demos, data) or their own page (watch, reminders, etiquette).
export default function You() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const params = useLocalSearchParams<{ sheet?: string }>();
  const profile = useStore((s) => s.profile);
  const planId = useStore((s) => s.planId);
  const reminders = useStore((s) => s.reminders);
  const reset = useStore((s) => s.reset);
  const connected = useTracker((s) => s.hc.connected);
  const periods = useStore((s) => s.periods);
  const logPeriod = useStore((s) => s.logPeriod);
  const dismissed = useStore((s) => s.dismissed);
  const weighIns = useStore((s) => s.weights.length);
  const hasSets = useStore((s) => s.sessions.length > 0);
  const mediaPref = useStore((s) => s.mediaPref);
  const setMediaPref = useStore((s) => s.setMediaPref);
  const mode = useLook((s) => s.mode);
  const accent = useLook((s) => s.accent);
  const haptics = useLook((s) => s.haptics);
  const [sheet, setSheet] = useState<'look' | 'data' | 'demo' | null>(() => {
    const again = reopenLook || params.sheet === 'look';
    reopenLook = false;
    return again ? 'look' : null;
  });
  const [confirm, setConfirm] = useState(false);

  // Light/dark and the accent apply at once: the page reloads on the web; on a phone the app redraws in place and
  // comes back here with this sheet open.
  const pickLook = async (patch: { mode?: Mode; accent?: AccentId }) => {
    if ((patch.mode ?? mode) === mode && (patch.accent ?? accent) === accent) return;
    reopenLook = true;
    if (web) try { window.history.replaceState(window.history.state, '', '/you?sheet=look'); } catch {}
    // Kept in the profile too, so an export still carries the accent.
    if (patch.accent) useStore.getState().setProfile({ ...useStore.getState().profile, accent: patch.accent });
    const done = await setPrefs(patch);
    if (done === 'saved') reopenLook = false;
  };
  const closeData = () => { setSheet(null); setConfirm(false); };
  // Everything this app keeps, as one JSON file: the share sheet on a phone, a download on the web.
  const exportData = async () => {
    const plain = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function'));
    const json = JSON.stringify({ app: 'gym-buddy', exportedAt: new Date().toISOString(), store: plain(useStore.getState()), tracker: plain(useTracker.getState()) }, null, 2);
    await save(`gym-buddy-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
  };
  // Every logged set, one row each: opens in a spreadsheet, and Watch & health › Import from a file reads it back.
  const exportSets = () => save(`gym-buddy-sets-${new Date().toISOString().slice(0, 10)}.csv`, setsCsv(useStore.getState().sessions), 'text/csv');
  const save = async (name: string, text: string, type: string) => {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      await Share.share({ title: name, message: text }).catch(() => {});
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

  type RowT = { icon: Icon; color: string; t: string; v?: string; go?: () => void; act?: boolean; toggle?: { on: boolean; set: (on: boolean) => void } };
  const look: RowT[] = [
    { icon: 'color-palette', color: c.accent, t: 'Theme and colours', v: `${MODES.find((m) => m.k === mode)?.label} · ${ACCENTS[accent].name}`, go: () => setSheet('look') },
    { icon: 'play-circle', color: dom.water, t: 'Exercise demos', v: DEMOS.find((d) => d.k === mediaPref)?.label, go: () => setSheet('demo') },
    // Haptics are phone-only (the web has none).
    ...(web ? [] : [{ icon: 'pulse' as Icon, color: dom.sleep, t: 'Haptics', toggle: { on: haptics, set: (on: boolean) => { setPrefs({ haptics: on }); } } }]),
  ];
  const rows: RowT[] = [
    { icon: 'flag', color: dom.train, t: 'Plan and goal', v: optLabel(GOALS, profile.goal), go: () => router.push({ pathname: '/profile', params: { s: 'plan' } }) },
    { icon: 'person', color: dom.weight, t: 'About you', v: about, go: () => router.push({ pathname: '/profile', params: { s: 'about' } }) },
    ...(cycle ? [{ icon: 'water' as Icon, color: dom.protein, t: inPeriod ? 'Period ended' : 'Log period start',
      v: last ? `${inPeriod ? 'Started' : 'Last'} ${dayLabel(last.start)}` : 'Today', go: () => logPeriod(inPeriod ? 'end' : 'start'), act: true }] : []),
    { icon: 'location', color: dom.steps, t: 'Where you train', v: place, go: () => router.push({ pathname: '/profile', params: { s: 'place' } }) },
    { icon: 'notifications', color: dom.streak, t: 'Reminders', v: next ? clock12(next.hour, next.minute) : 'Off', go: () => router.push('/reminders') },
  ];
  const more: RowT[] = [
    { icon: 'watch', color: dom.heart, t: 'Watch & health', v: connected ? 'Connected' : 'Not connected', go: () => router.push('/watch') },
    { icon: 'people', color: dom.sleep, t: 'Gym etiquette', go: () => router.push('/etiquette') },
    { icon: 'server', color: c.muted, t: 'Your data', v: 'On this phone', go: () => setSheet('data') },
  ];
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const group = (list: RowT[]) => list.map((x, i) => (
    <Tap key={x.t} onPress={x.toggle ? () => x.toggle!.set(!x.toggle!.on) : x.go} scale={0.99} style={[s.row, i > 0 && s.rule]}
      accessibilityRole={x.toggle ? 'switch' : 'button'} accessibilityState={x.toggle ? { checked: x.toggle.on } : undefined}>
      <IconBox icon={x.icon} color={x.color} size={34} />
      <T v="body" numberOfLines={1} style={{ flex: 1 }}>{x.t}</T>
      {x.v ? <T v="small" numberOfLines={1} style={{ flexShrink: 1, maxWidth: '50%' }}>{x.v}</T> : null}
      {x.toggle ? (
        <Switch value={x.toggle.on} onValueChange={x.toggle.set} trackColor={{ true: c.accent, false: c.line }} thumbColor="#FFFFFF" ios_backgroundColor={c.line} />
      ) : <Ionicons name={x.act ? 'add-circle-outline' : 'chevron-forward'} size={x.act ? 20 : 16} color={x.act ? dom.protein : c.dim} />}
    </Tap>
  ));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="You" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 40 + mini, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <Tap onPress={() => router.push({ pathname: '/profile', params: { s: 'about' } })} scale={0.98} style={[s.card, { borderColor: tint(c.accent, 1.6) }]}>
            <LinearGradient colors={[tint(c.accent, 1.5), tint(dom.train, 0.5), c.card]} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[s.avatar, { backgroundColor: c.accent }]}>
              {profile.name ? <T v="h2" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={24} color={c.accentInk} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h2" numberOfLines={1}>{profile.name || 'Guest'}</T>
              <T v="small" numberOfLines={1}>{optLabel(GOALS, profile.goal)} · {profile.daysPerWeek} days a week</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Tap>
        </Animated.View>

        <Animated.View entering={enter(1)} style={{ gap: 8 }}>
          <T v="label" style={s.head}>Look and feel</T>
          <View style={s.group}>{group(look)}</View>
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ gap: 8 }}>
          <T v="label" style={s.head}>You and your plan</T>
          <View style={s.group}>{group(rows)}</View>
        </Animated.View>

        <Animated.View entering={enter(3)} style={{ gap: 8 }}>
          <T v="label" style={s.head}>More</T>
          <View style={s.group}>{group(more)}</View>
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <T v="small" color={c.muted} style={{ textAlign: 'center' }}>
            {planById[planId] ? `Plan: ${planById[planId].name} · ` : ''}Not medical advice
          </T>
        </Animated.View>
      </ScrollView>

      {/* Theme and colours: light, dark or the phone's setting, and the accent. */}
      <Sheet open={sheet === 'look'} onClose={() => setSheet(null)}>
        <View style={{ gap: 16 }}>
          <T v="h2">Theme and colours</T>
          <View style={{ gap: 8 }}>
            <T v="label">Theme</T>
            <Segmented options={MODES} value={mode} onChange={(m) => pickLook({ mode: m })} />
            <T v="small">{mode === 'system' ? 'Follows your phone: light by day if your phone is set that way' : mode === 'light' ? 'Always light' : 'Always dark'}</T>
          </View>
          <View style={{ gap: 8 }}>
            <T v="label">Accent colour</T>
            <View style={s.swatches}>
              {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
                const on = accent === id;
                return (
                  <Tap key={id} onPress={() => pickLook({ accent: id })} scale={0.92} style={s.swatchCell}
                    accessibilityLabel={ACCENTS[id].name} accessibilityState={{ selected: on }}>
                    <View style={[s.swatchRing, { borderColor: on ? accentHex(id) : 'transparent' }]}>
                      <View style={[s.swatch, { backgroundColor: accentHex(id) }]}>
                        {on && <Ionicons name="checkmark" size={20} color={c.accentInk} />}
                      </View>
                    </View>
                    <T v="small" numberOfLines={2} color={on ? c.text : c.muted} style={{ textAlign: 'center', fontSize: 12, lineHeight: 15 }}>{ACCENTS[id].name}</T>
                  </Tap>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <T v="label">Colours for each part of your day</T>
            <View style={s.legend}>
              {([['train', 'barbell', 'Training'], ['heart', 'heart', 'Heart'], ['sleep', 'moon', 'Sleep'], ['kcal', 'flame', 'Food'],
                ['protein', 'nutrition', 'Protein'], ['water', 'water', 'Water'], ['weight', 'scale', 'Weight'], ['streak', 'trophy', 'Streak']] as const).map(([k, icon, label]) => (
                <View key={k} style={[s.chip, { backgroundColor: tint(dom[k]) }]}>
                  <Ionicons name={icon} size={14} color={dom[k]} />
                  <T v="small" color={c.text} style={{ fontSize: 13 }}>{label}</T>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Sheet>

      {/* Which demo every exercise opens on (each exercise can still switch). */}
      <Sheet open={sheet === 'demo'} onClose={() => setSheet(null)}>
        <View style={{ gap: 4 }}>
          <T v="h2" style={{ marginBottom: 8 }}>Exercise demos</T>
          {DEMOS.map((d, i) => {
            const on = mediaPref === d.k;
            return (
              <Tap key={d.k} onPress={() => { setMediaPref(d.k); setSheet(null); }} scale={0.98} style={[s.row, { paddingHorizontal: 0 }, i > 0 && s.rule]}
                accessibilityState={{ selected: on }}>
                <IconBox icon={d.icon} color={on ? c.accent : c.muted} size={34} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body">{d.label}</T>
                  <T v="small" numberOfLines={1}>{d.sub}</T>
                </View>
                {on && <Ionicons name="checkmark-circle" size={22} color={c.accent} />}
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
              <Button title="Export sets (CSV)" kind="ghost" icon="grid-outline" onPress={exportSets} disabled={!hasSets} />
              <Button title="Erase all data" kind="danger" icon="trash-outline" onPress={() => setConfirm(true)} />
            </>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 4 },
  group: { borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10 },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchCell: { width: 64, alignItems: 'center', gap: 6 },
  swatchRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15 },
});
