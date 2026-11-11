// Colours, type, radii and spacing. Pure data: no React Native imports, so Node self-checks can load it.
//
// Light and dark. `c` is one mutable palette that `setTheme` fills before any screen module loads (see index.js and
// src/look.ts), because StyleSheet.create copies colours when a module first runs. Read `c.*` at render time where you
// can; inside StyleSheet.create only use the neutral tokens (bg, card, card2, line, text, muted, dim...), never the accent.

export type Mode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

// Neutrals. Dark keeps the original near-black look; light is a soft grey page with white cards (Fitbit / Material 3).
const DARK = {
  bg: '#0A0A0B',
  // Surfaces step up clearly from the page so every block reads as a block: page, card, inset.
  card: '#151518',
  card2: '#1F1F23',
  line: '#26262C', // 1px borders in this colour: present, never loud
  text: '#F5F5F7',
  soft: '#C9C9CE', // secondary text that should still read as text (coach line, chips on the hero)
  label: '#B4B4BA', // T v="label"
  muted: '#8E8E93',
  dim: '#55555C',
  bar: '#111113', // tab bar
  raised: '#17171B', // floating surfaces: mini bar, toasts
  handle: '#3A3A40', // sheet grab handle
  scrim: 'rgba(0,0,0,0.45)', // behind sheets
  glass: 'rgba(10,10,11,0.92)', // pinned bottom bars over content
  overlay: 'rgba(10,10,11,0.75)', // labels laid over pictures
  dangerBg: '#2A1210',
  accentInk: '#0A0A0A', // text and icons on an accent (or any domain colour) fill
  media: '#F4F4F2', // behind exercise photos (the photos have white backgrounds)
};
type Neutrals = typeof DARK;
const LIGHT: Neutrals = {
  bg: '#F3F4F7',
  card: '#FFFFFF',
  card2: '#ECEEF2',
  line: '#E1E4EA',
  text: '#14161A',
  soft: '#3A4049',
  label: '#4A515C',
  muted: '#5C636E',
  dim: '#767C86',
  bar: '#FFFFFF',
  raised: '#FFFFFF',
  handle: '#C9CDD4',
  scrim: 'rgba(16,20,28,0.32)',
  glass: 'rgba(243,244,247,0.94)',
  overlay: 'rgba(255,255,255,0.86)',
  dangerBg: '#FCE8E6',
  accentInk: '#FFFFFF',
  media: '#F4F4F2',
};

// One colour per domain, used the same way everywhere: icons, rings, chart lines, soft tinted cards and hero
// gradients. Hues follow Fitbit's metric colours (heart red, sleep indigo, activity teal/green, water blue, food
// orange). Dark values are bright on near-black; light values are deep enough to be text on white (WCAG >= 4.5:1).
export const DOMAINS = {
  train: { name: 'Training', dark: '#2DD4BF', light: '#00756A' }, // teal: workouts, exercise
  heart: { name: 'Heart', dark: '#FF5C6C', light: '#C8283D' }, // heart rate, zones
  sleep: { name: 'Sleep', dark: '#8E9BFF', light: '#4B58D6' }, // sleep, recovery
  kcal: { name: 'Calories', dark: '#FF9F43', light: '#B04F00' }, // food and calories
  protein: { name: 'Protein', dark: '#F472B6', light: '#C2185B' },
  water: { name: 'Water', dark: '#4FC3F7', light: '#026FAE' },
  weight: { name: 'Body weight', dark: '#B98CFF', light: '#7E3FD1' },
  streak: { name: 'Streak', dark: '#FFCC33', light: '#A15C00' }, // streaks, medals, consistency
  steps: { name: 'Steps', dark: '#5BD98A', light: '#17803A' },
} as const;
export type Domain = keyof typeof DOMAINS;
export const dom = Object.fromEntries(Object.entries(DOMAINS).map(([k, v]) => [k, v.dark])) as Record<Domain, string>;

// Status colours. warm/pink/blue are the food, protein and water domain colours under their old names.
const STATUS = {
  dark: { warm: '#FF9F43', pink: '#F472B6', blue: '#4FC3F7', danger: '#FF453A', ok: '#30D158' },
  light: { warm: '#B04F00', pink: '#C2185B', blue: '#026FAE', danger: '#C8261C', ok: '#17803A' },
};

// Accent choices for the profile. Each has a bright dark-mode value (dark ink on it) and a deep light-mode value (white
// ink on it, and readable as text on white cards).
export const ACCENTS = {
  lime: { name: 'Volt lime', hex: '#C5F04A', light: '#437012' },
  gold: { name: 'Gold', hex: '#E6C36A', light: '#8A6100' },
  ember: { name: 'Ember', hex: '#FF7A45', light: '#C2410C' },
  glacier: { name: 'Glacier', hex: '#7DD3FC', light: '#0369A1' },
  rose: { name: 'Rose', hex: '#F4A3B5', light: '#BE185D' },
} as const;
export type AccentId = keyof typeof ACCENTS;
export const isAccent = (x: unknown): x is AccentId => typeof x === 'string' && x in ACCENTS;
export const isMode = (x: unknown): x is Mode => x === 'system' || x === 'light' || x === 'dark';

export const c = { ...DARK, accent: ACCENTS.lime.hex as string, ...STATUS.dark, scheme: 'dark' as Scheme };

