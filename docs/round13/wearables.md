# Round 13 · Wearables stream

Owner's ask: connecting a watch through its partner app wasn't clear, and all the sensor data those apps hold
(heart rate, HRV, SpO2, sleep…) wasn't visible in our app. Show the path simply, bring the data in, and keep track of
what we actually get from each partner app.

## Journey: before → after

**Before.** You › Watch & health opened a long page: a "Your watch" card, Fitbit and WHOOP status cards, Recovery,
a "Today's numbers" door that went to a chart, then a strap card, three paragraphs of strap tips, the ring card, file
import and a Gadgetbridge note. Connect your watch was a sheet with 5–6 sentence steps per brand, a separate "Then
here" block, a second check page, and no picture of how data travels. Nothing in the app showed the watch's numbers
together; heart rate during the day, SpO2, breathing rate or watch workouts had no home.

**After.**
1. **Today › Tracker pane** (`TrackerCard`). Nothing connected: one line, "Connect a watch · Heart rate, sleep,
   steps", with the mini data path. Tap opens the brand picker directly. Connected: steps, kcal and resting HR with
   "Synced 17 min ago", or the live bpm while a strap/ring/broadcast streams. Tap opens the Tracker.
2. **Tracker** (`/tracker`, new). Live heart rate (beating heart, zone pill, last minute as a line), where the data
   comes from (data path with ticks, Sync now), today's numbers in tiles, heart rate today (10-minute line, low/high,
   minutes per zone), and workouts from your watch (kcal, avg HR, distance). Every missing number shows "—" and why:
   "Not shared by Google Health", "Nothing today yet", "We can't read it from Health Connect yet". Empty state: the
   path diagram, one line, one button "Connect your watch", and a row for straps and rings.
