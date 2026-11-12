// Theme and device preferences (light/dark/system, accent, haptics), kept apart from the main store because the
// entry (index.js) reads them before the app loads. Saved under their own key, so erasing your data keeps them.
//
// How a theme change reaches the screen:
// - web: the page reloads (instant, and the URL keeps you where you were);
// - phone, development build: DevSettings.reload();
// - phone, release build: the palette is swapped in place, every StyleSheet that captured a palette colour is
//   recoloured (see patchStyleSheet), and the root remounts (`useLook().v` is its key).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { Appearance, DevSettings, Platform, StyleSheet } from 'react-native';
import { create } from 'zustand';
import { GLASS } from './glass';
import { c, isAccent, isMode, now, setTheme, TOKEN_OF, type AccentId, type Mode, type Scheme } from './theme';

const KEY = 'gym-buddy-look';
const web = Platform.OS === 'web';

// blur: real blur behind glass on Android (You › Real glass blur). Off by default: Android's blur redraws the screen
// every frame and is slow on older phones. Web and iOS always blur.
export type Prefs = { mode: Mode; accent: AccentId; haptics: boolean; blur: boolean };
export const DEFAULT_PREFS: Prefs = { mode: 'system', accent: 'lime', haptics: true, blur: false };
const applyBlur = (p: Prefs) => { GLASS.blur = Platform.OS !== 'android' || p.blur; };
// v: bumped when the theme was swapped in place, so the root remounts with the new colours.
export const useLook = create<Prefs & { v: number }>(() => ({ ...DEFAULT_PREFS, v: 0 }));

export const systemScheme = (): Scheme | null => {
  try { const s = Appearance.getColorScheme(); return s === 'light' || s === 'dark' ? s : null; } catch { return null; }
};

// Saved prefs, or the accent from before this key existed (it lived in the profile of the main 'gym-buddy' store).
function parse(own: string | null, legacy: string | null): Prefs {
  const p = { ...DEFAULT_PREFS };
  try {
    const o = own ? JSON.parse(own) : null;
    if (o) {
      if (isMode(o.mode)) p.mode = o.mode;
      if (isAccent(o.accent)) p.accent = o.accent;
      if (typeof o.haptics === 'boolean') p.haptics = o.haptics;
      if (typeof o.blur === 'boolean') p.blur = o.blur;
      return p;
    }
    const a = legacy ? JSON.parse(legacy)?.state?.profile?.accent : null;
    if (isAccent(a)) p.accent = a;
  } catch {}
  return p;
}

function start(p: Prefs) {
  if (!web && p.mode !== 'system') try { Appearance.setColorScheme(p.mode); } catch {}
  setTheme(p.mode, p.accent, p.mode === 'system' ? systemScheme() : null);
  applyBlur(p);
  useLook.setState({ ...p });
  patchStyleSheet();
  paintRoot();
}
const paintRoot = () => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => {}); };

// Web: localStorage is synchronous, so the app can load in the same tick. Returns false on a phone.
export function bootSync() {
  if (!web) return false;
  let own: string | null = null, legacy: string | null = null;
  try { own = localStorage.getItem(KEY); legacy = own ? null : localStorage.getItem('gym-buddy'); } catch {}
  start(parse(own, legacy));
  return true;
}
export async function bootAsync() {
  let own: string | null = null, legacy: string | null = null;
  try {
    own = await AsyncStorage.getItem(KEY);
    if (!own) legacy = await AsyncStorage.getItem('gym-buddy');
  } catch {}
  start(parse(own, legacy));
}

const save = async (p: Prefs) => {
  const json = JSON.stringify(p);
  if (web) { try { localStorage.setItem(KEY, json); } catch {} return; }
  await AsyncStorage.setItem(KEY, json).catch(() => {});
};

// 'saved': nothing to redraw. 'remount': the root remounted in place. 'reload': the app is reloading.
export type Applied = 'saved' | 'remount' | 'reload';

