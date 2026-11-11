import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';
import { c, tint } from './theme';
import { T } from './ui';

// Each chart measures its own width with onLayout and draws nothing until it knows it, so there is no fixed-width guess.
let charts = 0; // unique gradient ids: several charts can share a page
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b));

// Line trend with an optional dashed goal line, dots, and the last value labelled.
export function LineChart({ values, goal, height = 120, color = c.accent, fmt = (v: number) => String(Math.round(v)) }: {
  values: number[]; goal?: number; height?: number; color?: string; fmt?: (v: number) => string;
}) {
  const [w, setW] = useState(0);
  const [id] = useState(() => `area${charts++}`);
  if (!values.length) return null;
  const all = goal === undefined ? values : [...values, goal];
  const lo0 = Math.min(...all), hi0 = Math.max(...all);
  const pad = Math.max((hi0 - lo0) * 0.15, 1);
  const lo = lo0 - pad, hi = hi0 + pad;
  // 22 px of headroom so the last value's label sits above the line, never on it.
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * (height - 22);
  const inset = 8;
  const x = (i: number) => (values.length < 2 ? w / 2 : inset + (i / (values.length - 1)) * (w - 2 * inset));
  const last = values.length - 1;
  return (
    <View style={{ height, width: '100%' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          <Svg width={w} height={height}>
            {goal !== undefined && <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={c.warm} strokeDasharray="6 6" strokeWidth={1.5} />}
            {/* A soft wash under the line in the chart's own colour. */}
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={c.scheme === 'light' ? 0.18 : 0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {values.length > 1 && (
              <Path d={`M${x(0)},${height} ${values.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(last)},${height} Z`} fill={`url(#${id})`} />
            )}
            {values.length > 1 && (
              <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 5 : 3} fill={i === last ? color : c.card} stroke={color} strokeWidth={i === last ? 0 : 2} />)}
          </Svg>
          <T v="small" color={color} style={{ position: 'absolute', width: 80, textAlign: 'center', left: clamp(x(last) - 40, 0, w - 80), top: clamp(y(values[last]) - 26, 0, height - 18) }}>
            {fmt(values[last])}
          </T>
        </>
      )}
    </View>
  );
}

// Vertical bars with a value and a label under each; the last bar is highlighted. An optional goal draws a dashed line.
// `now` marks the current bar (highlighted). Bars after it are the days or weeks still to come: drawn as faint
// empty slots so the current one sits in the middle of the chart instead of at the far right edge.
export function Bars({ items, height = 110, color = c.accent, goal, now, fmt }: { items: { label: string; value: number }[]; height?: number; color?: string; goal?: number; now?: number; fmt?: (v: number) => string }) {
  const [w, setW] = useState(0);
  const n = items.length;
  const max = Math.max(1, goal ?? 0, ...items.map((it) => it.value));
  const slot = n ? w / n : 0;
  const gap = 8;
  const last = now ?? n - 1;
  return (
    <View style={{ height: height + 40, width: '100%' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && n > 0 && (
        <>
          <Svg width={w} height={height}>
            {goal !== undefined && <Line x1={0} x2={w} y1={height - (goal / max) * height} y2={height - (goal / max) * height} stroke={c.warm} strokeDasharray="6 6" strokeWidth={1.5} />}
            {items.map((it, i) => {
              if (i > last) return <Rect key={i} x={i * slot + gap / 2} y={height - 10} width={Math.max(2, slot - gap)} height={10} rx={5} fill="none" stroke={c.line} strokeDasharray="3 3" />;
              const h = it.value > 0 ? Math.max(4, (it.value / max) * height) : 0;
              return <Rect key={i} x={i * slot + gap / 2} y={height - h} width={Math.max(2, slot - gap)} height={h} rx={6} fill={i === last ? color : tint(color, c.scheme === 'light' ? 3.5 : 2.6)} />;
            })}
          </Svg>
          {items.map((it, i) => (
            <View key={i} style={{ position: 'absolute', left: i * slot, width: slot, top: height + 6, alignItems: 'center' }}>
              {/* Narrow bars (14 days on a phone): only today's value, so numbers never run into each other. */}
              <T v="small" numberOfLines={1} color={i === last ? color : i > last || slot < 32 ? 'transparent' : c.text}>{fmt ? fmt(it.value) : it.value}</T>
              <T v="label" color={i === last ? color : i > last ? c.dim : undefined} style={{ marginTop: 2 }}>{it.label}</T>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
