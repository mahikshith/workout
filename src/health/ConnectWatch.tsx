// "Connect your watch": one sheet, three steps. Pick the brand, follow its numbered steps (in the brand's app, then
// Allow access here), then a check that reads what actually arrived in Health Connect and names the app it came from.
// Brand data lives in ./guides.ts. Android only for the actions; on web and iOS the steps still show, with a note.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { EASE } from '../kit';
import { Sheet } from '../sheet';
import { c, r } from '../theme';
import { useTracker } from '../tracker';
import { Button, T, Tap } from '../ui';
import { connect, forgetStrap, startScan, stopScan, useBle } from './ble';
import { brandStatus } from './brandStatus';
import { GADGETBRIDGE, GUIDES, METRIC_LABEL, originName, PHONE_ORIGINS, playUrl, playWeb, type Alt, type Guide } from './guides';
import { checkData, HC_PLAY_URL, HC_PLAY_WEB, isAvailable, openHcSettings, requestPermissions, sync, type DataCheck, type HcStatus } from './healthConnect';
import { useLiveHr } from './live';

const ANDROID = Platform.OS === 'android';

const openPlay = (pkg: string) => {
  if (!ANDROID) return Linking.openURL(playWeb(pkg)).catch(() => {});
  return Linking.openURL(playUrl(pkg)).catch(() => Linking.openURL(playWeb(pkg)).catch(() => {}));
};
const installHc = () => (ANDROID ? Linking.openURL(HC_PLAY_URL).catch(() => Linking.openURL(HC_PLAY_WEB)) : Linking.openURL(HC_PLAY_WEB)).catch(() => {});

// 'steps', 'sleep', 'heart rate' -> 'Steps, sleep and heart rate'
const andList = (xs: string[]) => {
  const s = xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};

function Pulse({ height, width }: { height: number; width: `${number}%` }) {
  const still = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!still) o.value = withRepeat(withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [still]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: r.md, backgroundColor: c.card2 }, a]} />;
}

function Steps({ lines, start = 1 }: { lines: string[]; start?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {lines.map((l, i) => (
        <View key={i} style={s.stepRow}>
          <View style={s.num}><T v="small" color={c.text}>{start + i}</T></View>
          <T v="body" style={{ flex: 1 }}>{l}</T>
        </View>
      ))}
    </View>
  );
}