// Changes and saves prefs, then redraws as needed.
export async function setPrefs(patch: Partial<Prefs>): Promise<Applied> {
  const cur = useLook.getState();
  const next: Prefs = { mode: cur.mode, accent: cur.accent, haptics: cur.haptics, blur: cur.blur, ...patch };
  await save(next);
  if (next.blur !== cur.blur) { applyBlur(next); useLook.setState({ ...next, v: cur.v + 1 }); return 'remount'; } // glass redraws
  const scheme = next.mode === 'system' ? schemeFor('system') : next.mode;
  if (next.mode === cur.mode && next.accent === cur.accent) { useLook.setState({ haptics: next.haptics }); return 'saved'; }
  if (scheme === now.scheme) {
    // Same light or dark: only the accent (read at render time) changes, so a remount is enough everywhere.
    if (!web && next.mode !== 'system') try { Appearance.setColorScheme(next.mode); } catch {}
    setTheme(next.mode, next.accent, scheme);
    useLook.setState({ ...next, v: cur.v + 1 });
    return 'remount';
  }
  return retheme(next, scheme);
}

// The device scheme with any override of ours removed.
function schemeFor(mode: Mode): Scheme {
  if (mode !== 'system') return mode;
  if (!web) try { Appearance.setColorScheme(null); } catch {}
  return systemScheme() ?? 'dark';
}

// Light <-> dark. Called by setPrefs, and by the root when the device switches while the mode is System.
export function retheme(p: Prefs = useLook.getState(), scheme: Scheme = schemeFor(p.mode)): Applied {
  if (scheme === now.scheme && p.accent === now.accent) return 'saved';
  if (web) { window.location.reload(); return 'reload'; }
  if (__DEV__) { DevSettings.reload('Theme changed'); return 'reload'; }
  if (p.mode !== 'system') try { Appearance.setColorScheme(p.mode); } catch {}
  setTheme(p.mode, p.accent, scheme);
  recolour();
  paintRoot();
  useLook.setState({ ...p, v: useLook.getState().v + 1 });
  return 'remount';
}

// --- StyleSheet recolouring.
// Every StyleSheet.create call goes through here (patched before any screen loads). A colour prop whose value is a
// palette colour of either scheme, or an old hard-coded copy of a dark palette colour (theme.ts TOKEN_OF), is
// rewritten to the current scheme's value of that token, keeping any #RRGGBBAA alpha. On a phone the created styles
// are remembered so a release build can recolour them in place later (development builds freeze them, and reload).
type Rec = [style: Record<string, unknown>, prop: string, token: string, alpha: string];
const recs: Rec[] = [];
const match = (v: string): [string, string] | null => {
  const u = v.toUpperCase().replace(/\s+/g, '');
  const t = TOKEN_OF[u];
  if (t) return [t, ''];
  if (u.length === 9 && u[0] === '#' && TOKEN_OF[u.slice(0, 7)] && (c as Record<string, string>)[TOKEN_OF[u.slice(0, 7)]]?.startsWith('#')) return [TOKEN_OF[u.slice(0, 7)], u.slice(7)];
  return null;
};
const value = (token: string, alpha: string) => (c as Record<string, string>)[token] + alpha;

let patched = false;
function patchStyleSheet() {
  if (patched) return;
  patched = true;
  const sheet = StyleSheet as unknown as { create: (s: Record<string, unknown>) => Record<string, unknown> };
  const orig = sheet.create;
  const create = (styles: Record<string, unknown>) => {
    if (!styles || typeof styles !== 'object') return orig.call(StyleSheet, styles);
    const out: Record<string, unknown> = {};
    const hits: [string, string, string, string][] = [];
    for (const key of Object.keys(styles)) {
      const st = styles[key] as Record<string, unknown> | null;
      if (!st || typeof st !== 'object' || (st as { $$css?: boolean }).$$css) { out[key] = st; continue; }
      let copy: Record<string, unknown> | null = null;
      for (const prop of Object.keys(st)) {
        const v = st[prop];
        if (typeof v !== 'string' || !/color$/i.test(prop)) continue;
        const m = match(v);
        if (!m) continue;
        copy ??= { ...st };
        copy[prop] = value(m[0], m[1]);
        hits.push([key, prop, m[0], m[1]]);
      }
      out[key] = copy ?? st;
    }
    const res = orig.call(StyleSheet, out);
    if (!web && !__DEV__) for (const [key, prop, token, alpha] of hits) {
      const st = res[key] as Record<string, unknown> | undefined;
      if (st && typeof st === 'object') recs.push([st, prop, token, alpha]);
    }
    return res;
  };
  try { sheet.create = create; } catch {}
}
function recolour() {
  for (const [st, prop, token, alpha] of recs) try { st[prop] = value(token, alpha); } catch {}
}
