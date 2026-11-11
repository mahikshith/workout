// "Connect your watch": per-brand steps for sharing a watch's data into Health Connect, where we read it. No watch can
// pair with us directly over Bluetooth (their pairing is encrypted with keys only the maker's app holds), so the route
// is always: the brand's own app -> Health Connect -> us. Brands with no Health Connect support get alternatives.
//
// Kept as plain data so it is easy to update when an app moves a menu. Each guide lists the official page it follows
// (`source`). Menu names are quoted from those pages; check them again when a brand redesigns its app.
// Last checked: November 2026.

export type Alt = 'gadgetbridge' | 'strap' | 'ring' | 'import';

// What a brand's app can put in Health Connect, as we store it (src/tracker.ts DailyMetrics + workouts).
export type Metric = 'steps' | 'sleep' | 'hr' | 'rhr' | 'hrv' | 'spo2' | 'resp' | 'workouts' | 'kcal' | 'weight' | 'vo2' | 'temp';
export const METRIC_LABEL: Record<Metric, string> = {
  steps: 'steps', sleep: 'sleep', hr: 'heart rate', rhr: 'resting HR', hrv: 'HRV', spo2: 'SpO2', resp: 'breathing rate', workouts: 'workouts',
  kcal: 'calories', weight: 'weight', vo2: 'VO2 max', temp: 'skin temperature',
};
// The "What Gym Buddy gets" table, in this order.
export const METRIC_ORDER: Metric[] = ['hr', 'rhr', 'hrv', 'spo2', 'resp', 'sleep', 'steps', 'kcal', 'workouts', 'weight', 'vo2', 'temp'];
// Shared by some watch apps but not read by us yet (react-native-health-connect 3.5.3 has no skin temperature record).
export const NOT_READ: Metric[] = ['temp'];

// Live heart rate during workouts over standard Bluetooth (0x180D), with the steps on the device itself.
export type Live = {
  short: string; // "Find my <short>"
  match: RegExp; // advertised names of this brand, to list its devices first
  devices: { name: string; steps: string[] }[];
  note?: string;
  source: string;
};

export type Guide = {
  id: string;
  name: string; // tile label: brand names as text, no logos
  app?: { name: string; pkg: string }; // the brand's Android app, opened through its Play Store page
  hc: boolean; // the brand's app shares to Health Connect
  note?: string; // one line above the steps
  steps: string[]; // in the brand's app; our own "Allow access" and "Check" steps are added by the flow
  packages: string[]; // the Health Connect data origins this brand writes as
  fix: string; // the likely fix when nothing arrived
  strapHint?: string; // how to turn on its Bluetooth heart-rate broadcast, if it has one
  alts?: Alt[]; // other ways in, best first
  source: string;
  expects?: Metric[]; // what this brand's app shares, to show what's missing
  missing?: Partial<Record<Metric, string>>; // one-line fix per missing metric
  info?: string; // one line under the status, e.g. what the brand never shares
  live?: Live;
  tile?: string; // shorter name for the brand picker
  path?: string; // where the Health Connect switch is in the brand's app, as one line: "Connections › Partner apps › ..."
  // What the brand's app usually writes to Health Connect (from its own help page where it has one; varies by model).
  // Only used to say what to expect; what really arrived is always read from the data.
  shares?: Metric[];
  unsure?: Metric[]; // sources disagree on these: shown as "depends on your plan or model", never as "doesn't share"
  direct?: boolean; // talks to us over Bluetooth itself, no brand app in between (Colmi ring)
};

