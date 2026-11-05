import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/calc';
import { connect, disconnect, forgetStrap, READ_TYPES, startScan, stopScan, sync, useBle, type Found } from '../src/health';
import { ColmiCard } from '../src/health/ColmiCard';
import { BrandStatusCard, ConnectWatch } from '../src/health/ConnectWatch';
import { GUIDES, originName, PHONE_ORIGINS, type Alt } from '../src/health/guides';
import { LEVEL_WORD } from '../src/health/readiness';
import { levelColor, useReadiness } from '../src/health/useReadiness';
import { appsLine, commitApps, importFiles, pickFiles, summaryLine } from '../src/health/importFile';
import type { AppPlan } from '../src/importApps';
import { useLiveHr } from '../src/health/live';
import { DoorCard, EASE, goBack, Header, useMiniBarSpace } from '../src/kit';
import { Sheet } from '../src/sheet';
import { c, r } from '../src/theme';
import { latest, useTracker } from '../src/tracker';
import { Button, IconBox, T, Tap } from '../src/ui';

const ANDROID = Platform.OS === 'android';

const ago = (iso?: string) => {
  if (!iso) return 'Not synced yet';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'Synced just now';
  if (m < 60) return `Synced ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `Synced ${h} h ago` : `Synced ${Math.round(h / 24)} d ago`;
};

// Skeleton while syncing: an opacity loop (1.2 s), never a spinner.
function Shimmer({ height, style }: { height: number; style?: object }) {
  const still = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!still) o.value = withRepeat(withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [still]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, borderRadius: r.md, backgroundColor: c.card2 }, a, style]} />;
}

const bars = (rssi: number | null) => (rssi === null ? 0 : rssi > -60 ? 3 : rssi > -75 ? 2 : 1);
function Signal({ rssi }: { rssi: number | null }) {
  const n = bars(rssi);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: 4, height: 6 + i * 4, borderRadius: 1, backgroundColor: i < n ? c.ok : c.dim }} />)}
    </View>
  );
}

// Disconnect asks first whether the workouts we saved to Health Connect stay there or go.
function DisconnectHc({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (remove: boolean) => {
    setBusy(true);
    try { await disconnect(remove); } finally { setBusy(false); setOpen(false); }
  };
  return (
    <>
      <Button kind="danger" title="Disconnect" onPress={() => setOpen(true)} disabled={disabled} style={{ flex: 1, height: 48 }} />
      <Sheet open={open} onClose={() => !busy && setOpen(false)}>
        <View style={{ gap: 12 }}>
          <T v="h2">Disconnect Health Connect</T>
          <T v="small">Keep the workouts we saved there, or remove them</T>
          <Button kind="ghost" title="Keep my workouts" onPress={() => go(false)} disabled={busy} />
          <Button kind="danger" title="Remove them" onPress={() => go(true)} disabled={busy} />
        </View>
      </Sheet>
    </>
  );
}

export default function Watch() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const hc = useTracker((s) => s.hc);
  const daily = useTracker((s) => s.daily);
  const strap = useTracker((s) => s.strap);
  const ble = useBle();
  // Opened from the Body & watch chart: the glance goes back to it instead of pushing another copy.
  const fromChart = useLocalSearchParams<{ from?: string }>().from === 'chart';
  const bpm = useLiveHr();
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowBrand, setFlowBrand] = useState<string | null>(null);
  const openFlow = (brand: string | null = null) => { setFlowBrand(brand); setFlowOpen(true); };
  const rd = useReadiness();
  const [syncing, setSyncing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ line: string; ok: boolean } | null>(null);
  const [appPlan, setAppPlan] = useState<AppPlan[] | null>(null); // a Strong/Hevy/FitNotes CSV waiting for Import

  useEffect(() => { if (!scanOpen) stopScan(); }, [scanOpen]);

  const runSync = async () => {
    setSyncing(true);
    try { await sync(); } finally { setSyncing(false); }
  };
  const pair = () => { setScanOpen(true); startScan(); };
  // From the Connect your watch flow: its sheet closes first (240 ms), then the next sheet opens, never two at once.
  const scroll = useRef<ScrollView>(null);
  const ringY = useRef(0);
  const onAlt = (a: Alt) => {
    if (a === 'strap') setTimeout(pair, 300);
    else if (a === 'import') setTimeout(() => setImportOpen(true), 300);
    else if (a === 'ring') setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, ringY.current - 16), animated: !still }), 300);
  };
  const chooseFile = async () => {
    const assets = await pickFiles().catch(() => null);
    if (!assets) return;
    setImporting(true);
    setImported(null);
    setAppPlan(null);
    try {
      const res = await importFiles(assets);
      if (res.apps?.length) setAppPlan(res.apps);
      if (!res.apps?.length || res.workouts + res.days > 0) setImported({ line: summaryLine(res), ok: res.workouts + res.days > 0 });
    } catch {
      setImported({ line: 'Could not read that file', ok: false });
    } finally {
      setImporting(false);
    }
  };
  const pick = (d: Found) => {
    setScanOpen(false);
    connect(d.id, d.name);
  };

  const today = daily[dayKey()];
  // The watch apps that shared data in the last 7 days, by name: "From Google Health".
  const fromPkgs = useMemo(() => {
    const since = dayKey(new Date(Date.now() - 6 * 86400000));
    return new Set(Object.values(daily).filter((d) => d.date >= since).flatMap((d) => d.origin ?? []));
  }, [daily]);
  const from = [...fromPkgs].filter((x) => !PHONE_ORIGINS.includes(x)).map(originName);
  const on = READ_TYPES.filter((t) => hc.granted.includes(t.type)).map((t) => t.label);
  // One glance at today's numbers; their home is Progress › Body & watch (opened with from=watch so it links back here).
  const sleep = latest(daily, 'sleep', 1);
  const glance = [
    today?.steps !== undefined ? `${today.steps.toLocaleString()} steps` : null,
    sleep ? `Sleep ${Math.floor(sleep.minutes / 60)}h ${sleep.minutes % 60}m` : null,
    latest(daily, 'restingHr', 1) !== undefined ? `${Math.round(latest(daily, 'restingHr', 1)!)} bpm` : null,
  ].filter(Boolean).join(' · ');

  const strapLine =
    ble.status === 'connected' ? (bpm ? 'Live now' : 'Connected · waiting for a beat')
      : ble.status === 'connecting' ? 'Connecting'
        : ble.status === 'no-hr' ? 'No heart rate. Its broadcast mode is probably off'
          : ble.status === 'off' ? 'Turn on Bluetooth'
            : ble.status === 'denied' ? 'Allow Nearby devices to pair'
              : strap ? `${strap.name} · reconnects on its own` : 'Live heart rate in workouts';

  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Watch & health" />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 40 + mini, gap: 12 }} showsVerticalScrollIndicator={false}>
        {!ANDROID && (
          <View style={[s.note, { borderColor: c.blue + '55' }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={c.blue} />
            <T v="body" style={{ flex: 1 }}>Connect on your Android phone</T>
          </View>
        )}

        {/* Your watch: one primary button opens the guided Connect your watch sheet (brand, steps, check) */}
        <Animated.View entering={enter(0)} style={s.card}>
          <View style={s.row}>
            <IconBox icon="watch-outline" color={c.blue} />
            <View style={{ flex: 1 }}>
              <T v="h3">Your watch</T>
              <T v="small" numberOfLines={2}>
                {hc.connected ? (from.length ? `From ${from.join(', ')}` : 'Health Connect on') : 'Fitbit, Pixel, Samsung, Garmin, WHOOP, Oura and more'}
              </T>
            </View>
            {hc.connected && <Ionicons name="checkmark-circle" size={22} color={c.ok} />}
          </View>

          {syncing ? (
            <View style={{ gap: 8 }}>
              <Shimmer height={18} style={{ width: '60%' }} />
              <Shimmer height={18} style={{ width: '85%' }} />
            </View>
          ) : hc.connected ? (
            <View style={{ gap: 4 }}>
              <T v="small" color={c.text}>{ago(hc.lastSync)}</T>
              <T v="small" numberOfLines={3}>{on.length ? on.join(' · ') : 'No data types on'}</T>
            </View>
          ) : (
            <T v="small">Steps, sleep and heart rate through Health Connect · no Bluetooth pairing</T>
          )}

          {hc.connected ? (
            <>
              <View style={s.row}>
                <Button kind="ghost" title="Sync now" icon="refresh" onPress={runSync} disabled={syncing} style={{ flex: 1, height: 48 }} />
                <DisconnectHc disabled={syncing} />
              </View>
              <Tap onPress={() => openFlow()} style={{ alignSelf: 'flex-start', paddingVertical: 4 }} scale={0.97} accessibilityLabel="Check or add a watch">
                <T v="small" color={c.blue}>Check or add a watch</T>
              </Tap>
            </>
          ) : (
            <>
              <Button title="Connect your watch" icon="watch-outline" onPress={() => openFlow()} />
              {/* Straight to the two most asked-for watches */}
              <View style={s.row}>
                {LIVE_GUIDES.map((g) => (
                  <Tap key={g.id} onPress={() => openFlow(g.id)} style={[s.pill, { flex: 1 }]} scale={0.97} accessibilityLabel={`Connect ${g.name}`}>
                    <T v="small" color={c.text} numberOfLines={1}>{g.id === 'fitbit' ? 'Fitbit or Pixel' : g.name}</T>
                  </Tap>
                ))}
              </View>
            </>
          )}
        </Animated.View>

        {/* Fitbit and WHOOP: daily data and live heart rate, each with its own status (shown once either is in use) */}
        {LIVE_GUIDES.filter((g) => g.packages.some((p) => fromPkgs.has(p)) || (strap && g.live!.match.test(strap.name))).map((g, i) => (
          <Animated.View key={g.id} entering={enter(1 + i)} style={s.card}>
            <BrandStatusCard g={g} compact onPress={() => openFlow(g.id)} />
          </Animated.View>
        ))}

        {/* Readiness: one glance that opens its home, the Recovery screen */}
        {hc.connected && (
          <Animated.View entering={enter(1)}>
            <DoorCard icon="battery-charging-outline" color={levelColor(rd.level)} title="Recovery"
              meta={rd.score !== null && rd.level ? `Readiness ${rd.score} · ${LEVEL_WORD[rd.level]}` : 'Learning your baseline'}
              onPress={() => router.push('/recovery')} />
          </Animated.View>
        )}

        {/* Today's numbers: one glance that opens their home, Progress › Body & watch */}
        {hc.connected && (syncing ? <Shimmer height={72} /> : (
          <Animated.View entering={enter(1)}>
            <DoorCard icon="stats-chart" color={c.blue} title="Today's numbers" meta={glance || 'Waiting for the next sync'}
              onPress={() => (fromChart ? goBack() : router.push({ pathname: '/chart/[kind]', params: { kind: 'body', from: 'watch' } }))} />
          </Animated.View>
        ))}

        <Animated.View entering={enter(2)} style={{ paddingHorizontal: 4, paddingTop: 12 }}>
          <T v="label">More ways</T>
        </Animated.View>

        {/* Heart-rate strap */}
        <Animated.View entering={enter(3)} style={s.card}>
          <View style={s.row}>
            <IconBox icon="pulse" color={c.pink} />
            <View style={{ flex: 1 }}>
              <T v="h3">Heart-rate strap</T>
              <T v="small" numberOfLines={2} color={ble.status === 'no-hr' ? c.warm : undefined}>{strapLine}</T>
            </View>
            {ble.status === 'connected' && bpm !== null ? (
              <View style={s.bpm}>
                <Ionicons name="heart" size={16} color={c.pink} />
                <T v="num" style={{ fontSize: 26 }}>{bpm}</T>
              </View>
            ) : (
              <Tap onPress={strap ? () => forgetStrap() : pair} disabled={!ANDROID} style={[s.pill, !ANDROID && { opacity: 0.5 }]} scale={0.95}>
                <T v="small" color={c.text}>{strap ? 'Forget' : 'Pair'}</T>
              </Tap>
            )}
          </View>
          {ble.status === 'connected' && bpm !== null && (
            <Tap onPress={() => forgetStrap()} style={[s.pill, { alignSelf: 'flex-start' }]} scale={0.95}>
              <T v="small" color={c.text}>Forget</T>
            </Tap>
          )}
        </Animated.View>

        <Animated.View entering={enter(4)} style={{ gap: 6, paddingHorizontal: 4 }}>
          <T v="small">Chest straps, plus WHOOP, Fitbit Charge 6, Pixel Watch 2+, Garmin, Polar and Huawei in heart-rate broadcast mode</T>
          <T v="small">Older Fitbits and Samsung watches don't pair here. Use Connect your watch</T>
          <T v="small">Connects but no heart rate? Its broadcast mode is probably off</T>
        </Animated.View>

        {/* Colmi smart ring (R02/R06/R10): steps, heart-rate log, battery, live HR in workouts */}
        <Animated.View entering={enter(5)} onLayout={(e) => { ringY.current = e.nativeEvent.layout.y; }}><ColmiCard /></Animated.View>

        {/* Import history from a file: works on every platform, web included */}
        <Animated.View entering={enter(6)}>
          <Tap onPress={() => setImportOpen(true)} style={[s.card, s.row]} scale={0.98} accessibilityLabel="Import from a file">
            <IconBox icon="download-outline" color={c.blue} />
            <View style={{ flex: 1 }}>
              <T v="h3">Import from a file</T>
              <T v="small" numberOfLines={1}>Garmin, Fitbit, GPX, Strong, Hevy, FitNotes</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.dim} />
          </Tap>
        </Animated.View>

        {/* Gadgetbridge (and NOOP, OpenStrap, openScale): their Health Connect switches */}
        <Animated.View entering={enter(6)} style={[s.note, { borderColor: c.line, alignItems: 'flex-start' }]}>
          <Ionicons name="information-circle-outline" size={18} color={c.muted} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="small" color={c.text}>Gadgetbridge: turn on all three</T>
            <T v="small">1. Health Connect export on, in its settings</T>
            <T v="small">2. Your watch ticked under Select devices</T>
            <T v="small">3. Sync after device sync</T>
            <T v="small">Data shows up about 10 s after the watch syncs</T>
            <T v="small">NOOP, OpenStrap, openScale: turn on Health Connect sync</T>
          </View>
        </Animated.View>
      </ScrollView>

      <ConnectWatch open={flowOpen} brand={flowBrand} onClose={() => setFlowOpen(false)} onAlt={onAlt} />

      <Sheet open={scanOpen} onClose={() => setScanOpen(false)}>
        <View style={{ gap: 12 }}>
          <T v="h2">Pair a strap</T>
          <T v="small">
            {ble.status === 'scanning' ? 'Looking for heart-rate sensors' : ble.status === 'off' ? 'Turn on Bluetooth' : ble.status === 'denied' ? 'Allow Nearby devices to pair' : ble.found.length ? 'Tap one to connect' : 'Nothing found. Wake the strap and try again'}
          </T>
          {ble.status === 'scanning' && ble.found.length === 0 && <View style={{ gap: 8 }}>{[0, 1].map((i) => <Shimmer key={i} height={56} />)}</View>}
          {ble.found.slice(0, 12).map((d) => (
            <Tap key={d.id} onPress={() => pick(d)} style={s.device} scale={0.98}>
              <IconBox icon="pulse" color={c.pink} size={36} />
              <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{d.name}</T>
              <Signal rssi={d.rssi} />
            </Tap>
          ))}
          {ble.status !== 'scanning' && ble.found.length === 0 && <T v="small">Only straps and watches in broadcast mode show here</T>}
          {ble.status !== 'scanning' && <Button kind="ghost" title="Scan again" icon="refresh" onPress={() => startScan()} />}
        </View>
      </Sheet>

      <Sheet open={importOpen} onClose={() => { setImportOpen(false); setAppPlan(null); }}>
        <View style={{ gap: 12 }}>
          <T v="h2">Import from a file</T>
          {FORMATS.map((f) => (
            <View key={f.label} style={s.row}>
              <Ionicons name={f.icon} size={18} color={c.muted} />
              <T v="small" numberOfLines={1} style={{ flex: 1 }}>{f.label}</T>
            </View>
          ))}
          {importing ? <Shimmer height={18} style={{ width: '60%' }} /> : imported ? (
            <View style={s.row}>
              <Ionicons name={imported.ok ? 'checkmark-circle' : 'information-circle-outline'} size={18} color={imported.ok ? c.ok : c.warm} />
              <T v="body" style={{ flex: 1 }}>{imported.line}</T>
            </View>
          ) : null}
          {appPlan ? (
            <>
              <View style={s.row}>
                <Ionicons name="barbell-outline" size={18} color={c.blue} />
                <T v="body" style={{ flex: 1 }}>{appsLine(appPlan)}</T>
              </View>
              {appPlan.some((a) => a.unknown.length) && (
                <T v="small" numberOfLines={2}>Skipped: {[...new Set(appPlan.flatMap((a) => a.unknown))].slice(0, 4).join(', ')}{new Set(appPlan.flatMap((a) => a.unknown)).size > 4 ? '…' : ''}</T>
              )}
              <Button title="Import" icon="checkmark" disabled={!appPlan.some((a) => a.sessions.length)}
                onPress={() => { setImported({ line: commitApps(appPlan), ok: true }); setAppPlan(null); }} />
              <Button title="Cancel" kind="ghost" onPress={() => setAppPlan(null)} />
            </>
          ) : (
            <Button title="Choose file" icon="document-outline" onPress={chooseFile} disabled={importing} />
          )}
        </View>
      </Sheet>
    </View>
  );
}

const LIVE_GUIDES = GUIDES.filter((g) => g.live);

const FORMATS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'watch-outline', label: 'Garmin .FIT file or Garmin export zip' },
  { icon: 'archive-outline', label: 'Fitbit Google Takeout zip' },
  { icon: 'map-outline', label: 'GPX or TCX from Gadgetbridge, OpenTracks and others' },
  { icon: 'barbell-outline', label: 'Strong, Hevy or FitNotes CSV export' },
];

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1 },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  bpm: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.card2 },
});
