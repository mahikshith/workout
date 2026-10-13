export const c = {
  bg: '#0A0A0B',
  // Surfaces step up clearly from the page so every block reads as a block: page, card, inset.
  card: '#151518',
  card2: '#1F1F23',
  line: '#2A2A30',
  text: '#F5F5F7',
  muted: '#8E8E93',
  dim: '#55555C',
  accent: '#C5F04A',
  accentInk: '#0A0A0A',
  warm: '#FF8A3D',
  pink: '#FF5C8A',
  blue: '#5AC8FA',
  danger: '#FF453A',
  ok: '#30D158',
  media: '#F4F4F2',
};

// Accent choices for the profile. `c.accent` is swapped in place and the root remounts, so read it at render time
// (inline styles), never inside StyleSheet.create.
export const ACCENTS = {
  lime: { name: 'Volt lime', hex: '#C5F04A' },
  gold: { name: 'Champagne gold', hex: '#E6C36A' },
  ember: { name: 'Ember', hex: '#FF7A45' },
  glacier: { name: 'Glacier', hex: '#7DD3FC' },
  rose: { name: 'Rose', hex: '#F4A3B5' },
} as const;
export type AccentId = keyof typeof ACCENTS;
export const setAccent = (id: AccentId = 'lime') => { c.accent = ACCENTS[id]?.hex ?? ACCENTS.lime.hex; };

export const f = {
  display: 'Anton_400Regular',
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
export const equip = (e: string) => EQUIP[e] ?? EQUIP.other;
