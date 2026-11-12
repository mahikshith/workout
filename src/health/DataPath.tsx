// The data-path diagram: how a watch's numbers reach us, one node per hop with a tick once we have seen data pass it.
//   Your watch → Google Health → Health Connect → Gym Buddy        (most watches)
//   Your ring  ──── Bluetooth ────→ Gym Buddy                       (Colmi ring, heart-rate straps and broadcasts)
// Generic icons and the brand's name as text: no logos. Plain Views, so it draws the same on Android, iOS and web.
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View } from 'react-native';
import { c, dom, tint } from '../theme';
import { useTracker } from '../tracker';
import { T } from '../ui';
import { originName, PHONE_ORIGINS } from './guides';

type Icon = keyof typeof Ionicons.glyphMap;
export type HopState = 'ok' | 'wait';
export type PathNode = { icon: Icon; label: string; state: HopState; color?: string };

export const APP_NAME = 'Gym Buddy';

// Watch → brand app → Health Connect → Gym Buddy. `seen`: data from the brand's app arrived; `allowed`: we can read
// Health Connect.
export function hcPath({ device = 'Your watch', deviceIcon = 'watch-outline', app = 'Watch app', seen, allowed }: {
  device?: string; deviceIcon?: Icon; app?: string; seen: boolean; allowed: boolean;
}): PathNode[] {
  return [
    { icon: deviceIcon, label: device, state: seen ? 'ok' : 'wait', color: dom.heart },
    { icon: 'phone-portrait-outline', label: app, state: seen ? 'ok' : 'wait', color: dom.sleep },
    { icon: 'sync-outline', label: 'Health Connect', state: allowed ? 'ok' : 'wait', color: dom.water },
    { icon: 'barbell', label: APP_NAME, state: seen && allowed ? 'ok' : 'wait', color: c.accent },
  ];
}

// A device that talks to us itself over Bluetooth: ring, strap, or a watch in heart-rate broadcast mode.
export function directPath({ device, deviceIcon = 'pulse', ok }: { device: string; deviceIcon?: Icon; ok: boolean }): PathNode[] {
  return [
    { icon: deviceIcon, label: device, state: ok ? 'ok' : 'wait', color: dom.heart },
    { icon: 'barbell', label: APP_NAME, state: ok ? 'ok' : 'wait', color: c.accent },
  ];
}

export function DataPath({ nodes, size = 'md', link }: { nodes: PathNode[]; size?: 'md' | 'sm'; link?: string }) {
  const sm = size === 'sm';
  const d = sm ? 26 : 48;
  const said = nodes.map((n) => `${n.label}${n.state === 'ok' ? ', working' : ''}`).join(', then ');
  return (
    <View accessible accessibilityLabel={said} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: sm ? 2 : 4 }}>
      {nodes.map((n, i) => {
        const ok = n.state === 'ok';
        const col = n.color ?? c.accent;
        const flowing = ok && nodes[i + 1]?.state === 'ok';
        return [
          <View key={n.label + i} style={{ alignItems: 'center', gap: 6, flex: sm ? undefined : 1, minWidth: 0 }}>
            <View style={{
              width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: ok ? tint(col, 1.2) : c.card2, borderWidth: 1.5, borderColor: ok ? col : c.handle, // c.line vanishes on the dark sheet
            }}>
              <Ionicons name={n.icon} size={sm ? 13 : 22} color={ok ? col : c.muted} />
              {!sm && ok && (
                <View style={{
                  position: 'absolute', right: -3, top: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ok,
                }}>
                  <Ionicons name="checkmark" size={12} color={c.accentInk} />
                </View>
              )}
            </View>
            {!sm && <T v="small" numberOfLines={2} style={{ textAlign: 'center', fontSize: 12, lineHeight: 15 }} color={ok ? c.text : c.muted}>{n.label}</T>}
          </View>,
          i < nodes.length - 1 && (
            <View key={'a' + i} style={{ height: d, justifyContent: 'center', alignItems: 'center', flex: link && !sm ? 1.4 : undefined, width: link && !sm ? undefined : sm ? 10 : 16 }}>
              {link && !sm ? (
                <>
                  <T v="small" style={{ fontSize: 11, lineHeight: 14 }} color={flowing ? c.text : c.muted}>{link}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                    <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: flowing ? c.ok : c.handle }} />
                    <Ionicons name="chevron-forward" size={14} color={flowing ? c.ok : c.muted} style={{ marginLeft: -6 }} />
                  </View>
                </>
              ) : (
                <Ionicons name="arrow-forward" size={sm ? 10 : 16} color={flowing ? c.ok : c.muted} />
              )}
            </View>
          ),
        ];
      })}
    </View>
  );
}

// Where the watch link stands, for the Watch screen, the Tracker and Today's tracker pane.
export function useWatchLink() {
  const daily = useTracker((s) => s.daily);
  const hc = useTracker((s) => s.hc);
  const strap = useTracker((s) => s.strap);
  const ring = useTracker((s) => s.ring);
  return useMemo(() => {
    const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const pkgs = new Set(Object.values(daily).filter((d) => d.date >= since).flatMap((d) => d.origin ?? []));
    const apps = [...pkgs].filter((x) => !PHONE_ORIGINS.includes(x) && x !== 'colmi');
    return {
      allowed: hc.connected,
      apps: apps.map(originName), // "Fitbit", "WHOOP": the watch apps that shared in the last 7 days
      pkgs: apps,
      seen: apps.length > 0,
      lastSync: hc.lastSync,
      strap,
      ring,
      // Anything at all connected or saved: otherwise screens show their "connect your watch" state.
      any: hc.connected || !!strap || !!ring || Object.keys(daily).length > 0,
    };
  }, [daily, hc, strap, ring]);
}

// "synced 5 min ago"
export function syncedAgo(iso?: string): string {
  if (!iso) return 'not synced yet';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'synced just now' : m < 60 ? `synced ${m} min ago` : m < 1440 ? `synced ${Math.round(m / 60)} h ago` : `synced ${Math.round(m / 1440)} d ago`;
}
