// The live 3D view: our own anatomy figure that the user can turn with a finger, pinch to zoom, slow down and pause.
// The page shows the measured angles as moving numbers in a strip above the figure ("aim" = the angle to reach), and
// has a window button: it, or a double tap on the figure, asks for the big view (`onExpand`) or leaves it (`onClose`).
// It is one self-contained page (assets/anatomy/live.html, built by scripts/anatomy3d/pack.cjs) shown in a web view,
// so it needs no internet. If the phone cannot draw it (no WebGL, the page fails, or nothing shows within the time
// limit), `onFail` fires and the caller goes back to the earlier views. Only one is open at a time: the caller
// unmounts the one in the pane while the big view is open.
import { Asset } from 'expo-asset';
import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { c } from './theme';

const PAGE = require('../assets/anatomy/live.html');
const WAIT_MS = 20000;

// `spec` is an exercise's own movement data (the same the 2D animation uses). `big` = shown in the big view.
export type LiveSpec = { pose: unknown; primary: string[]; secondary: string[] };
export function Live3D({ spec, onFail, big, onExpand, onClose }: { spec: LiveSpec; onFail: () => void; big?: boolean; onExpand?: () => void; onClose?: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const failed = useRef(false);
  const act = useRef({ onExpand, onClose }); act.current = { onExpand, onClose }; // the listeners below always call the latest
  const fail = () => { if (!failed.current) { failed.current = true; onFail(); } };
  const hear = (data: unknown) => {
    try {
      const m = typeof data === 'string' ? JSON.parse(data) : data;
      if (m?.type === 'ready') setReady(true);
      else if (m?.type === 'fail') fail();
      else if (m?.type === 'expand') act.current.onExpand?.();
      else if (m?.type === 'close') act.current.onClose?.();
    } catch { /* not ours */ }
  };
  useEffect(() => {
    let live = true;
    const a = Asset.fromModule(PAGE);
    // on a phone the page is copied out of the app first, so the web view can open it as a local file
    (Platform.OS === 'web' ? Promise.resolve(a.uri) : a.downloadAsync().then((x) => x.localUri ?? x.uri))
      .then((u) => { if (live) setUri(`${u}#j=${encodeURIComponent(JSON.stringify(spec))}&bg=${c.card2.slice(1)}&ink=${c.text.slice(1)}${big ? '&big=1' : ''}`); })
      .catch(fail);
    return () => { live = false; };
  }, [spec, big]);
  useEffect(() => { if (ready) return; const t = setTimeout(fail, WAIT_MS); return () => clearTimeout(t); }, [ready]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const on = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow) hear(e.data); };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2 }]}>
      {uri && (Platform.OS === 'web'
        ? createElement('iframe', { ref: frame, src: uri, title: '3D view', style: { border: 0, width: '100%', height: '100%' } })
        : (
          <WebView source={{ uri }} originWhitelist={['*']} allowFileAccess javaScriptEnabled domStorageEnabled={false}
            scrollEnabled={false} overScrollMode="never" bounces={false} nestedScrollEnabled setSupportMultipleWindows={false}
            onMessage={(e) => hear(e.nativeEvent.data)} onError={fail} onHttpError={fail} onRenderProcessGone={fail} onContentProcessDidTerminate={fail}
            style={{ flex: 1, backgroundColor: 'transparent' }} />
        ))}
      {!ready && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2 }]}><ActivityIndicator color={c.muted} /></View>}
    </View>
  );
}