3. **Watch & health** leads with status: one card with the data path (a tick on each hop we've seen working), "From
   Google Health · synced 20 min ago", and one action (Connect your watch, or Sync now + Add a watch once connected).
   Then Tracker, Recovery and Body & watch doors. "More ways" keeps strap, ring and file import; the Gadgetbridge
   note is folded; Disconnect moved to the bottom.
4. **Connect your watch** sheet. Picker: the diagram, one sentence ("Watches don't pair with Gym Buddy directly…"),
   8 tiles (Fitbit / Pixel, WHOOP, Samsung Galaxy, Garmin, Amazfit / Zepp, Xiaomi / Mi Band, Colmi ring, Other or a
   strap) plus chips for Oura, Huawei, Polar. Brand page: status line ("Last data today from Google Health · synced
   14 min ago"), the brand's data path with live ticks and a plain sentence on why it goes that way, then **three
   numbered steps, one button each**: Get the app → Turn on Health Connect in it (its menu path on one line, "Show
   every tap" for the full list) → Allow Gym Buddy. The current step's button is the filled one; done steps get a
   tick. After access: "Data is arriving…" + Done, or "Nothing from WHOOP yet" + the fix + Check again. Then **What
   Gym Buddy gets** and, for brands that can broadcast, **Live heart rate in workouts** with its own direct
   (Bluetooth) diagram and Find my watch. Colmi ring gets a two-node Bluetooth path and two steps.

## Changes and why

| File | Change |
|---|---|
| `src/health/DataPath.tsx` (new) | `DataPath` diagram (Views + Ionicons, no logos: watch → brand app → Health Connect → Gym Buddy, or device → Bluetooth → Gym Buddy), `hcPath`/`directPath` builders, `useWatchLink()` (who's connected, which apps shared in 7 days), `syncedAgo()`. |
| `src/health/ConnectWatch.tsx` | Rewritten flow above. `GetsTable`: per brand, ✓ received this week / ○ usually shared, not here yet / ? depends on plan or model / ⊖ we can't read it yet, and "X doesn't send …". Health Connect permission now asks without history; "Allow older history" is a separate, optional step (research §4). |
| `src/health/guides.ts` | Per brand: `tile` (short name), `path` (menu path), `shares` (what its app writes to Health Connect), `unsure`, `direct`. Metrics gained calories, weight, VO2 max, skin temperature; `METRIC_ORDER`, `NOT_READ`. Fitbit from Google's own read/write table (writes HR, HRV, breathing, VO2 max, weight, skin temp; **not SpO2**). WHOOP per research §4: sleep, workouts, calories, body metrics, resting HR + breathing (Health Monitor plans); **never HR samples, HRV, VO2 max**; steps and SpO2 marked "depends". Samsung from its developer mapping table; Garmin, Zepp, Mi Fitness, Polar, Oura from press/secondary sources (the table only says "usually"; ticks come from real data). |
| `src/health/brandStatus.ts` | `metricsFrom()` (metrics + newest day for a set of origins), new metrics, `unsure` handled, `last` day. |
| `src/health/TrackerCard.tsx` | Today's pane, as above. |
| `app/tracker.tsx` (new) | Tracker screen, as above. |
| `app/watch.tsx` | Status-first layout; Fitbit/WHOOP status cards and the strap tip paragraphs removed (now in the brand pages); `?connect=1|<brand>` opens the flow, `?do=strap|import|ring` jumps to one of the other ways (used by Tracker, Today pane, Recovery). |
| `app/recovery.tsx` | "Connect your watch" opens the flow directly. |
| `src/tracker.ts` (additive) | `hrDay` (today's 10-min heart-rate averages, low/high/avg, minutes per zone) + `setHrDay`; cleared on Disconnect. |
| `src/health/healthConnect.ts` (additive) | Sync reads today's heart-rate samples into `hrDay` (best origin, phone last); watch workouts from the last 14 days get kcal / avg / max HR (kept across re-syncs, not re-read); `requestPermissions(history = true)`; `requestHistory()`. |

## What Gym Buddy reads (and doesn't)

Read from Health Connect: steps, distance, active and total calories, heart rate (day average and today's samples),
resting HR, HRV (RMSSD), SpO2, breathing rate, VO2 max, sleep with stages, weight, exercise sessions (+ kcal/HR for
the last 14 days). Over Bluetooth: live heart rate (+ beat-to-beat for HRV) from straps and broadcasting watches; steps,
kcal, HR log and SpO2 from Colmi rings. **Not read:** skin temperature (react-native-health-connect 3.5.3 has no
record for it; Fitbit writes it, so the Tracker says "We can't read it from Health Connect yet"), WHOOP recovery /
strain, Garmin Body Battery / HRV status (never shared by those apps).

## Screenshots (`/tmp/claude-0/shots/wearables/`)

- `tracker-light.png`, `tracker-dark.png`: Tracker with a seeded Fitbit week (full height)
- `tracker-live-light.png`, `tracker-live-dark.png`: live heart rate card (samples pushed by a temporary web hook, since removed)
- `tracker-empty-light.png`, `tracker-empty-dark.png`: nothing connected
- `today-pane-light.png` (connected), `today-pane-empty-light.png`, `today-pane-empty-dark.png`: Today's tracker pane
- `watch-connected-light.png`, `watch-connected-dark.png`, `watch-empty-light.png`: Watch & health
- `connect-pick-light.png`, `connect-pick-dark.png`: brand picker
- `connect-fitbit-light.png`, `connect-fitbit-light-2.png`: Fitbit page, connected (steps ticked, gets table)
- `connect-whoop-dark.png`, `connect-whoop-dark-2.png`: WHOOP page, not connected (steps, table with "depends" rows, live HR)
- `connect-colmi-light.png`, `connect-other-dark.png`: direct ring path; Other with Gadgetbridge, file and strap

Seed: tracker store key `gym-buddy-tracker` (`{state, version: 1}`), generated relative to now by
`/tmp/claude-0/-home-user/a511aa06-ad55-5c3e-a65f-eddaad522a1b/scratchpad/wear/seed.mjs`.

## Not verified

Everything native: Health Connect permission dialogs, the history step, sync (including the new today's-HR read and
workout kcal/HR reads), Bluetooth straps and broadcasts, Colmi ring. The web build shows "Connecting needs the Android
app" and disabled Sync/Allow buttons. The per-brand "usually shares" lists for Samsung, Garmin, Zepp, Mi Fitness,
Polar and Oura are from secondary sources; WHOOP steps/SpO2 are marked "depends" until tested on a real account.
"Open {app}" goes to the app's Play Store page (Play shows Open when installed): React Native's Linking can't launch
another app by package and expo-intent-launcher isn't installed.

## Hurdles and choices

- One filled button per screen vs "one primary button per step": each step has one button, and only the current
  step's is filled; the rest are tonal.
- Health Connect's rationale screen (required by Android) is already provided by the `expo-health-connect` config
  plugin (rationale activity + Android 14 alias in the manifest); it opens the app, not a dedicated rationale page.
  A dedicated in-app rationale route would need app/_layout.tsx (not owned): left open.
- Opening the flow from a route param on web needed a short delay (the sheet didn't rise when opened during the first
  render); 350 ms also lets the screen settle before the sheet rises.
- Health Connect rows are per day, not per app, so a brand's ticks only count metrics that brand is known to share
  (plus "depends" ones); "Other" counts anything not from the phone.
- Zone colours use domain tokens (sleep, water, steps, kcal, heart) so Steady and Hard stay distinct in light mode.
