import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { c } from './theme';
import { T, Tap } from './ui';

// Round 13: the safety disclaimer. One full page (app/safety.tsx) and one short line with a link, used where a
// person commits to something physical (setup's plan step, joining a challenge, supplements, You).

export const SAFETY_SHORT = 'Not medical advice. Train at your own risk.';

// Round 15: the same points as before, as short bullets. `open` points start unfolded on the safety page.
export const SAFETY_POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; points: string[]; open?: boolean }[] = [
  { icon: 'medkit', title: 'Not medical advice', open: true, points: [
    'Plans, challenges, food targets and supplement notes are general suggestions for healthy adults.',
    'Not a diagnosis or treatment.',
    'Not a substitute for a doctor, physiotherapist or dietitian.',
  ] },
  { icon: 'hand-left', title: 'Stop if something feels wrong', open: true, points: [
    'Stop at once and get help for chest pain, dizziness, faintness, unusual shortness of breath or sharp pain.',
    'Soreness the next day is normal. Pain during a move is not.',
  ] },
  { icon: 'person', title: 'See a doctor first if you…', points: [
    'are new to exercise',
    'are pregnant or recently gave birth',
    'are over 65',
    'have a heart, blood pressure, joint or other condition',
    'take medication',
    'have had an injury',
  ] },
  { icon: 'barbell', title: 'Your choices, your pace', points: [
    'You decide what to train, how heavy to lift, and whether to take, pause or leave a challenge.',
    'Use good form, a spotter for heavy lifts, and equipment you know how to use.',
    'Gym Buddy and its makers are not responsible for injury, illness or loss from using the app.',
  ] },
  { icon: 'nutrition', title: 'Food and supplements', points: [
    'Calorie, protein and water numbers are estimates.',
    'Supplements (protein, creatine, caffeine, pre-workout) are your choice. Read the label.',
    'Keep caffeine moderate.',
    'Ask a professional first if you are under 18, pregnant or have a health condition.',
  ] },
  { icon: 'watch', title: 'Watch data is approximate', points: [
    'Heart rate, calories, sleep and readiness come from your watch and its app.',
    'They can be wrong and are not for medical use.',
  ] },
];

// A short line with a "Safety ›" link. Put it under a commit button (setup plan, Join challenge, supplements).
export function SafetyNote({ text = SAFETY_SHORT, center }: { text?: string; center?: boolean }) {
  return (
    <Tap onPress={() => router.push('/safety')} scale={0.99} feedback="none" accessibilityRole="link" accessibilityLabel="Safety and disclaimer"
      style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 8, justifyContent: center ? 'center' : 'flex-start' }}>
      <Ionicons name="shield-checkmark-outline" size={16} color={c.muted} style={{ marginTop: 2 }} />
      <View style={{ flexShrink: 1 }}>
        <T v="small" color={c.muted} style={{ fontSize: 13, lineHeight: 18, textAlign: center ? 'center' : 'left' }}>
          {text} <T v="small" color={c.accent} style={{ fontSize: 13, lineHeight: 18 }}>Safety ›</T>
        </T>
      </View>
    </Tap>
  );
}
