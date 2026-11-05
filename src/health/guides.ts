// "Connect your watch": per-brand steps for sharing a watch's data into Health Connect, where we read it. No watch can
// pair with us directly over Bluetooth (their pairing is encrypted with keys only the maker's app holds), so the route
// is always: the brand's own app -> Health Connect -> us. Brands with no Health Connect support get alternatives.
//
// Kept as plain data so it is easy to update when an app moves a menu. Each guide lists the official page it follows
// (`source`). Menu names are quoted from those pages; check them again when a brand redesigns its app.
// Last checked: November 2026.

export type Alt = 'gadgetbridge' | 'strap' | 'ring' | 'import';

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
    source: 'https://support.google.com/fitbit/answer/14506680',
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
    source: 'https://www.scorevitals.com/howtos/sync-garmin-watch-to-health-connect',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    app: { name: 'WHOOP', pkg: 'com.whoop.android' },
    hc: true,
    note: 'Shares sleep, workouts and resting heart rate',
    steps: [
      'Open WHOOP',
      'Tap More at the bottom right',
      'Tap Integrations, then Health Connect',
      'Tap Set up',
      'Tap Allow all, then Allow',
    ],
    packages: ['com.whoop.android'],
    fix: 'Open WHOOP once so it syncs, then try again',
    strapHint: 'In WHOOP, turn on Broadcast heart rate',
    alts: ['strap'],
    source: 'https://gadgetsandwearables.com/2023/07/14/whoop-health-connect-integration/',
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
    source: 'https://support.polar.com/en/flow-app-health-connect',
  },
  {
    id: 'colmi',
    name: 'Colmi / Yawell ring',
    hc: false,
    note: 'We read this ring directly over Bluetooth',
    steps: [],
    packages: ['nodomain.freeyourgadget.gadgetbridge'],
    fix: 'Use the Smart ring card instead',
    alts: ['ring'],
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
};
// Origins that are the phone itself, not a watch.
export const PHONE_ORIGINS = ['android', 'com.google.android.apps.healthdata', 'com.google.android.apps.fitness'];

export const originName = (pkg: string) => ORIGINS[pkg] ?? pkg.split('.').filter((x) => !['com', 'android', 'app', 'apps'].includes(x))[0] ?? pkg;

export const playUrl = (pkg: string) => `market://details?id=${pkg}`;
export const playWeb = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;