function Line({ icon, color, text, sub }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string; sub?: boolean }) {
  return (
    <View style={[s.stepRow, { alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginTop: 1 }} />
      <T v={sub ? 'small' : 'body'} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const ago = (iso?: string) => {
  if (!iso) return 'not synced yet';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'synced just now' : m < 60 ? `synced ${m} min ago` : m < 1440 ? `synced ${Math.round(m / 60)} h ago` : `synced ${Math.round(m / 1440)} d ago`;
};

// One brand's state: daily data through Health Connect (what came in, what's missing and its fix) and live heart rate
// over Bluetooth (saved, streaming now, or not set up).
export function useBrand(g: Guide | null) {
  const daily = useTracker((x) => x.daily);
  const workouts = useTracker((x) => x.workouts);
  const merged = useTracker((x) => x.merged);
  const hc = useTracker((x) => x.hc);
  const strap = useTracker((x) => x.strap);
  const ble = useBle();
  const bpm = useLiveHr();
  const st = useMemo(() => (g ? brandStatus(g, daily, workouts, merged) : null), [g, daily, workouts, merged]);
  const saved = !!(g?.live && strap && g.live.match.test(strap.name));
  const liveNow = saved && ble.status === 'connected' && ble.deviceId === strap!.id;
  return { st, hc, strap: saved ? strap : null, liveNow, bpm: liveNow ? bpm : null };
}

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// The status block at the top of a brand's page (and, compact, on the Watch screen).
export function BrandStatusCard({ g, compact, onPress }: { g: Guide; compact?: boolean; onPress?: () => void }) {
  const b = useBrand(g);
  const arrived = b.st?.arrived ?? [];
  const missing = b.st?.missing ?? [];
  const daily = !b.hc.connected ? { icon: 'ellipse-outline' as const, color: c.dim, text: 'Daily data: not connected' }
    : arrived.length ? { icon: 'checkmark-circle' as const, color: c.ok, text: `Daily data: connected, ${ago(b.hc.lastSync)}` }
      : { icon: 'alert-circle-outline' as const, color: c.warm, text: `Daily data: nothing from ${g.app?.name ?? g.name} yet` };
  const live = !g.live ? null
    : b.liveNow ? { icon: 'heart' as const, color: c.pink, text: b.bpm ? `Live heart rate: ${b.bpm} bpm now` : 'Live heart rate: connected' }
      : b.strap ? { icon: 'checkmark-circle-outline' as const, color: c.ok, text: `Live heart rate: ${b.strap.name}, reconnects in workouts` }
        : { icon: 'ellipse-outline' as const, color: c.dim, text: 'Live heart rate: not set up' };
  const body = (
    <View style={[s.status, compact && { padding: 0, borderWidth: 0, backgroundColor: 'transparent' }]}>
      {compact && <T v="h3">{g.name}</T>}
      <Line icon={daily.icon} color={daily.color} text={daily.text} sub />
      {b.hc.connected && arrived.length > 0 && <T v="small" style={s.indent}>Got {listOf(arrived.map((m) => METRIC_LABEL[m]))}</T>}
      {b.hc.connected && !compact && missing.slice(0, 2).map((m) => (
        <T key={m} v="small" style={s.indent}>No {METRIC_LABEL[m]} yet · {g.missing?.[m] ?? g.fix}</T>
      ))}
      {b.hc.connected && compact && missing.length > 0 && <T v="small" style={s.indent}>No {listOf(missing.map((m) => METRIC_LABEL[m]))} yet</T>}
      {!compact && g.info && <T v="small" style={s.indent}>{g.info}</T>}
      {live && <Line icon={live.icon} color={live.color} text={live.text} sub />}
    </View>
  );
  return onPress ? <Tap onPress={onPress} scale={0.98} accessibilityLabel={`${g.name} status`}>{body}</Tap> : body;
}

const IMPORT_LINE: Record<string, string> = {
  fitbit: 'Your Fitbit data as a Google Takeout zip',
  garmin: 'A Garmin export zip or .FIT file',
};

export function ConnectWatch({ open, onClose, onAlt, brand }: { open: boolean; onClose: () => void; onAlt: (a: Alt) => void; brand?: string | null }) {
  const still = useReducedMotion();
  const { height } = useWindowDimensions();
  const daily = useTracker((x) => x.daily);
  const [step, setStep] = useState<'pick' | 'guide' | 'check'>('pick');
  const [id, setId] = useState<string | null>(null);
  const [status, setStatus] = useState<HcStatus | 'checking'>(ANDROID ? 'checking' : 'unavailable');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<DataCheck | null | undefined>(undefined);
  const g = GUIDES.find((x) => x.id === id) ?? null;

  useEffect(() => {
    if (!open) { stopScan(); setScanning(false); return; }
    const start = brand ? GUIDES.find((x) => x.id === brand) : undefined;
    if (start) setId(start.id);
    setStep(start ? 'guide' : 'pick');
    setResult(undefined);
    setShowAll(false);
    setShowDaily(false);
    if (ANDROID) isAvailable().then(setStatus);
  }, [open, brand]);

  // Live heart rate: a scan in this sheet that lists the chosen brand's devices first.
  const ble = useBle();
  const b = useBrand(g);
  const [scanning, setScanning] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
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
  const dailyDone = !!(g?.live && b.hc.connected && b.st?.arrived.length);
  const brandFound = g?.live ? ble.found.filter((d) => g.live!.match.test(d.name)) : [];
  const listed = showAll || !g?.live ? ble.found : brandFound;

  // Apps that already shared something (from earlier syncs): their brand tile gets a tick.
  const seen = useMemo(() => new Set(Object.values(daily).flatMap((d) => d.origin ?? [])), [daily]);

  const pick = (x: Guide) => { setId(x.id); setStep('guide'); };
  const runCheck = async () => {
    setStep('check');
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
    const granted = await requestPermissions().catch(() => [] as string[]);
    if (granted.some((k) => !k.startsWith('write:'))) runCheck();
    else { setStep('check'); setResult({ granted: 0, sources: [] }); }
  };
  const alt = (a: Alt) => { onClose(); onAlt(a); };

  const hcMissing = status === 'not_installed' || status === 'needs_update';
  const canAllow = ANDROID && status === 'available';
  const scrollMax = Math.max(280, height * 0.6);
  const enter = (i: number) => (still ? undefined : FadeIn.delay(Math.min(i, 6) * 50).duration(300).easing(EASE));

  const androidNote = !ANDROID && (
    <View style={s.note}>
      <Ionicons name="phone-portrait-outline" size={18} color={c.blue} />
      <T v="small" color={c.text} style={{ flex: 1 }}>This needs the Android app</T>
    </View>
  );

  // --- Step 1: pick the brand
  const pickView = (
    <View style={{ gap: 12 }}>
      <T v="h2">Connect your watch</T>
      <T v="small">No Bluetooth pairing. Your watch's own app shares its data through Health Connect</T>
      {androidNote}
      <ScrollView style={{ maxHeight: scrollMax }} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {/* Fitbit and WHOOP first and full width: daily data plus live heart rate in workouts */}
        {GUIDES.filter((x) => x.live).map((x, i) => (
          <Animated.View key={x.id} entering={enter(i)} style={s.tileWide}>
            <Tap onPress={() => pick(x)} style={[s.tile, { minHeight: 72 }]} scale={0.97} accessibilityLabel={x.name}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>{x.name}</T>
                <T v="small" numberOfLines={1}>Daily data and live heart rate</T>
              </View>
              {x.packages.some((p) => seen.has(p)) && <Ionicons name="checkmark-circle" size={18} color={c.ok} />}
              <Ionicons name="chevron-forward" size={18} color={c.dim} />
            </Tap>
          </Animated.View>
        ))}
        {GUIDES.filter((x) => !x.live).map((x, j) => {
          const i = j + 2;
          const on = x.packages.some((p) => seen.has(p));
          return (
            <Animated.View key={x.id} entering={enter(i)} style={x.id === 'other' ? s.tileWide : s.tileHalf}>
              <Tap onPress={() => pick(x)} style={s.tile} scale={0.97} accessibilityLabel={x.name}>
                <T v="h3" numberOfLines={2} style={{ flex: 1 }}>{x.name}</T>
                {on && <Ionicons name="checkmark-circle" size={18} color={c.ok} />}
              </Tap>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );

  // --- Step 2: the brand's steps, then ours
  const guideView = g && (
    <View style={{ gap: 12 }}>
      <Tap onPress={() => setStep('pick')} style={s.back} scale={0.97} accessibilityLabel="All brands">
        <Ionicons name="chevron-back" size={18} color={c.muted} />
        <T v="small">All brands</T>
      </Tap>
      <T v="h2">{g.name}</T>
      {androidNote}
      <ScrollView ref={guideScroll} style={{ maxHeight: scrollMax }} contentContainerStyle={{ gap: 14, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {g.live && <BrandStatusCard g={g} />}
        {g.live && <T v="h3">1. Daily data</T>}
        {dailyDone && !showDaily && (
          <Tap onPress={() => setShowDaily(true)} style={s.back} scale={0.97} accessibilityLabel="Show the daily data steps">
            <T v="small" color={c.blue}>Done. Show the steps again</T>
          </Tap>
        )}
        {(!dailyDone || showDaily) && g.note && <Line icon="information-circle-outline" color={c.blue} text={g.note} sub />}
        {(!dailyDone || showDaily) && g.hc && g.steps.length > 0 && (
          <Animated.View entering={still ? undefined : FadeInDown.duration(380).easing(EASE)} style={s.block}>
            <T v="label">{g.app ? `In ${g.app.name}` : 'In your watch app'}</T>
            <Steps lines={g.steps} />
            {g.app && <Button kind="ghost" title={`Open ${g.app.name}`} icon="open-outline" onPress={() => openPlay(g.app!.pkg)} />}
          </Animated.View>
        )}
        {/* No Health Connect in the brand's app: Gadgetbridge comes first, then our steps. */}
        {!g.hc && g.alts?.includes('gadgetbridge') && <AltBlock a="gadgetbridge" g={g} onPick={alt} />}
        {g.id !== 'colmi' && (!dailyDone || showDaily) && (
          <View style={s.block}>
            <T v="label">Then here</T>
            <Steps lines={['Tap Allow access below', 'Turn on all, then tap Allow', 'We check what arrived']} />
            {hcMissing
              ? <Button kind="ghost" title={status === 'needs_update' ? 'Update Health Connect' : 'Install Health Connect'} icon="download-outline" onPress={installHc} />
              : <Button kind="ghost" title="Open Health Connect" icon="settings-outline" onPress={() => { if (!openHcSettings()) installHc(); }} disabled={!ANDROID} />}
          </View>
        )}
        {g.live && (
          <View style={{ gap: 14 }} onLayout={(e) => { liveY.current = e.nativeEvent.layout.y; }}>
            <T v="h3">2. Live heart rate in workouts</T>
            {g.live.devices.map((d) => (
              <View key={d.name} style={s.block}>
                <T v="label">{d.name}</T>
                <Steps lines={d.steps} />
              </View>
            ))}
            {g.live.note && <Line icon="information-circle-outline" color={c.blue} text={g.live.note} sub />}
            {(scanning || ble.found.length > 0 || ble.status === 'no-hr' || ble.status === 'denied' || ble.status === 'off') && (
              <View style={s.block}>
                <T v="label">Nearby</T>
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
                  <Tap onPress={() => setShowAll(true)} style={s.back} scale={0.97}><T v="small" color={c.blue}>Show all {ble.found.length} devices</T></Tap>
                )}
              </View>
            )}
            {b.strap && (
              <Tap onPress={() => forgetStrap()} style={s.back} scale={0.97} accessibilityLabel="Forget this device">
                <T v="small" color={c.blue}>Forget {b.strap.name}</T>
              </Tap>
            )}
          </View>
        )}
        {(g.alts ?? []).filter((a) => g.hc || a !== 'gadgetbridge').map((a) => <AltBlock key={a} a={a} g={g} onPick={alt} />)}
      </ScrollView>
      {g.id === 'colmi'
        ? <Button title="Go to ring card" onPress={() => alt('ring')} />
        : g.live && b.hc.connected && !b.strap
          ? <Button title={scanning ? 'Looking…' : `Find my ${g.live.short}`} icon="bluetooth" onPress={find} disabled={!ANDROID || scanning} />
          : g.live && b.hc.connected
            ? <Button title="Check data" icon="refresh" onPress={runCheck} disabled={!ANDROID} />
            : <Button title="Allow access" icon="shield-checkmark-outline" onPress={allow} disabled={!canAllow} />}
    </View>
  );

  // --- Step 3: what arrived
  const watchSources = (result?.sources ?? []).filter((x) => !PHONE_ORIGINS.includes(x.origin));
  const phoneSources = (result?.sources ?? []).filter((x) => PHONE_ORIGINS.includes(x.origin));
  const mine = g ? watchSources.filter((x) => (g.id === 'other' ? true : g.packages.includes(x.origin))) : watchSources;
  const others = watchSources.filter((x) => !mine.includes(x));
  const appName = g?.app?.name ?? (g?.id === 'huawei' || g?.id === 'colmi' ? 'Gadgetbridge' : 'your watch');
  const checkView = (
    <View style={{ gap: 14 }}>
      <Tap onPress={() => setStep(g ? 'guide' : 'pick')} style={s.back} scale={0.97} accessibilityLabel="Back to steps">
        <Ionicons name="chevron-back" size={18} color={c.muted} />
        <T v="small">Steps</T>
      </Tap>
      <T v="h2">{checking ? 'Checking for data…' : mine.length ? 'Connected' : 'Not there yet'}</T>
      {checking || result === undefined ? (
        <View style={{ gap: 10 }}>
          <Pulse height={20} width="70%" />
          <Pulse height={20} width="50%" />
        </View>
      ) : result === null ? (
        <>
          <Line icon="alert-circle-outline" color={c.warm} text="Couldn't reach Health Connect" />
          <Button kind="ghost" title="Install Health Connect" icon="download-outline" onPress={installHc} />
        </>
      ) : result.granted === 0 ? (
        <>
          <Line icon="alert-circle-outline" color={c.warm} text="Access is off" />
          <Line icon="arrow-forward-circle-outline" color={c.muted} text="Tap Allow access, turn on all, then Allow" sub />
          <Line icon="arrow-forward-circle-outline" color={c.muted} text="No pop-up? Turn it on in Health Connect, under App permissions" sub />
          <Button kind="ghost" title="Open Health Connect" icon="settings-outline" onPress={() => { if (!openHcSettings()) installHc(); }} disabled={!ANDROID} />
          <Button title="Allow access" icon="shield-checkmark-outline" onPress={allow} disabled={!canAllow} />
        </>
      ) : (
        <>
          {mine.map((x) => <Line key={x.origin} icon="checkmark-circle" color={c.ok} text={`${andList(x.types)} from ${originName(x.origin)} found`} />)}
          {others.map((x) => <Line key={x.origin} icon="checkmark-circle-outline" color={c.ok} text={`${andList(x.types)} from ${originName(x.origin)}`} sub />)}
          {phoneSources.map((x) => <Line key={x.origin} icon="phone-portrait-outline" color={c.muted} text={`${andList(x.types)} from ${originName(x.origin)}`} sub />)}
          {!mine.length && (
            <>
              <Line icon="alert-circle-outline" color={c.warm} text={`Nothing from ${appName} yet`} />
              <Line icon="arrow-forward-circle-outline" color={c.muted} text={g?.fix ?? 'Open your watch app once so it syncs, then try again'} sub />
              {g?.app && <Button kind="ghost" title={`Open ${g.app.name}`} icon="open-outline" onPress={() => openPlay(g.app!.pkg)} />}
              <Button kind="ghost" title="Open Health Connect" icon="settings-outline" onPress={() => { if (!openHcSettings()) installHc(); }} disabled={!ANDROID} />
            </>
          )}
          {mine.length > 0
            ? <Button title="Done" icon="checkmark" onPress={onClose} />
            : <Button title="Check again" icon="refresh" onPress={runCheck} />}
        </>
      )}
    </View>
  );

  return (
    <Sheet open={open} onClose={onClose}>
      {step === 'pick' ? pickView : step === 'guide' ? guideView : checkView}
    </Sheet>
  );
}

function AltBlock({ a, g, onPick }: { a: Alt; g: Guide; onPick: (a: Alt) => void }) {
  if (a === 'gadgetbridge') {
    return (
      <View style={s.block}>
        <T v="label">{g.hc ? 'Or use Gadgetbridge' : 'Use Gadgetbridge'}</T>
        <Steps lines={GADGETBRIDGE.steps} />
        <Button kind="ghost" title="Get Gadgetbridge" icon="open-outline" onPress={() => Linking.openURL(GADGETBRIDGE.url).catch(() => {})} />
      </View>
    );
  }
  if (a === 'strap') {
    return (
      <View style={s.block}>
        <T v="label">Live heart rate in workouts</T>
        <Steps lines={[g.strapHint ?? 'Turn on its heart-rate broadcast', 'Tap Pair a strap, then pick it']} />
        <Button kind="ghost" title="Pair a strap" icon="pulse" onPress={() => onPick('strap')} disabled={!ANDROID} />
      </View>
    );
  }
  if (a === 'ring') {
    return (
      <View style={s.block}>
        <T v="label">Smart ring</T>
        <Steps lines={['Charge the ring and keep it close', 'Tap Find ring on the Smart ring card']} />
      </View>
    );
  }
  return (
    <View style={s.block}>
      <T v="label">Or import a file</T>
      <T v="body">{IMPORT_LINE[g.id] ?? 'GPX, TCX, FIT or a Takeout zip'}</T>
      <Button kind="ghost" title="Import a file" icon="download-outline" onPress={() => onPick('import')} />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 4 },
  tileHalf: { width: '48.5%' },
  tileWide: { width: '100%' },
  tile: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  block: { gap: 12, padding: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.line },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: c.dim, alignItems: 'center', justifyContent: 'center' },
  status: { gap: 8, padding: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.card2 },
  indent: { paddingLeft: 32 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.card2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.blue + '55' },
});
