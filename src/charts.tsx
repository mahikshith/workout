import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { c } from './theme';
import { T } from './ui';

// Each chart measures its own width with onLayout and draws nothing until it knows it, so there is no fixed-width guess.
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b));

// Line trend with an optional dashed goal line, dots, and the last value labelled.
export function LineChart({ values, goal, height = 120, color = c.accent, fmt = (v: number) => String(Math.round(v)) }: {
  values: number[]; goal?: number; height?: number; color?: string; fmt?: (v: number) => string;
}) {
  const [w, setW] = useState(0);
  if (!values.length) return null;
  const all = goal === undefined ? values : [...values, goal];
  const lo0 = Math.min(...all), hi0 = Math.max(...all);
  const pad = Math.max((hi0 - lo0) * 0.15, 1);
  const lo = lo0 - pad, hi = hi0 + pad;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const inset = 8;
  const x = (i: number) => (values.length < 2 ? w / 2 : inset + (i / (values.length - 1)) * (w - 2 * inset));
  const last = values.length - 1;
  return (
    <View style={{ height, width: '100%' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          <Svg width={w} height={height}>
            {goal !== undefined && <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={c.warm} strokeDasharray="6 6" strokeWidth={1.5} />}
            {values.length > 1 && (
              <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 5 : 3} fill={color} />)}
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
export function Bars({ items, height = 110, color = c.accent, goal }: { items: { label: string; value: number }[]; height?: number; color?: string; goal?: number }) {
  const [w, setW] = useState(0);
  const n = items.length;
  const max = Math.max(1, goal ?? 0, ...items.map((it) => it.value));
  const slot = n ? w / n : 0;
  const gap = 8;
  const last = n - 1;
  return (
    <View style={{ height: height + 40, width: '100%' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && n > 0 && (
        <>
          <Svg width={w} height={height}>
            {goal !== undefined && <Line x1={0} x2={w} y1={height - (goal / max) * height} y2={height - (goal / max) * height} stroke={c.warm} strokeDasharray="6 6" strokeWidth={1.5} />}
            {items.map((it, i) => {
              const h = it.value > 0 ? Math.max(4, (it.value / max) * height) : 0;
              return <Rect key={i} x={i * slot + gap / 2} y={height - h} width={Math.max(2, slot - gap)} height={h} rx={6} fill={i === last ? color : c.dim} />;
            })}
          </Svg>
          {items.map((it, i) => (
            <View key={i} style={{ position: 'absolute', left: i * slot, width: slot, top: height + 6, alignItems: 'center' }}>
              <T v="small" color={i === last ? color : c.text}>{it.value}</T>
              <T v="label" style={{ marginTop: 2 }}>{it.label}</T>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
