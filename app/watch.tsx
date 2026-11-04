import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/calc';
import {
  connect, disconnect, forgetStrap, HC_PLAY_URL, HC_PLAY_WEB, isAvailable, READ_TYPES, requestPermissions, startScan, stopScan, sync,
  useBle, type Found, type HcStatus,
} from '../src/health';
import { useLiveHr } from '../src/health/live';
import { EASE, Header } from '../src/kit';
import { Sheet } from '../src/sheet';
import { c, r } from '../src/theme';
import { latest, sleepScore, useTracker } from '../src/tracker';
import { Button, IconBox, T, Tap, Tile } from '../src/ui';

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

export default function Watch() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const hc = useTracker((s) => s.hc);
  const daily = useTracker((s) => s.daily);
  const strap = useTracker((s) => s.strap);
  const ble = useBle();
  const bpm = useLiveHr();
  const [status, setStatus] = useState<HcStatus | 'checking'>(ANDROID ? 'checking' : 'unavailable');
  const [syncing, setSyncing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => { if (ANDROID) isAvailable().then(setStatus); }, []);
  useEffect(() => { if (!scanOpen) stopScan(); }, [scanOpen]);

  const runSync = async () => {
    setSyncing(true);
    try { await sync(); } finally { setSyncing(false); }
  };
  const connectHc = async () => {
    const granted = await requestPermissions().catch(() => [] as string[]);
    if (granted.some((g) => !g.startsWith('write:'))) await runSync();
  };
  const install = () => Linking.openURL(HC_PLAY_URL).catch(() => Linking.openURL(HC_PLAY_WEB));
  const pair = () => { setScanOpen(true); startScan(); };
  const pick = (d: Found) => {
    setScanOpen(false);
    connect(d.id, d.name);
  };

  const today = daily[dayKey()];
  const on = READ_TYPES.filter((t) => hc.granted.includes(t.type)).map((t) => t.label);
  const sleep = latest(daily, 'sleep', 1);
  const tiles = [
    { icon: 'footsteps', color: c.accent, value: today?.steps?.toLocaleString(), label: 'Steps' },
    { icon: 'moon', color: c.blue, value: sleep ? `${Math.floor(sleep.minutes / 60)}h ${sleep.minutes % 60}m` : undefined, label: sleepScore(sleep) ? `Sleep · ${sleepScore(sleep)}` : 'Sleep' },
    { icon: 'heart', color: c.pink, value: latest(daily, 'restingHr', 1), unit: 'bpm', label: 'Resting HR' },
    { icon: 'pulse', color: c.warm, value: latest(daily, 'hrvMs', 1), unit: 'ms', label: 'HRV' },
    { icon: 'water', color: c.blue, value: latest(daily, 'spo2Pct', 1), unit: '%', label: 'SpO2' },
    { icon: 'flame', color: c.warm, value: today?.activeKcal, unit: 'kcal', label: 'Active' },
  ] as const;
  const shown = tiles.filter((t) => t.value !== undefined);

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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: ins.bottom + 40, gap: 12 }} showsVerticalScrollIndicator={false}>
        {!ANDROID && (
          <View style={[s.note, { borderColor: c.blue + '55' }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={c.blue} />
            <T v="body" style={{ flex: 1 }}>Connect on your Android phone</T>
          </View>
        )}

        {/* Health Connect */}
        <Animated.View entering={enter(0)} style={s.card}>
          <View style={s.row}>
            <IconBox icon="heart-circle" color={c.blue} />
            <View style={{ flex: 1 }}>
              <T v="h3">Health Connect</T>
              <T v="small" numberOfLines={2}>Fitbit, Pixel, Samsung, Garmin, Whoop, Amazfit, Oura</T>
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
            <T v="small">Reads steps, sleep, heart rate, HRV and workouts. Saves your gym sessions back.</T>
          )}

          {hc.connected ? (
            <View style={s.row}>
              <Button kind="ghost" title="Sync now" icon="refresh" onPress={runSync} disabled={syncing} style={{ flex: 1, height: 48 }} />
              <Button kind="danger" title="Disconnect" onPress={() => disconnect()} disabled={syncing} style={{ flex: 1, height: 48 }} />
            </View>
          ) : status === 'not_installed' || status === 'needs_update' ? (
            <Button title={status === 'needs_update' ? 'Update Health Connect' : 'Install Health Connect'} icon="download-outline" onPress={install} />
          ) : (
            <Button title="Connect" onPress={connectHc} disabled={!ANDROID || status !== 'available' || syncing} />
          )}
        </Animated.View>

        <Animated.View entering={enter(1)} style={[s.note, { borderColor: c.line }]}>
          <Ionicons name="information-circle-outline" size={18} color={c.muted} />
          <T v="small" style={{ flex: 1 }}>Using NOOP, Gadgetbridge, OpenStrap or openScale? Turn on its Health Connect sync</T>
        </Animated.View>

        {/* Today's numbers: a glance; their home is Progress › Body & watch */}
        {hc.connected && (syncing ? (
          <View style={s.grid}>{[0, 1, 2, 3].map((i) => <Shimmer key={i} height={112} style={s.cell} />)}</View>
        ) : shown.length > 0 ? (
          <Animated.View entering={enter(2)} style={s.grid}>
            {shown.map((t) => (
              <View key={t.label} style={s.cell}>
                <Tile icon={t.icon} color={t.color} value={t.value!} unit={'unit' in t ? t.unit : undefined} label={t.label}
                  onPress={() => router.push('/chart/body' as never)} />
              </View>
            ))}
          </Animated.View>
        ) : null)}

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
          <T v="small">Works with Polar, Wahoo, Garmin and WHOOP "Broadcast heart rate", PineTime, Bangle.js</T>
          <T v="small">WHOOP: turn on Broadcast Heart Rate in the WHOOP app</T>
          <T v="small">Connects but no heart rate? Its broadcast mode is probably off</T>
        </Animated.View>

        {/* Import a file: Phase C */}
        <Animated.View entering={enter(5)} style={[s.card, s.row, { opacity: 0.5 }]}>
          <IconBox icon="download-outline" color={c.muted} />
          <View style={{ flex: 1 }}>
            <T v="h3">Import a file</T>
            <T v="small">Garmin .FIT, Fitbit Takeout, GPX · next update</T>
          </View>
        </Animated.View>
      </ScrollView>

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
          {ble.status !== 'scanning' && <Button kind="ghost" title="Scan again" icon="refresh" onPress={() => startScan()} />}
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r.lg, padding: 16, borderWidth: 1, borderColor: c.line, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  bpm: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.card2 },
});
