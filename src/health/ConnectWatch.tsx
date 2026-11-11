// "Connect your watch": one sheet. Pick the brand, then one page for it: the data-path diagram (watch → its app →
// Health Connect → us) with a tick on each hop we have seen data pass, at most three numbered steps with one button
// each (the current step's button is the filled one), and "What Gym Buddy gets": what the brand's app usually shares
// and what has really arrived. Brands that can also send live heart rate over Bluetooth get that below.
// Brand data lives in ./guides.ts. Android only for the actions; on web and iOS the steps still show, with a note.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { dayKey } from '../calc';
import { EASE } from '../kit';
import { Sheet } from '../sheet';
import { c, r } from '../theme';
import { useTracker } from '../tracker';
import { Button, T, Tap } from '../ui';
import { connect, forgetStrap, startScan, stopScan, useBle } from './ble';
import { brandStatus, metricsFrom } from './brandStatus';
import { useRing } from './colmiDevice';
import { APP_NAME, DataPath, directPath, hcPath, syncedAgo } from './DataPath';
import { GADGETBRIDGE, GUIDES, METRIC_LABEL, METRIC_ORDER, NOT_READ, originName, PHONE_ORIGINS, playUrl, playWeb, type Alt, type Guide, type Metric } from './guides';
import { checkData, HC_PLAY_URL, HC_PLAY_WEB, isAvailable, requestHistory, requestPermissions, sync, type DataCheck, type HcStatus } from './healthConnect';
import { useLiveHr } from './live';

const ANDROID = Platform.OS === 'android';

const openPlay = (pkg: string) => {
  if (!ANDROID) return Linking.openURL(playWeb(pkg)).catch(() => {});
  return Linking.openURL(playUrl(pkg)).catch(() => Linking.openURL(playWeb(pkg)).catch(() => {}));
};
const installHc = () => (ANDROID ? Linking.openURL(HC_PLAY_URL).catch(() => Linking.openURL(HC_PLAY_WEB)) : Linking.openURL(HC_PLAY_WEB)).catch(() => {});

// The brand picker: the eight most asked-for first, the rest as small chips under them.
const PICK = ['fitbit', 'whoop', 'samsung', 'garmin', 'zepp', 'xiaomi', 'colmi', 'other'];
const MORE = ['oura', 'huawei', 'polar'];
const byId = (id: string) => GUIDES.find((g) => g.id === id)!;

const lastWord = (day?: string) => {
  if (!day) return 'recently';
  const n = Math.round((Date.parse(`${dayKey()}T12:00:00`) - Date.parse(`${day}T12:00:00`)) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The app between the watch and Health Connect, by name.
const appOf = (g: Guide) => g.app?.name ?? (g.id === 'huawei' ? 'Gadgetbridge' : 'Watch app');
const deviceOf = (g: Guide) => (g.id === 'whoop' ? 'Your WHOOP' : g.id === 'oura' || g.id === 'colmi' ? 'Your ring' : 'Your watch');
const deviceIcon = (g: Guide) => (g.id === 'oura' || g.id === 'colmi' ? 'ellipse-outline' as const : g.id === 'whoop' ? 'fitness-outline' as const : 'watch-outline' as const);

// One brand's state: what came in through Health Connect, and live heart rate over Bluetooth.
export function useBrand(g: Guide | null) {
  const daily = useTracker((x) => x.daily);
  const workouts = useTracker((x) => x.workouts);
  const merged = useTracker((x) => x.merged);
  const hc = useTracker((x) => x.hc);
  const strap = useTracker((x) => x.strap);
  const ble = useBle();
  const bpm = useLiveHr();
  const st = useMemo(() => {
    if (!g) return null;
    if (g.id !== 'other') return brandStatus(g, daily, workouts, merged);
    // Other: any app that isn't the phone itself counts.
    const pkgs = [...new Set(Object.values(daily).flatMap((d) => d.origin ?? []))].filter((x) => !PHONE_ORIGINS.includes(x) && x !== 'colmi');
    const got = metricsFrom(pkgs, daily, [...Object.values(workouts), ...Object.values(merged)]);
    return { arrived: [...got.arrived], missing: [] as Metric[], days: got.days, last: got.last };
  }, [g, daily, workouts, merged]);
  const saved = !!(g?.live && strap && g.live.match.test(strap.name));
  const liveNow = saved && ble.status === 'connected' && ble.deviceId === strap!.id;
  return { st, hc, strap: saved ? strap : null, liveNow, bpm: liveNow ? bpm : null };
}

// A numbered step: number (a tick once done), one line, an optional second line, and its one button.
function Step({ n, done, title, sub, children }: { n: number; done: boolean; title: string; sub?: string; children?: ReactNode }) {
  return (
    <View style={s.step}>
      <View style={[s.num, done && { backgroundColor: c.ok, borderColor: c.ok }]}>
        {done ? <Ionicons name="checkmark" size={16} color={c.accentInk} /> : <T v="small" color={c.text}>{n}</T>}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ gap: 2 }}>
          <T v="h3" color={done ? c.muted : c.text}>{title}</T>
          {sub ? <T v="small">{sub}</T> : null}
        </View>
        {children}
      </View>
    </View>
  );
}

