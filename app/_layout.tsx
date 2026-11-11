import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useHealthSync } from '../src/health';
import { DockedMiniBar, registerRestDay } from '../src/kit';
import { useNudgeSync } from '../src/notify';
import { isRestDay, RestDaySheet } from '../src/restday';
import { useStore } from '../src/store';
import { retheme, useLook } from '../src/look';
import { c, now } from '../src/theme';

SplashScreen.preventAutoHideAsync();

// Holds the rest-day sheet for the whole app, so every Start (centre button, Today, Train) opens the same one.
function RestDayHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => registerRestDay(() => { if (!isRestDay()) return false; setOpen(true); return true; }), []);
  return <RestDaySheet open={open} onClose={() => setOpen(false)} />;
}

// Detail pages rise and fade.
const DETAIL = { animation: 'fade_from_bottom' } as const;

export default function Root() {
  const [fonts] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const ready = fonts && hydrated;
  useNudgeSync(); // keeps every reminder, hydration and motivation nudge in step with the store
  useHealthSync(); // Health Connect sync on launch/foreground, strap reconnect, finished workouts written back
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);

  // The palette was chosen before any screen loaded (index.js, src/look.ts). When it changes in place (a new accent,
  // or light/dark on a release phone build), `v` bumps and the key below remounts everything so every colour updates.
  const v = useLook((s) => s.v);
  const path = usePathname();
  const where = useRef(path);
  where.current = path;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // If the remount started the stack again on Today, go back to the screen you were on.
    const to = where.current;
    if (to && to !== '/') setTimeout(() => { if (where.current !== to) router.push(to as Href); }, 120);
  }, [v]);
  // Theme "System": follow the phone switching between light and dark.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const p = useLook.getState();
      if (p.mode === 'system' && (colorScheme === 'light' || colorScheme === 'dark') && colorScheme !== now.scheme) retheme(p, colorScheme);
    });
    return () => sub.remove();
  }, []);

  // The navigator's own theme carries our page colour, so the frame between two screens (and behind a screen that is
  // still fading in) is never white or black by default.
  const nav = useMemo(() => {
    const base = c.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.line, primary: c.accent } };
  }, [v]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView key={v} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      {/* Transitions (docs/round14/fluid.md, section 4). react-native-screens 4.16 on Android:
          - places (You, Library, History, settings...) slide in from the right while the screen under them shifts
            back a little ('ios_from_right'; the plain 'slide_from_right' leaves the old screen standing still);
          - detail pages opened from a card (exercise, plan, challenge, chart) rise 8 % and fade in ('fade_from_bottom'),
            so they read as "more about this" rather than a new place;
          - the workout slides up from the bottom and swipes down to minimise (it keeps running in the mini bar);
          - setup and Summary fade; Summary is the end of a workout: no swipe back.
          iOS (parked) falls back to its default push for the first two. Every screen paints c.bg before its content. */}
      <ThemeProvider value={nav}>
        <Stack screenOptions={{
          headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'ios_from_right', animationDuration: 300,
          gestureEnabled: true, fullScreenGestureEnabled: true, animationMatchesGesture: true,
          statusBarStyle: c.scheme === 'dark' ? 'light' : 'dark', statusBarAnimation: 'fade',
        }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical', fullScreenGestureEnabled: false }} />
          <Stack.Screen name="summary" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="exercise/[id]" options={DETAIL} />
          <Stack.Screen name="plan/[id]" options={DETAIL} />
          <Stack.Screen name="challenge/[id]" options={DETAIL} />
          <Stack.Screen name="chart/[kind]" options={DETAIL} />
          <Stack.Screen name="+not-found" options={{ animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
      {/* One workout mini bar for the whole app, above every screen except the workout, its summary and setup. */}
      <DockedMiniBar />
      <RestDayHost />
    </GestureHandlerRootView>
  );
}
