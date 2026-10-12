import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Profile, Session } from './store';

const NUDGES = [
  'Your future self is already proud. Let’s train.',
  'Twenty minutes counts. Show up today.',
  'Small sets, big streaks. Tap to start.',
  'You didn’t come this far to only come this far.',
  'Rest is done. Time to move.',
];

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function askPermission() {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Rebuilt after onboarding, settings changes and every finished session: one daily reminder plus a
// "streak at risk" nudge two days after the last workout.
export async function reschedule(p: Profile | null, sessions: Session[]) {
  if (Platform.OS === 'web' || !p) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!p.reminder.on || !(await Notifications.getPermissionsAsync()).granted) return;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('nudges', { name: 'Workout nudges', importance: Notifications.AndroidImportance.HIGH });
  const { hour, minute } = p.reminder;
  await Notifications.scheduleNotificationAsync({
    content: { title: `${p.name ? `Hey ${p.name}, it’s` : 'It’s'} go time 💪`, body: NUDGES[new Date().getDate() % NUDGES.length] },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'nudges' },
  });
  const last = sessions[sessions.length - 1];
  if (last) {
    const at = new Date(last.startedAt);
    at.setDate(at.getDate() + 2);
    at.setHours(hour, minute + 30, 0, 0);
    if (at.getTime() > Date.now())
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Your streak is on the line 🔥', body: 'Two days off already. A short session keeps it alive.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'nudges' },
      });
  }
}

// Rest timer alert for when the phone is locked or the app is in the background.
let restId: string | null = null;
export async function restAlert(seconds: number | null) {
  if (Platform.OS === 'web') return;
  if (restId) { Notifications.cancelScheduledNotificationAsync(restId); restId = null; }
  if (!seconds || !(await Notifications.getPermissionsAsync()).granted) return;
  restId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over', body: 'Next set. Let’s go.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'nudges' },
  });
}
