// Less text on screen, nothing lost (docs/round15/less-text.md).
//
// Tip: a small (i) beside a title. The explanation that used to sit under the title as a sentence now opens in a
// sheet on tap, so the screen shows the title only and the detail is one tap away.
//
//   <Row gap={4}><T v="h2">Readiness</T><Tip title="Readiness" text="Built from sleep, resting heart rate…" /></Row>
//
// Meta: a line of icon + short value pairs that replaces "3 days a week · Beginner · 45 min" style sentences.
//
//   <Meta items={[{ icon: 'calendar-outline', text: '3×/wk' }, { icon: 'time-outline', text: '45 min' }]} />
import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Sheet } from './sheet';
import { c } from './theme';
import { T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;

export function Tip({ title, text, label, children, size = 18, color = c.muted, style }: {
  title: string; text?: string; label?: string; children?: ReactNode; size?: number; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tap onPress={() => setOpen(true)} feedback="none" scale={0.9} accessibilityLabel={`About ${title}`}
        hitSlop={10}
        style={[{ minWidth: 28, height: 28, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }, style]}>
        {label ? <T v="small" color={color}>{label}</T> : null}
        <Ionicons name="information-circle-outline" size={size} color={color} />
      </Tap>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <T v="h2">{title}</T>
          {text ? <T v="body" color={c.soft}>{text}</T> : null}
          {children}
        </View>
      </Sheet>
    </>
  );
}

export type MetaItem = { icon: Icon; text: string | number; color?: string };

export function Meta({ items, color = c.muted, style }: { items: (MetaItem | false | null | undefined)[]; color?: string; style?: StyleProp<ViewStyle> }) {
  const list = items.filter(Boolean) as MetaItem[];
  if (!list.length) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 }, style]}
      accessibilityRole="text" accessibilityLabel={list.map((x) => x.text).join(', ')}>
      {list.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={x.icon} size={14} color={x.color ?? color} />
          <T v="small" color={x.color ?? color} numberOfLines={1}>{String(x.text)}</T>
        </View>
      ))}
    </View>
  );
}
