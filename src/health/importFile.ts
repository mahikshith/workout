import * as DocumentPicker from 'expo-document-picker';
import { strFromU8 } from 'fflate';
import { Platform } from 'react-native';
import { dayKey } from '../calc';
import { APP_NAME, parseAppCsv, planImport, planLine, type AppPlan } from '../importApps';
import { useStore } from '../store';
import { useTracker } from '../tracker';
import { newWorkouts, parseFiles } from './importers';

// Picks one or more files, reads them (a File/ArrayBuffer on web, expo-file-system on Android), parses them and
// saves what they hold into the tracker store. Daily rows merge by date; workouts are keyed by start minute.

// apps: workout history from another app's CSV (Strong, Hevy, FitNotes, our own export). It is not written yet: the
// sheet shows planLine() and writes it with commitApps() when the person taps Import.
export type ImportSummary = { workouts: number; days: number; files: number; skipped: number; error?: 'too_big' | 'unreadable'; apps?: AppPlan[] };

const MAX_BYTES = 700 * 1024 * 1024; // a whole file is read into memory

async function bytesOf(a: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer | Uint8Array> {
  if (Platform.OS === 'web') {
    if (a.file) return a.file.arrayBuffer();
    return (await fetch(a.uri)).arrayBuffer();
  }
  const { File } = require('expo-file-system') as typeof import('expo-file-system');
  return new File(a.uri).bytes();
}

// Opens the system picker. Returns null when the person closes it without choosing. On web a cancel may never
// resolve, so callers show progress only once this returns.
export async function pickFiles(): Promise<DocumentPicker.DocumentPickerAsset[] | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  return res.canceled || !res.assets?.length ? null : res.assets;
}

export async function importFiles(assets: DocumentPicker.DocumentPickerAsset[]): Promise<ImportSummary> {
  if (assets.some((a) => (a.size ?? 0) > MAX_BYTES)) return { workouts: 0, days: 0, files: 0, skipped: assets.length, error: 'too_big' };

  const files: { name: string; data: ArrayBuffer | Uint8Array }[] = [];
  for (const a of assets) {
    try { files.push({ name: a.name ?? a.uri.split('/').pop() ?? 'file', data: await bytesOf(a) }); } catch { /* counted below */ }
  }
  if (!files.length) return { workouts: 0, days: 0, files: 0, skipped: assets.length, error: 'unreadable' };

  // Workout-app CSVs are recognised by their header and planned (not written) here; other files carry on below.
  const apps: AppPlan[] = [];
  const rest: typeof files = [];
  for (const f of files) {
    const parsed = /\.(csv|txt)$/i.test(f.name) ? parseAppCsv(textOf(f.data)) : null;
    if (parsed) apps.push(planImport(parsed, useStore.getState().sessions));
    else rest.push(f);
  }
  if (apps.length && !rest.length) return { workouts: 0, days: 0, files: apps.length, skipped: assets.length - files.length, apps };
  if (apps.length) files.splice(0, files.length, ...rest);

  // Hand the JS thread back between zip entries so the sheet keeps animating.
  let last = Date.now();
  const pause = () => {
    if (Date.now() - last < 50) return Promise.resolve();
    return new Promise<void>((r) => setTimeout(() => { last = Date.now(); r(); }, 0));
  };
  const parsed = await parseFiles(files, { pause });
  const t = useTracker.getState();
  const fresh = newWorkouts(t.workouts, parsed.workouts);
  const added = fresh.filter((w) => !t.workouts[w.id]).length;
  if (parsed.daily.length) t.upsertDaily(parsed.daily);
  if (fresh.length) t.upsertWorkouts(fresh);
  return { workouts: added, days: parsed.daily.length, files: parsed.files + apps.length, skipped: parsed.skipped + assets.length - files.length - apps.length, apps: apps.length ? apps : undefined };
}

const textOf = (d: ArrayBuffer | Uint8Array) => strFromU8(d instanceof Uint8Array ? d : new Uint8Array(d)); // fflate: no TextDecoder needed on Hermes

// One short line for the sheet.
export function summaryLine(s: ImportSummary): string {
  if (s.error === 'too_big') return 'That file is too big. Export a shorter range';
  if (s.error === 'unreadable') return 'Could not read that file';
  if (!s.workouts && !s.days) return s.files ? 'Nothing new in that file' : 'Nothing we can read in that file';
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const bits = [s.workouts ? part(s.workouts, 'workout', 'workouts') : null, s.days ? part(s.days, 'day', 'days') : null].filter(Boolean);
  return `Added ${bits.join(' and ')}`;
}

// Two files covering the same day (say Strong and Hevy) add that day once: the first file's workouts win.
function merge(apps: AppPlan[]): AppPlan {
  const days = new Set<string>();
  const sessions = [];
  let skippedDays = apps.reduce((n, a) => n + a.skippedDays, 0);
  for (const a of apps) {
    const mine = new Set<string>();
    for (const x of a.sessions) {
      const d = dayKey(x.startedAt);
      if (days.has(d)) { skippedDays++; continue; }
      mine.add(d);
      sessions.push(x);
    }
    mine.forEach((d) => days.add(d));
  }
  return { app: apps[0].app, sessions, skippedDays, unknown: [...new Set(apps.flatMap((a) => a.unknown))], emptyWorkouts: apps.reduce((n, a) => n + a.emptyWorkouts, 0) };
}

// The summary sheet's line before writing: "Strong · 42 workouts, 3 unknown exercises".
export function appsLine(apps: AppPlan[]): string {
  return `${[...new Set(apps.map((a) => APP_NAME[a.app]))].join(' and ')} · ${planLine(merge(apps))}`;
}

// Writes the planned workouts (days logged since the preview are still skipped by the store).
export function commitApps(apps: AppPlan[]): string {
  const { added } = useStore.getState().importSessions(merge(apps).sessions);
  if (!added) return 'Nothing new to add';
  return `Added ${added} ${added === 1 ? 'workout' : 'workouts'}`;
}