function Line({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <T v="small" color={c.text} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

// "What Gym Buddy gets": a two-column grid, a tick for each number that has arrived in the last 7 days.
export function GetsTable({ g, arrived }: { g: Guide; arrived: Metric[] }) {
  const app = appOf(g);
  const expected = g.shares ?? [];
  const unsure = g.unsure ?? [];
  const rows = METRIC_ORDER.filter((m) => expected.includes(m) || unsure.includes(m) || arrived.includes(m));
  const notShared = g.shares ? METRIC_ORDER.filter((m) => !rows.includes(m) && !NOT_READ.includes(m)) : [];
  return (
    <View style={s.block}>
      <T v="h3">What {APP_NAME} gets</T>
      {rows.length ? (
        <View style={s.grid}>
          {rows.map((m) => {
            const got = arrived.includes(m);
            const cant = NOT_READ.includes(m);
            const maybe = unsure.includes(m);
            return (
              <View key={m} style={s.cell} accessible accessibilityLabel={`${METRIC_LABEL[m]}: ${got ? 'received' : cant ? "we can't read it yet" : maybe ? 'depends on your plan or model' : 'not yet'}`}>
                <Ionicons name={got ? 'checkmark-circle' : cant ? 'remove-circle-outline' : maybe ? 'help-circle-outline' : 'ellipse-outline'} size={18} color={got ? c.ok : c.dim} />
                <T v="small" color={got ? c.text : c.muted} numberOfLines={1} style={{ flex: 1 }}>{cap(METRIC_LABEL[m])}</T>
              </View>
            );
          })}
        </View>
      ) : <T v="small">Whatever your watch's app shares shows up here with a tick</T>}
      <View style={[s.row, { flexWrap: 'wrap', columnGap: 14, rowGap: 4 }]}>
        <Key icon="checkmark-circle" color={c.ok} text="Received this week" />
        <Key icon="ellipse-outline" color={c.dim} text="Not here yet" />
        {rows.some((m) => unsure.includes(m) && !arrived.includes(m)) && <Key icon="help-circle-outline" color={c.dim} text="Depends on plan or model" />}
        {rows.some((m) => NOT_READ.includes(m)) && <Key icon="remove-circle-outline" color={c.dim} text="We can't read it yet" />}
      </View>
      {notShared.length > 0 && <T v="small">{g.direct ? 'The ring' : app} doesn't send {listOf(notShared.map((m) => METRIC_LABEL[m]))}</T>}
    </View>
  );
}

const Key = ({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name={icon} size={13} color={color} />
    <T v="small" style={{ fontSize: 12 }}>{text}</T>
  </View>
);

export function ConnectWatch({ open, onClose, onAlt, brand }: { open: boolean; onClose: () => void; onAlt: (a: Alt) => void; brand?: string | null }) {
  const still = useReducedMotion();
  const { height } = useWindowDimensions();
  const daily = useTracker((x) => x.daily);
  const hcConnected = useTracker((x) => x.hc.connected);
  const lastSync = useTracker((x) => x.hc.lastSync);
  const hasHistory = useTracker((x) => x.hc.granted.includes('ReadHealthDataHistory'));
  const ringSaved = useTracker((x) => x.ring);
  const ringSt = useRing();
  const [step, setStep] = useState<'pick' | 'guide'>('pick');
  const [id, setId] = useState<string | null>(null);
  const [status, setStatus] = useState<HcStatus | 'checking'>(ANDROID ? 'checking' : 'unavailable');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<DataCheck | null | undefined>(undefined);
  const [tapped, setTapped] = useState<Record<string, boolean>>({}); // "Get" and "Open" tapped, per brand and step
  const [every, setEvery] = useState(false); // every tap of step 2 shown
  const g = GUIDES.find((x) => x.id === id) ?? null;

  useEffect(() => {
    if (!open) { stopScan(); setScanning(false); return; }
    const start = brand ? GUIDES.find((x) => x.id === brand) : undefined;
    if (start) setId(start.id);
    setStep(start ? 'guide' : 'pick');
    setResult(undefined);
    setShowAll(false);
    setEvery(false);
    if (ANDROID) isAvailable().then(setStatus);
  }, [open, brand]);

  // Live heart rate: a scan in this sheet that lists the chosen brand's devices first.
  const ble = useBle();
  const b = useBrand(g);
  const [scanning, setScanning] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const guideScroll = useRef<ScrollView>(null);
  const liveY = useRef(0);
  useEffect(() => { if (ble.status !== 'scanning') setScanning(false); }, [ble.status]);
  const find = () => {
    setScanning(true);
    setShowAll(false);
    startScan(20);
    guideScroll.current?.scrollTo({ y: liveY.current, animated: !still });
  };
  const pickDevice = (d: { id: string; name: string }) => { stopScan(); setScanning(false); connect(d.id, d.name); };
  const brandFound = g?.live ? ble.found.filter((d) => g.live!.match.test(d.name)) : [];
  const listed = showAll || !g?.live ? ble.found : brandFound;

  // Apps that already shared something (from earlier syncs): their brand tile gets a tick.
  const seenPkgs = useMemo(() => new Set(Object.values(daily).flatMap((d) => d.origin ?? [])), [daily]);
  const firstPkg = [...seenPkgs].find((p) => !PHONE_ORIGINS.includes(p) && p !== 'colmi');
  const firstApp = firstPkg ? originName(firstPkg) : undefined;

  const pick = (x: Guide) => { setId(x.id); setStep('guide'); setResult(undefined); setEvery(false); };
  const runCheck = async () => {
    setChecking(true);
    setResult(undefined);
    try {
      await sync().catch(() => false);
      setResult(await checkData().catch(() => null));
    } finally {
      setChecking(false);
    }
  };
  const allow = async () => {
    const granted = await requestPermissions(false).catch(() => [] as string[]);
    if (granted.some((k) => !k.startsWith('write:'))) runCheck();
    else setResult({ granted: 0, sources: [] });
  };
  const alt = (a: Alt) => { onClose(); onAlt(a); };
  const tap = (k: string) => setTapped((t) => ({ ...t, [`${id}:${k}`]: true }));

  const hcMissing = status === 'not_installed' || status === 'needs_update';
  const canAllow = ANDROID && status === 'available';
  const scrollMax = Math.max(320, height * 0.72);
  const enter = (i: number) => (still ? undefined : FadeIn.delay(Math.min(i, 8) * 40).duration(260).easing(EASE));

  const androidNote = !ANDROID && (
    <View style={s.note}>
      <Ionicons name="phone-portrait-outline" size={18} color={c.blue} />
      <T v="small" color={c.text} style={{ flex: 1 }}>Connecting needs the Android app. Here you can read the steps</T>
    </View>
  );

  // --- Pick the brand
  const pickView = (
    <ScrollView style={{ maxHeight: scrollMax }} contentContainerStyle={{ gap: 14, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
      <T v="h2">Connect your watch</T>
      <DataPath nodes={hcPath({ app: firstApp, seen: !!firstApp, allowed: hcConnected })} />
      <T v="small">Watches don't pair with {APP_NAME} directly. Your watch's own app passes its data on through Health Connect</T>
      {androidNote}
      <T v="label">Pick yours</T>
      <View style={s.tiles}>
        {PICK.map(byId).map((x, i) => {
          const on = x.packages.some((p) => seenPkgs.has(p)) || (x.id === 'colmi' && !!ringSaved);
          return (
            <Animated.View key={x.id} entering={enter(i)} style={s.tileHalf}>
              <Tap onPress={() => pick(x)} style={s.tile} scale={0.97} accessibilityLabel={x.name}>
                <Ionicons name={deviceIcon(x)} size={18} color={c.muted} />
                <T v="h3" numberOfLines={2} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>{x.tile ?? x.name}</T>
                {on && <Ionicons name="checkmark-circle" size={18} color={c.ok} />}
              </Tap>
            </Animated.View>
          );
        })}
      </View>
      <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
        <T v="small">Also</T>
        {MORE.map(byId).map((x) => (
          <Tap key={x.id} onPress={() => pick(x)} style={s.chip} scale={0.96} accessibilityLabel={x.name}>
            <T v="small" color={c.text}>{x.tile ?? x.name.split(' /')[0]}</T>
          </Tap>
        ))}
      </View>
    </ScrollView>
  );

  // --- One brand's page
  const arrived = b.st?.arrived ?? [];
  const seen = arrived.length > 0;
  const app = g ? appOf(g) : '';
  const src = g?.app ? originName(g.app.pkg) : app; // where numbers come from: "Fitbit", not its app's new name
  const ringOn = !!ringSaved && (ringSt.status === 'connected' || ringSt.status === 'syncing');
  // The filled button: the first step not done, or Check again / Done once access is on.
  const done1 = seen || !!tapped[`${id}:get`];
  const done2 = seen || !!tapped[`${id}:open`];
  const cur: 1 | 2 | 3 | 'check' | 'done' = seen && hcConnected ? 'done' : hcConnected ? 'check' : !done1 ? 1 : !done2 ? 2 : 3;
  const kind = (k: typeof cur) => (k === cur ? 'primary' as const : 'ghost' as const);
  const status1 = !g ? '' : g.direct
    ? (ringOn ? 'Connected over Bluetooth' : ringSaved ? `${ringSaved.name} saved · connects when it's near` : 'Not connected yet')
    : !hcConnected ? 'Not connected yet'
      : seen ? `Last data ${lastWord(b.st?.last)} from ${src} · ${syncedAgo(lastSync)}` : `Health Connect is on · waiting for data from ${src}`;

  const hcSteps = g && !g.direct && (
    <View style={{ gap: 18 }}>
      <Step n={1} done={done1} title={g.hc ? (g.app ? `Get ${app}` : "Get your watch's app") : 'Get Gadgetbridge'}
        sub={g.id === 'other' ? "The app you paired your watch with" : g.hc ? `Sign in and pair ${deviceOf(g).replace('Your', 'your')} in it` : 'Pair your watch in it instead of Huawei Health'}>
        {g.app ? <Button kind={kind(1)} title={`Get ${app}`} icon="download-outline" onPress={() => { tap('get'); openPlay(g.app!.pkg); }} style={s.btn} />
          : !g.hc ? <Button kind={kind(1)} title="Get Gadgetbridge" icon="download-outline" onPress={() => { tap('get'); Linking.openURL(GADGETBRIDGE.url).catch(() => {}); }} style={s.btn} />
            : <Button kind={kind(1)} title="I have it" icon="checkmark" onPress={() => tap('get')} style={s.btn} />}
      </Step>
      <Step n={2} done={done2} title={`Turn on Health Connect in ${g.hc ? (g.app ? app : "your watch's app") : 'Gadgetbridge'}`} sub={g.path}>
        {g.app ? <Button kind={kind(2)} title={`Open ${app}`} icon="open-outline" onPress={() => { tap('open'); openPlay(g.app!.pkg); }} style={s.btn} />
          : <Button kind={kind(2)} title="It's on" icon="checkmark" onPress={() => tap('open')} style={s.btn} />}
        <Tap onPress={() => setEvery(!every)} style={s.link} scale={0.97} accessibilityLabel="Show every tap">
          <T v="small" color={c.blue}>{every ? 'Hide the taps' : 'Show every tap'}</T>
        </Tap>
        {every && (
          <View style={{ gap: 6 }}>
            {(g.hc ? g.steps : GADGETBRIDGE.steps).map((l, i) => <T key={i} v="small" color={c.text}>{i + 1}. {l}</T>)}
            {g.note && <T v="small">{g.note}</T>}
          </View>
        )}
      </Step>
      <Step n={3} done={hcConnected} title={`Allow ${APP_NAME} to read it`} sub="Turn on all, then tap Allow">
        {hcMissing
          ? <Button kind={kind(3)} title={status === 'needs_update' ? 'Update Health Connect' : 'Install Health Connect'} icon="download-outline" onPress={installHc} style={s.btn} />
          : <Button kind={kind(3)} title={hcConnected ? 'Allowed' : 'Allow access'} icon="shield-checkmark-outline" onPress={allow} disabled={!canAllow || hcConnected} style={s.btn} />}
      </Step>
      {hcConnected && (
        <View style={{ gap: 10 }}>
          {checking ? <T v="small">Checking for data…</T>
            : seen ? <Line icon="checkmark-circle" color={c.ok} text={`Data is arriving from ${src}. See what below`} />
              : (
                <>
                  <Line icon="alert-circle-outline" color={c.warm} text={result?.granted === 0 ? 'Access is off. Turn it on in Health Connect, under App permissions' : `Nothing from ${src} yet`} />
                  <T v="small" style={{ paddingLeft: 28 }}>{g.fix}</T>
                  {(result?.sources ?? []).filter((x) => !PHONE_ORIGINS.includes(x.origin)).map((x) => (
                    <Line key={x.origin} icon="checkmark-circle-outline" color={c.ok} text={`${cap(listOf(x.types))} from ${originName(x.origin)}`} />
                  ))}
                </>
              )}
          {!hasHistory && (
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <Ionicons name="time-outline" size={18} color={c.muted} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="small">We read the last 30 days. Want older history too?</T>
                <Tap onPress={async () => { if (await requestHistory()) sync(365).catch(() => {}); }} style={s.link} scale={0.97} accessibilityLabel="Allow older history" disabled={!ANDROID}>
                  <T v="small" color={c.blue}>Allow older history</T>
                </Tap>
              </View>
            </View>
          )}
          {cur === 'done'
            ? <Button title="Done" icon="checkmark" onPress={onClose} />
            : <Button title={checking ? 'Checking…' : 'Check again'} icon="refresh" onPress={runCheck} disabled={!ANDROID || checking} />}
        </View>
      )}
    </View>
  );

  const ringSteps = g?.direct && (
    <View style={{ gap: 18 }}>
      <Step n={1} done={!!ringSaved} title="Charge the ring" sub="Keep it near your phone, off the charger" />
      <Step n={2} done={ringOn} title="Find it on the Smart ring card" sub="We connect over Bluetooth. No other app needed">
        <Button title="Go to ring card" icon="bluetooth" onPress={() => alt('ring')} style={s.btn} />
      </Step>
    </View>
  );

  const guideView = g && (
    <ScrollView ref={guideScroll} style={{ maxHeight: scrollMax }} contentContainerStyle={{ gap: 16, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
      <Tap onPress={() => setStep('pick')} style={s.link} scale={0.97} accessibilityLabel="All brands">
        <View style={s.row}>
          <Ionicons name="chevron-back" size={18} color={c.muted} />
          <T v="small">All brands</T>
        </View>
      </Tap>
      <View style={{ gap: 4 }}>
        <T v="h2">{g.name}</T>
        <T v="small" color={seen || ringOn ? c.ok : c.muted}>{status1}</T>
      </View>
      <View style={s.diagram}>
        {g.direct
          ? <DataPath nodes={directPath({ device: deviceOf(g), deviceIcon: 'ellipse-outline', ok: ringOn })} link="Bluetooth" />
          : <DataPath nodes={hcPath({ device: deviceOf(g), deviceIcon: deviceIcon(g), app, seen, allowed: hcConnected })} />}
        <T v="small">
          {g.direct ? `The ring talks to ${APP_NAME} itself`
            : g.hc ? `${deviceOf(g)} only pairs with ${g.app ? `the ${app} app` : 'its own app'}${src !== app ? ` (the ${src} app's new name)` : ''}. It shares your data with Health Connect, and ${APP_NAME} reads it from there`
              : `Huawei Health doesn't share. Gadgetbridge can take its place`}
        </T>
      </View>
      {androidNote}
      {hcSteps}
      {ringSteps}

      <GetsTable g={g} arrived={g.direct ? [...metricsFrom(['colmi'], daily, []).arrived] : arrived} />

      {g.live && (
        <View style={s.block} onLayout={(e) => { liveY.current = e.nativeEvent.layout.y; }}>
          <T v="h3">Live heart rate in workouts</T>
          <T v="small">The one thing your {g.live.short} can send {APP_NAME} directly, over Bluetooth</T>
          <DataPath nodes={directPath({ device: deviceOf(g), deviceIcon: deviceIcon(g), ok: b.liveNow || !!b.strap })} link="Bluetooth" />
          {b.liveNow && <Line icon="heart" color={c.pink} text={b.bpm ? `${b.bpm} bpm now` : 'Connected'} />}
          {g.live.devices.map((d) => (
            <View key={d.name} style={{ gap: 4 }}>
              <T v="label">{d.name}</T>
              {d.steps.map((l, i) => <T key={i} v="small" color={c.text}>{i + 1}. {l}</T>)}
            </View>
          ))}
          {g.live.note && <T v="small">{g.live.note}</T>}
          {(scanning || ble.found.length > 0 || ble.status === 'no-hr' || ble.status === 'denied' || ble.status === 'off') && (
            <View style={{ gap: 8 }}>
              <T v="small">
                {ble.status === 'off' ? 'Turn on Bluetooth' : ble.status === 'denied' ? 'Allow Nearby devices to find it'
                  : ble.status === 'no-hr' ? `Broadcast is off. ${g.strapHint ?? 'Turn it on on the device'}`
                    : ble.status === 'connecting' ? 'Connecting'
                      : scanning ? (brandFound.length ? 'Tap yours to connect' : `Looking for your ${g.live.short}…`)
                        : listed.length ? 'Tap yours to connect' : `No ${g.live.short} found. Is broadcast on?`}
              </T>
              {listed.slice(0, 8).map((d) => (
                <Tap key={d.id} onPress={() => pickDevice(d)} style={s.device} scale={0.98} accessibilityLabel={d.name}>
                  <Ionicons name="pulse" size={18} color={c.pink} />
                  <T v="body" numberOfLines={1} style={{ flex: 1 }}>{d.name}</T>
                  {b.strap?.id === d.id && <Ionicons name="checkmark-circle" size={18} color={c.ok} />}
                </Tap>
              ))}
              {!showAll && ble.found.length > brandFound.length && (
                <Tap onPress={() => setShowAll(true)} style={s.link} scale={0.97}><T v="small" color={c.blue}>Show all {ble.found.length} devices</T></Tap>
              )}
            </View>
          )}
          {b.strap
            ? <Button kind="ghost" title={`Forget ${b.strap.name}`} icon="close" onPress={() => forgetStrap()} />
            : <Button kind="ghost" title={scanning ? 'Looking…' : `Find my ${g.live.short}`} icon="bluetooth" onPress={find} disabled={!ANDROID || scanning} />}
        </View>
      )}
      {(g.alts ?? []).filter((a) => a !== 'ring' && (g.hc || a !== 'gadgetbridge')).map((a) => <AltBlock key={a} a={a} g={g} onPick={alt} />)}
    </ScrollView>
  );

  return (
    <Sheet open={open} onClose={onClose}>
      {step === 'pick' || !g ? pickView : guideView}
    </Sheet>
  );
}

const IMPORT_LINE: Record<string, string> = {
  fitbit: 'Your Fitbit history as a Google Takeout zip',
  garmin: 'A Garmin export zip or .FIT file',
};

function AltBlock({ a, g, onPick }: { a: Alt; g: Guide; onPick: (a: Alt) => void }) {
  if (a === 'gadgetbridge') {
    return (
      <View style={s.block}>
        <T v="h3">Or use Gadgetbridge</T>
        <T v="small">A free app that pairs with many watches itself, then shares to Health Connect</T>
        <Button kind="ghost" title="Get Gadgetbridge" icon="open-outline" onPress={() => Linking.openURL(GADGETBRIDGE.url).catch(() => {})} />
      </View>
    );
  }
  if (a === 'strap') {
    return (
      <View style={s.block}>
        <T v="h3">Heart-rate strap</T>
        <DataPath nodes={directPath({ device: 'Your strap', ok: false })} link="Bluetooth" />
        <T v="small">{g.strapHint ?? 'Chest straps and watches in broadcast mode connect directly for live heart rate'}</T>
        <Button kind="ghost" title="Pair a strap" icon="pulse" onPress={() => onPick('strap')} disabled={!ANDROID} />
      </View>
    );
  }
  return (
    <View style={s.block}>
      <T v="h3">Or import a file</T>
      <T v="small">{IMPORT_LINE[g.id] ?? 'GPX, TCX, FIT or a Takeout zip'}</T>
      <Button kind="ghost" title="Import a file" icon="download-outline" onPress={() => onPick('import')} />
    </View>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileHalf: { width: '48.5%' },
  tile: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  diagram: { gap: 12, padding: 14, borderRadius: r.md, backgroundColor: c.card2 },
  block: { gap: 12, padding: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.line },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: c.dim, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 48, alignSelf: 'flex-start', paddingHorizontal: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.card2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.blue + '55' },
});
