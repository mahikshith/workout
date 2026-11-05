// Colmi smart ring card for the Watch & health screen. Self-contained: finds, connects, syncs and forgets the ring.
// Android only; on web and iOS it shows a one-line note.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { Sheet } from '../sheet';
import { c } from '../theme';
import { useTracker } from '../tracker';
import { Button, Card, Chip, IconBox, ListRow, Row, T } from '../ui';
import { connectRing, forgetRing, reconnectRing, scanRings, stopRingScan, syncRing, useRing, type FoundRing } from './colmiDevice';
import { useLiveHr } from './live';

const ANDROID = Platform.OS === 'android';

function ago(iso?: string): string {
  if (!iso) return 'Not synced yet';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'Synced just now';
  if (min < 60) return `Synced ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `Synced ${h} h ago`;
  return `Synced ${Math.round(h / 24)} d ago`;
}

export function ColmiCard() {
  if (!ANDROID) {
    return (
      <Card>
        <Row>
          <IconBox icon="ellipse-outline" color={c.muted} />
          <View style={{ flex: 1 }}>
            <T v="h3">Smart ring</T>
            <T v="small" numberOfLines={1}>Needs the Android app</T>
          </View>
        </Row>
      </Card>
    );
  }
  return <RingCard />;
}

function RingCard() {
  const ring = useTracker((s) => s.ring);
  const st = useRing();
  const bpm = useLiveHr();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => { reconnectRing().catch(() => {}); }, []);
  // Keeps "Synced n min ago" fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const find = () => { setOpen(true); scanRings().catch(() => {}); };
  const close = () => { setOpen(false); stopRingScan(); };
  const pick = async (d: FoundRing) => {
    setOpen(false);
    await connectRing(d.id, d.name);
  };

  const connected = st.status === 'connected' || st.status === 'syncing';
  const line = !ring
    ? st.status === 'connecting' ? 'Connecting' : 'Colmi or Yawell ring'
    : st.status === 'connecting' ? 'Connecting'
    : st.status === 'syncing' ? 'Syncing'
    : connected ? [ring.battery != null ? `${ring.battery}%${ring.charging ? ' charging' : ''}` : null, ago(ring.lastSync)].filter(Boolean).join(' · ')
    : st.error ? 'Not connected · try again near the ring' : 'Not connected';

  return (
    <>
      <Card style={{ gap: 14 }}>
        <Row>
          <IconBox icon="ellipse-outline" color={c.accent} />
          <View style={{ flex: 1 }}>
            <T v="h3" numberOfLines={1}>{ring ? ring.name : 'Smart ring'}</T>
            <T v="small" numberOfLines={1}>{line}</T>
          </View>
          {connected && st.live && bpm !== null && (
            <Row gap={6}>
              <Ionicons name="heart" size={16} color={c.pink} />
              <T v="num" style={{ fontSize: 26 }}>{bpm}</T>
            </Row>
          )}
        </Row>
        {!ring && st.status !== 'connecting' && <Button kind="ghost" title="Find ring" icon="search" onPress={find} />}
        {ring && (
          <Row gap={8}>
            {connected
              ? <Chip label={st.status === 'syncing' ? 'Syncing' : 'Sync now'} icon="sync" onPress={st.status === 'syncing' ? undefined : () => { syncRing().catch(() => {}); }} />
              : <Chip label="Connect" icon="bluetooth" onPress={st.status === 'connecting' ? undefined : () => { connectRing(ring.id, ring.name).catch(() => {}); }} />}
            <Chip label="Forget" icon="close" onPress={() => { forgetRing().catch(() => {}); }} />
          </Row>
        )}
      </Card>

      <Sheet open={open} onClose={close}>
        <View style={{ gap: 12 }}>
          <T v="h2">Find your ring</T>
          <T v="small" numberOfLines={1}>
            {st.status === 'scanning' ? (st.found.length ? 'Tap your ring to connect' : 'Looking for rings')
              : st.status === 'off' ? 'Turn on Bluetooth'
              : st.status === 'denied' ? 'Allow Nearby devices to connect'
              : st.found.length ? 'Tap your ring to connect' : 'Nothing found. Take the ring off the charger and try again'}
          </T>
          <FlatList
            data={st.found.slice(0, 12)}
            keyExtractor={(d) => d.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <ListRow icon="ellipse-outline" color={c.accent} title={item.name} sub={item.rssi != null ? `Signal ${item.rssi} dBm` : undefined} onPress={() => pick(item)} />
            )}
          />
          {st.status !== 'scanning' && <Button kind="ghost" title="Scan again" icon="refresh" onPress={() => { scanRings().catch(() => {}); }} />}
        </View>
      </Sheet>
    </>
  );
}
