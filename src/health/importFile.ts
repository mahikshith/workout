import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { useTracker } from '../tracker';
import { newWorkouts, parseFiles } from './importers';

// Picks one or more files, reads them (a File/ArrayBuffer on web, expo-file-system on Android), parses them and
// saves what they hold into the tracker store. Daily rows merge by date; workouts are keyed by start minute.

export type ImportSummary = { workouts: number; days: number; files: number; skipped: number; error?: 'too_big' | 'unreadable' };

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
  return { workouts: added, days: parsed.daily.length, files: parsed.files, skipped: parsed.skipped + assets.length - files.length };
}

// One short line for the sheet.
export function summaryLine(s: ImportSummary): string {
  if (s.error === 'too_big') return 'That file is too big. Export a shorter range';
  if (s.error === 'unreadable') return 'Could not read that file';
  if (!s.workouts && !s.days) return s.files ? 'Nothing new in that file' : 'Nothing we can read in that file';
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const bits = [s.workouts ? part(s.workouts, 'workout', 'workouts') : null, s.days ? part(s.days, 'day', 'days') : null].filter(Boolean);
  return `Added ${bits.join(' and ')}`;
}