export const GUIDES: Guide[] = [
  {
    id: 'fitbit',
    name: 'Fitbit / Pixel Watch',
    app: { name: 'Google Health', pkg: 'com.fitbit.FitbitMobile' },
    hc: true,
    note: 'The Fitbit app is now called Google Health',
    steps: [
      'Open Google Health',
      'Tap Connections at the top left',
      'Tap Partner apps',
      'Tap Sync your favorite health apps, then Set up',
      'Tap Accept, pick your data, tap Continue',
      'Tap Allow all, then Allow, then Done',
    ],
    packages: ['com.fitbit.FitbitMobile'],
    fix: 'Open Google Health once so it syncs, then try again',
    alts: ['import'],
    tile: 'Fitbit / Pixel',
    path: 'Connections › Partner apps › Sync your favorite health apps › Set up › Allow all',
    // Fitbit help 14506680: writes steps, total calories, sleep, HR, resting HR, HRV, breathing, VO2 max, weight, skin
    // temperature and exercise; only reads SpO2 and active calories.
    shares: ['hr', 'rhr', 'hrv', 'resp', 'sleep', 'steps', 'kcal', 'workouts', 'weight', 'vo2', 'temp'],
    source: 'https://support.google.com/fitbit/answer/14506680',
    missing: {
      sleep: 'Wear it to bed, then open Google Health in the morning',
      hrv: 'HRV comes in after a night with the watch on',
      rhr: 'Resting HR comes in after a day with the watch on',
      resp: 'Breathing rate comes in after a night with the watch on',
      steps: 'Open Google Health so it syncs',
      hr: 'Open Google Health so it syncs',
      workouts: 'Record one on the watch and it shows up here',
    },
    live: {
      short: 'watch',
      match: /charge|pixel|fitbit|google|edge/i,
      devices: [
        { name: 'Charge 6 or Edge', steps: ['Swipe down from the clock face', 'Tap Broadcast HR', 'Here, tap Find my watch and pick it', 'On the watch, tap Share, then Start'] },
        { name: 'Pixel Watch 2 or newer', steps: ['Swipe down from the clock face', 'Tap Connected Fitness, then Connect', 'Here, tap Find my watch and pick it', 'Accept the pairing request'] },
      ],
      note: 'Older Fitbits (Charge 5, Versa, Sense, Inspire) have no live heart rate',
      source: 'https://support.google.com/googlehealth/answer/14236705',
    },
  },
  {
    id: 'samsung',
    name: 'Samsung Galaxy Watch',
    app: { name: 'Samsung Health', pkg: 'com.sec.android.app.shealth' },
    hc: true,
    steps: [
      'Open Samsung Health',
      'Open its Settings',
      'Tap Health Connect',
      'Tap Get started',
      'Pick the data to share, tap Allow',
    ],
    packages: ['com.sec.android.app.shealth'],
    fix: 'Open Samsung Health once so it syncs, then try again',
    tile: 'Samsung Galaxy',
    path: 'Settings › Health Connect › Get started › Allow',
    // Samsung's developer mapping table: steps, SpO2, exercise, heart rate, sleep with stages, weight.
    shares: ['hr', 'spo2', 'sleep', 'steps', 'workouts', 'weight'],
    source: 'https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    app: { name: 'Garmin Connect', pkg: 'com.garmin.android.apps.connectmobile' },
    hc: true,
    note: 'Needs Garmin Connect 5.14 or newer. Only new data is shared',
    steps: [
      'Open Garmin Connect',
      'Tap More at the bottom',
      'Tap Settings, then Connected apps',
      'Tap Health Connect',
      'Tap Allow all, then Allow',
    ],
    packages: ['com.garmin.android.apps.connectmobile'],
    fix: 'Sync your watch in Garmin Connect, then try again',
    strapHint: 'On the watch, turn on Broadcast heart rate',
    alts: ['strap', 'import'],
    path: 'More › Settings › Connected apps › Health Connect › Allow all',
    // Garmin's list (press, 2025): steps, distance, calories, sleep, heart rate, weight, activities. No HRV status.
    shares: ['hr', 'sleep', 'steps', 'kcal', 'workouts', 'weight'],
    source: 'https://www.scorevitals.com/howtos/sync-garmin-watch-to-health-connect',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    app: { name: 'WHOOP', pkg: 'com.whoop.android' },
    hc: true,
    steps: [
      'Open WHOOP',
      'Tap More at the bottom right',
      'Tap Account & Settings, then Integrations',
      'Tap Health Connect, then Set Up',
      'Tap Allow all, then Allow',
    ],
    packages: ['com.whoop.android'],
    fix: 'Open WHOOP once so it syncs, then try again',
    strapHint: 'In WHOOP, turn on Broadcast Heart Rate',
    path: 'More › Account & Settings › Integrations › Health Connect › Set Up',
    // WHOOP support (via research.md §4): sleep, workouts, calories, body metrics; resting HR and breathing rate on
    // plans with Health Monitor. Never heart-rate samples, HRV, VO2 max, recovery or strain. Steps and SpO2: unclear.
    shares: ['rhr', 'resp', 'sleep', 'kcal', 'workouts', 'weight'],
    unsure: ['steps', 'spo2'],
    source: 'https://ultrafit360.com/blog/whoop-apple-health-health-connect',
    missing: {
      sleep: 'Open WHOOP after you wake up so it syncs',
      rhr: "Resting HR needs WHOOP's Health Monitor",
      spo2: 'Open WHOOP after you wake up so it syncs',
      resp: 'Open WHOOP after you wake up so it syncs',
      steps: 'Open WHOOP so it syncs',
      workouts: 'Start or confirm one in WHOOP and it shows up here',
    },
    info: "WHOOP doesn't share heart rate or HRV. Live heart rate in workouts gives us yours",
    live: {
      short: 'WHOOP',
      match: /whoop/i,
      devices: [
        { name: 'WHOOP 4.0, 5.0 or MG', steps: ['In WHOOP, tap your strap icon for Device settings', 'Turn on Broadcast Heart Rate', 'Here, tap Find my WHOOP and pick it'] },
      ],
      note: 'It shares with one app at a time',
      source: 'https://www.whoop.com/thelocker/10-whoop-features-you-need-to-know/',
    },
  },
  {
    id: 'oura',
    name: 'Oura',
    app: { name: 'Oura', pkg: 'com.ouraring.oura' },
    hc: true,
    steps: [
      'Open Oura',
      'Tap the menu at the top left, then Settings',
      'Under Data sharing, tap Health Connect',
      'Turn on what to share',
    ],
    packages: ['com.ouraring.oura'],
    fix: 'Open Oura once so the ring syncs, then try again',
    path: 'Menu › Settings › Data sharing › Health Connect',
    shares: ['hr', 'sleep', 'steps', 'kcal', 'workouts'],
    source: 'https://support.ouraring.com/hc/en-us/articles/10786105824531',
  },
  {
    id: 'zepp',
    name: 'Amazfit / Zepp',
    app: { name: 'Zepp', pkg: 'com.huami.watch.hmwatchmanager' },
    hc: true,
    steps: [
      'Open Zepp',
      'Tap Profile',
      'Tap 3rd-party account linking',
      'Tap Health Connect',
      'Tap Allow all, then Allow',
    ],
    packages: ['com.huami.watch.hmwatchmanager', 'com.xiaomi.hm.health'],
    fix: 'Open Zepp once so the watch syncs, then try again',
    alts: ['gadgetbridge'],
    tile: 'Amazfit / Zepp',
    path: 'Profile › 3rd-party account linking › Health Connect › Allow all',
    shares: ['hr', 'spo2', 'sleep', 'steps', 'kcal', 'workouts'],
    source: 'https://www.notebookcheck.net/Amazfit-smartwatches-get-new-Health-Connect-data-sync-feature.951489.0.html',
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi / Mi Band',
    app: { name: 'Mi Fitness', pkg: 'com.xiaomi.wearable' },
    hc: true,
    note: 'Mi Fitness shares only while it is open',
    steps: [
      'Open Mi Fitness',
      'Tap Profile',
      'Tap Third-party data',
      'Tap Health Connect, then Connect',
      'Allow the data, tap Allow',
    ],
    packages: ['com.xiaomi.wearable'],
    fix: 'Open Mi Fitness and leave it open a minute, then try again',
    alts: ['gadgetbridge'],
    tile: 'Xiaomi / Mi Band',
    path: 'Profile › Third-party data › Health Connect › Connect',
    shares: ['hr', 'sleep', 'steps', 'kcal'],
    source: 'https://www.mi.com/global/support/faq/details/KA-230357/',
  },
  {
    id: 'huawei',
    name: 'Huawei',
    hc: false,
    note: "Huawei Health doesn't share with Health Connect",
    steps: [],
    packages: ['com.huawei.health'],
    fix: 'Pair the watch in Gadgetbridge and sync it, then try again',
    strapHint: 'On the watch, open Settings, then HR Data Broadcasts',
    alts: ['gadgetbridge', 'strap'],
    path: 'Gadgetbridge: Settings › External integrations › Health Connect',
    shares: ['hr', 'spo2', 'sleep', 'steps', 'workouts'],
    source: 'https://consumer.huawei.com/en/support/content/en-us15827504/',
  },
  {
    id: 'polar',
    name: 'Polar / Wahoo / chest strap',
    app: { name: 'Polar Flow', pkg: 'fi.polar.polarflow' },
    hc: true,
    note: 'Chest strap only? Skip to Live heart rate below',
    steps: [
      'Open Polar Flow',
      'Tap General settings',
      'Turn on Health Connect',
      'Pick the data, tap Allow',
    ],
    packages: ['fi.polar.polarflow'],
    fix: 'Sync your Polar watch in Polar Flow, then try again',
    strapHint: 'Wear the strap so it wakes up',
    alts: ['strap'],
    path: 'General settings › Health Connect › Allow',
    shares: ['hr', 'sleep', 'steps', 'kcal', 'workouts'],
    source: 'https://support.polar.com/en/flow-app-health-connect',
  },
  {
    id: 'colmi',
    name: 'Colmi / Yawell ring',
    hc: false,
    note: 'We read this ring directly over Bluetooth',
    steps: [],
    packages: ['colmi', 'nodomain.freeyourgadget.gadgetbridge'],
    fix: 'Use the Smart ring card instead',
    alts: ['ring'],
    tile: 'Colmi ring',
    direct: true,
    // src/health/colmiDevice.ts: steps, active calories, the heart-rate log and SpO2 on demand.
    shares: ['hr', 'spo2', 'steps', 'kcal'],
    source: 'https://gadgetbridge.org/basics/integrations/health-connect/',
  },
  {
    id: 'other',
    name: 'Other / not sure',
    hc: true,
    steps: [
      "Open your watch's own app",
      'Look in its settings for Health Connect',
      'Turn it on and allow all',
    ],
    packages: [],
    fix: "Open your watch's app once so it syncs, then try again",
    alts: ['gadgetbridge', 'import', 'strap'],
    tile: 'Other or a strap',
    path: "Your watch app's settings › Health Connect › Allow all",
    source: 'https://support.google.com/android/answer/12201227',
  },
];

