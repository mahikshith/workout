import Svg, { Path } from 'react-native-svg';
import { BODY, VIEWBOX } from './data/bodyPaths';
import { c } from './theme';

export const RED = '#FF453A';

// MuscleMap region -> our muscle names. Abductors have no region of their own; they sit in the upper glutes.
const MAP: Record<string, string[]> = {
  chest: ['chest'], deltoids: ['shoulders'], triceps: ['triceps'], biceps: ['biceps'], forearm: ['forearms'],
  upperBack: ['lats'], rotatorCuff: ['lats', 'middle back'], rhomboids: ['middle back'], lowerBack: ['lower back'],
  trapezius: ['traps'], abs: ['abdominals'], obliques: ['abdominals'], quadriceps: ['quadriceps'], hamstring: ['hamstrings'],
  gluteal: ['glutes', 'abductors'], calves: ['calves'], adductors: ['adductors'], neck: ['neck'],
};
export const mapped = (m: string) => Object.values(MAP).some((ms) => ms.includes(m));

const [, , W, H] = VIEWBOX.split(' ').map(Number);

// Front and back side by side: main muscles solid red, helpers light red, the rest a quiet outline.
export function MuscleMap({ primary, secondary, size = 200 }: { primary: string[]; secondary: string[]; size?: number }) {
  return (
    <Svg width={(size * W) / H} height={size} viewBox={VIEWBOX}>
      {BODY.map(([region, d], i) => {
        const ms = MAP[region] ?? [];
        const main = ms.some((m) => primary.includes(m));
        const help = !main && ms.some((m) => secondary.includes(m));
        if (region === 'rhomboids' && !main && !help) return null; // drawn over the traps only when it is working
        return <Path key={i} d={d} fill={main || help ? RED : c.card2} fillOpacity={help ? 0.35 : 1} stroke={c.line} strokeWidth={4} />;
      })}
    </Svg>
  );
}