// The scheme and accent the app is drawn in right now.
export const now = { mode: 'system' as Mode, scheme: 'dark' as Scheme, accent: 'lime' as AccentId };

// Fills `c` and `dom` for a scheme and accent. `system` is the device's scheme ('light' | 'dark' | null) and is only
// used when mode is 'system'.
export function setTheme(mode: Mode, accent: AccentId = 'lime', system?: Scheme | null) {
  const scheme: Scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const a = ACCENTS[accent] ?? ACCENTS.lime;
  Object.assign(c, scheme === 'light' ? LIGHT : DARK, STATUS[scheme], { accent: scheme === 'light' ? a.light : a.hex, scheme });
  for (const k of Object.keys(DOMAINS) as Domain[]) dom[k] = DOMAINS[k][scheme];
  Object.assign(now, { mode, scheme, accent: ACCENTS[accent] ? accent : 'lime' });
  return scheme;
}
// Kept for old callers: swaps only the accent.
export const setAccent = (id: AccentId = 'lime') => setTheme(now.mode, id, now.scheme);
// The accent's swatch colour in the current scheme.
export const accentHex = (id: AccentId, scheme: Scheme = now.scheme) => (scheme === 'light' ? ACCENTS[id].light : ACCENTS[id].hex);

// A colour at an opacity, as #RRGGBBAA: soft tinted backgrounds. Light mode needs a lighter wash than dark.
export const tint = (hex: string, strength = 1) => {
  const a = Math.round(Math.min(1, (c.scheme === 'light' ? 0.1 : 0.16) * strength) * 255);
  return hex.slice(0, 7) + a.toString(16).padStart(2, '0');
};

// Every colour value a palette token has had, mapped to the token. src/look.ts uses it to recolour StyleSheets that
// captured a colour (including old hard-coded copies of the dark palette) when the theme is other than the one they
// were written for.
export const TOKEN_OF: Record<string, keyof Neutrals | 'warm' | 'pink' | 'blue' | 'danger' | 'ok'> = (() => {
  const m: Record<string, any> = {};
  const add = (pal: Record<string, string>) => { for (const [k, v] of Object.entries(pal)) if (k !== 'media') m[v.toUpperCase()] ??= k; };
  add(DARK); add(LIGHT); add(STATUS.dark); add(STATUS.light);
  // Hard-coded dark colours written before light mode existed.
  Object.assign(m, {
    '#141417': 'card', '#2A2A30': 'raised', '#C8C8CE': 'soft', '#FF8A3D': 'warm', '#FF5C8A': 'pink', '#5AC8FA': 'blue',
    'RGBA(10,10,11,0.72)': 'overlay', 'RGBA(10,10,11,0.75)': 'overlay', 'RGBA(10,10,11,0.92)': 'glass',
  });
  // Pure white and near-black are also used on purpose (ink on colour, shadows), so they are never recoloured.
  for (const v of ['#FFFFFF', '#0A0A0A']) delete m[v];
  return m;
})();

export const f = {
  // Big numbers (timers, counters). Was Anton (condensed, all caps); round 13 toned it down to Outfit Bold.
  display: 'Outfit_700Bold',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semi: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
};

// Corner radii: 16 for cards everywhere (bigger reads as toy-like), smaller for things inside cards.
export const r = { sm: 10, md: 14, lg: 16, xl: 20 };

// Spacing scale. Sections are 32 apart, cards inside a section 12, things inside a card 12; nothing else.
export const sp = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, section: 32 };

// One colour per equipment type, used for equipment badges everywhere.
export const EQUIP: Record<string, { label: string; color: string }> = {
  'body only': { label: 'Bodyweight', color: '#30D158' },
  dumbbell: { label: 'Dumbbell', color: '#5AC8FA' },
  barbell: { label: 'Barbell', color: '#FF9F0A' },
  machine: { label: 'Machine', color: '#BF8CFF' },
  cable: { label: 'Cable', color: '#FF6482' },
  kettlebells: { label: 'Kettlebell', color: '#FFD60A' },
  bands: { label: 'Band', color: '#64D2FF' },
  'e-z curl bar': { label: 'EZ bar', color: '#FF9F0A' },
  'exercise ball': { label: 'Ball', color: '#AC8E68' },
  'medicine ball': { label: 'Med ball', color: '#AC8E68' },
  'foam roll': { label: 'Foam roller', color: '#8E8E93' },
  'pull-up bar': { label: 'Pull-up bar', color: '#30D158' },
  other: { label: 'Other', color: '#8E8E93' },
};
// Equipment colours are bright for dark cards; on light cards the same hue is deepened so badges stay readable.
const EQUIP_LIGHT: Record<string, string> = {
  '#30D158': '#17803A', '#5AC8FA': '#026FAE', '#FF9F0A': '#B04F00', '#BF8CFF': '#7E3FD1', '#FF6482': '#C8283D',
  '#FFD60A': '#8A6100', '#64D2FF': '#0369A1', '#AC8E68': '#7A5C38', '#8E8E93': '#5C636E',
};
export const equip = (e: string) => {
  const x = EQUIP[e] ?? EQUIP.other;
  return c.scheme === 'light' ? { ...x, color: EQUIP_LIGHT[x.color] ?? x.color } : x;
};