// Gadgetbridge: an open-source app that talks to many watches, bands and rings itself, then shares to Health Connect.
export const GADGETBRIDGE = {
  pkg: 'nodomain.freeyourgadget.gadgetbridge',
  url: 'https://f-droid.org/packages/nodomain.freeyourgadget.gadgetbridge/',
  steps: [
    'Install Gadgetbridge from F-Droid',
    'Unpair the watch from its own app, then pair it in Gadgetbridge',
    'Settings, then External integrations, then Health Connect',
    'Turn on Enable Health Connect export',
    'Select devices: tick your watch',
    'Turn on Sync after device sync',
  ],
  source: 'https://gadgetbridge.org/basics/integrations/health-connect/',
};

// Friendly names for Health Connect data origins (package names), for "Steps from Google Health found".
const ORIGINS: Record<string, string> = {
  'com.fitbit.FitbitMobile': 'Google Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.whoop.android': 'WHOOP',
  'com.ouraring.oura': 'Oura',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.xiaomi.hm.health': 'Zepp Life',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huawei.health': 'Huawei Health',
  'fi.polar.polarflow': 'Polar Flow',
  'nodomain.freeyourgadget.gadgetbridge': 'Gadgetbridge',
  'com.google.android.apps.healthdata': 'Health Connect',
  android: 'your phone',
  colmi: 'your ring',
};
// Origins that are the phone itself, not a watch.
export const PHONE_ORIGINS = ['android', 'com.google.android.apps.healthdata', 'com.google.android.apps.fitness'];

export const originName = (pkg: string) => ORIGINS[pkg] ?? pkg.split('.').filter((x) => !['com', 'android', 'app', 'apps'].includes(x))[0] ?? pkg;

export const playUrl = (pkg: string) => `market://details?id=${pkg}`;
export const playWeb = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;
