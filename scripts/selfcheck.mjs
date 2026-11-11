// Runs the assert-based self-checks of the pure logic (streaks, targets, women's context, engine rules, muscles).
// Usage: node --experimental-strip-types scripts/selfcheck.mjs
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
const { byId } = await import(new URL('../src/data/exercises.ts', import.meta.url));
for (const m of ['../src/calc.ts', '../src/engine.ts', '../src/data/muscles.ts', '../src/data/order.ts', '../src/data/program.ts', '../src/data/poses.ts', '../src/data/cardio.ts', '../src/data/pairing.ts', '../src/health/parse.ts', '../src/health/readiness.ts', '../src/data/challenges.ts']) {
  (await import(new URL(m, import.meta.url))).selfCheck(byId);
  console.log('ok', m);
}
// Colmi smart ring protocol: checksum, packet building and every parser, against sample packets from the
// MIT-licensed colmi_r02_client docs and fixtures.
(await import(new URL('../src/health/colmi.ts', import.meta.url))).selfCheck();
console.log('ok', '../src/health/colmi.ts');

// File import (src/health/importers.ts and fit.ts) on small synthetic fixtures: GPX, TCX, a FIT made with the Garmin SDK's
// own encoder (devDependency, never bundled) and a hand-made one, a Fitbit Takeout-shaped zip and a Garmin export-shaped zip.
{
  const { parseFiles, newWorkouts, localDay, isFit } = await import(new URL('../src/health/importers.ts', import.meta.url));
  const { Decoder, Encoder, Profile, Stream } = await import('@garmin/fitsdk');
  const { zipSync } = await import('fflate');
  const assert = (ok, m) => { if (!ok) throw new Error('import: ' + m); };
  const enc = (s) => new TextEncoder().encode(s);
  const now = Date.parse('2026-10-20T12:00:00Z');

  // GPX: two points 0.01° of latitude apart (about 1112 m), 10 minutes, heart rate in Garmin's extension.
  const gpx = (day) => `<?xml version="1.0"?><gpx version="1.1" creator="OpenTracks"><trk><name>Morning run</name><type>running</type><trkseg>
    <trkpt lat="52.0" lon="13.0"><time>${day}T12:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="52.01" lon="13.0"><time>${day}T12:10:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  </trkseg></trk></gpx>`;
  const g = await parseFiles([{ name: 'run.gpx', data: enc(gpx('2026-10-10')) }], { now });
  const gw = g.workouts[0];
  assert(g.workouts.length === 1 && gw.type === 'Running' && gw.title === 'Morning run' && gw.originApp === 'OpenTracks', 'gpx basics');
  assert(gw.durationS === 600 && Math.abs(gw.distanceM - 1112) < 3 && gw.avgHr === 150 && gw.maxHr === 160, 'gpx numbers');
  assert(gw.id === 'file:2026-10-10T12:00:00.000Z' && gw.source === 'gpx', 'gpx id');

  // TCX: one lap of 30 min, 5 km, 300 kcal.
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2026-10-11T12:00:00Z</Id>
    <Lap StartTime="2026-10-11T12:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Calories>300</Calories>
    <AverageHeartRateBpm><Value>130</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>170</Value></MaximumHeartRateBpm>
    <Track><Trackpoint><Time>2026-10-11T12:00:00Z</Time><DistanceMeters>0</DistanceMeters></Trackpoint><Trackpoint><Time>2026-10-11T12:30:00Z</Time><DistanceMeters>5000</DistanceMeters></Trackpoint></Track></Lap>
    </Activity></Activities></TrainingCenterDatabase>`;
  const t = await parseFiles([{ name: 'ride.tcx', data: enc(tcx) }], { now });
  const tw = t.workouts[0];
  assert(t.workouts.length === 1 && tw.type === 'Biking' && tw.durationS === 1800 && tw.distanceM === 5000 && tw.kcal === 300, 'tcx numbers');
  assert(tw.avgHr === 130 && tw.maxHr === 170 && tw.end === '2026-10-11T12:30:00.000Z', 'tcx hr + end');

  // FIT from the SDK encoder, plus the same run as GPX: one workout, the FIT numbers win and GPX fills the title.
  const t0 = new Date('2026-10-12T12:00:00Z');
  const e = new Encoder();
  e.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: t0, serialNumber: 1 });
  e.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(t0.getTime() + 1800e3), startTime: t0, sport: 'running', totalElapsedTime: 1800, totalTimerTime: 1750, totalDistance: 5000, totalCalories: 400, avgHeartRate: 150, maxHeartRate: 175 });
  e.onMesg(Profile.MesgNum.WEIGHT_SCALE, { timestamp: t0, weight: 72.5 });
  e.onMesg(Profile.MesgNum.MONITORING_HR_DATA, { timestamp: t0, restingHeartRate: 55, currentDayRestingHeartRate: 54 });
  e.onMesg(Profile.MesgNum.HRV_STATUS_SUMMARY, { timestamp: t0, lastNightAverage: 48.5, weeklyAverage: 50 });
  const fit = e.close();

  // Our decoder (src/health/fit.ts) against the Garmin SDK's decoder on the same file. The SDK is a devDependency used
  // only here, for building fixtures and this cross-check; no app code imports it.
  const { decodeFit, fitCrc } = await import(new URL('../src/health/fit.ts', import.meta.url));
  const ours = decodeFit(fit);
  const sdk = new Decoder(Stream.fromByteArray(fit)).read().messages;
  const ss = sdk.sessionMesgs[0];
  const os = ours?.sessions[0];
  assert(!!os && os.start === ss.startTime.getTime() && os.sport === ss.sport && os.timerS === ss.totalTimerTime && os.elapsedS === ss.totalElapsedTime, 'fit vs sdk: session times');
  assert(os.distanceM === ss.totalDistance && os.kcal === ss.totalCalories && os.avgHr === ss.avgHeartRate && os.maxHr === ss.maxHeartRate, 'fit vs sdk: session totals');
  assert(ours.weights[0].kg === sdk.weightScaleMesgs[0].weight && ours.weights[0].t === sdk.weightScaleMesgs[0].timestamp.getTime(), 'fit vs sdk: weight');
  assert(ours.restingHr[0].bpm === sdk.monitoringHrDataMesgs[0].currentDayRestingHeartRate, 'fit vs sdk: resting hr');
  assert(ours.hrv[0].ms === sdk.hrvStatusSummaryMesgs[0].lastNightAverage, 'fit vs sdk: hrv');
  assert(ours.manufacturer === 255 && ours.fileType === 4, 'fit vs sdk: file id'); // development, activity

  // A hand-made file for what the SDK encoder never writes: a big-endian definition, a 64-bit field (skipped), a
  // developer field, and a compressed timestamp header. Then the same bytes chained after the SDK file, and a bad CRC.
  const bytes = [];
  const u16 = (x, be) => (be ? [x >> 8, x & 255] : [x & 255, x >> 8]);
  const u32 = (x) => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, x >>> 24];
  const T = (Date.parse('2026-10-13T12:00:00Z') - 631065600000) / 1000;
  const Tc = T - (T & 0x1f) + 10; // low five bits are 10, so a compressed offset of 15 means Tc + 5
  bytes.push(0x40, 0, 1, ...u16(0, true), 3, 1, 2, 0x84, 3, 8, 0x8f, 8, 8, 0x07); // def 0: file_id, big-endian
  bytes.push(0x00, ...u16(1, true), 1, 2, 3, 4, 5, 6, 7, 8, ...new TextEncoder().encode('Ring'), 0, 0, 0, 0);
  bytes.push(0x60 | 1, 0, 0, ...u16(30), 2, 253, 4, 0x86, 0, 2, 0x84, 1, 0, 3, 0); // def 1: weight_scale + a 3-byte developer field
  bytes.push(0x01, ...u32(Tc), ...u16(7250), 9, 9, 9);
  bytes.push(0x40 | 2, 0, 0, ...u16(211), 1, 1, 1, 0x02); // def 2: monitoring_hr_data, no timestamp field
  bytes.push(0x80 | (2 << 5) | 15, 54); // compressed timestamp header
  const body = Uint8Array.from(bytes);
  const head = [12, 0x20, ...u16(2100), ...u32(body.length), 0x2e, 0x46, 0x49, 0x54];
  const file = Uint8Array.from([...head, ...body, 0, 0]);
  const crc = fitCrc(file, 0, file.length - 2);
  file[file.length - 2] = crc & 255;
  file[file.length - 1] = crc >> 8;
  const hm = decodeFit(file);
  assert(hm?.manufacturer === 1 && hm.productName === 'Ring', 'fit: big-endian + 64-bit skip + string');
  assert(hm.weights[0].kg === 72.5 && hm.weights[0].t === (Tc + 631065600) * 1000, 'fit: developer field skipped');
  assert(hm.restingHr[0].bpm === 54 && hm.restingHr[0].t === (Tc + 5 + 631065600) * 1000, 'fit: compressed timestamp');
  const chained = decodeFit(Uint8Array.from([...fit, ...file]));
  assert(chained?.sessions.length === 1 && chained.weights.length === 2, 'fit: chained files');
  const broken = file.slice();
  broken[20] ^= 1;
  assert(decodeFit(broken) === null && decodeFit(new Uint8Array(40)) === null, 'fit: bad crc rejected');
  assert(isFit(fit), 'fit header');
  const f = await parseFiles([{ name: 'a.gpx', data: enc(gpx('2026-10-12')) }, { name: 'a.fit', data: fit }], { now });
  const fw = f.workouts[0];
  assert(f.workouts.length === 1 && fw.source === 'fit' && fw.type === 'Running' && fw.durationS === 1750 && fw.distanceM === 5000, 'fit session');
  assert(fw.kcal === 400 && fw.avgHr === 150 && fw.maxHr === 175 && fw.title === 'Morning run', 'fit wins, gpx fills gaps');
  const fd = f.daily.find((d) => d.date === localDay(t0));
  assert(fd?.weightKg === 72.5 && fd?.restingHr === 54, 'fit weight + resting hr');

  // Takeout-shaped zip: Fitbit steps and heart rate (UTC minutes), resting HR, sleep, exercise, weight in pounds, HRV CSV.
  const F = 'Takeout/Fitbit/Global Export Data/';
  const takeout = zipSync({
    [F + 'steps-2026-10-01.json']: enc(JSON.stringify([{ dateTime: '10/15/26 12:00:00', value: '1000' }, { dateTime: '10/15/26 12:01:00', value: '234' }])),
    [F + 'steps-2020-01-01.json']: enc(JSON.stringify([{ dateTime: '01/15/20 12:00:00', value: '99' }])),
    [F + 'resting_heart_rate-2026-10-01.json']: enc(JSON.stringify([{ dateTime: '10/15/26 00:00:00', value: { date: '10/15/26', value: 57.6, error: 6 } }])),
    [F + 'heart_rate-2026-10-15.json']: enc(JSON.stringify([{ dateTime: '10/15/26 12:00:00', value: { bpm: 60, confidence: 2 } }, { dateTime: '10/15/26 12:00:05', value: { bpm: 80, confidence: 2 } }])),
    [F + 'sleep-2026-10-01.json']: enc(JSON.stringify([{ dateOfSleep: '2026-10-15', startTime: '2026-10-14T23:00:00.000', endTime: '2026-10-15T07:00:00.000', minutesAsleep: 440, levels: { summary: { deep: { minutes: 80 }, light: { minutes: 260 }, rem: { minutes: 100 }, wake: { minutes: 40 } } } }])),
    [F + 'exercise-0.json']: enc(JSON.stringify([{ logId: 1, activityName: 'Walk', startTime: '10/15/26 12:00:00', duration: 1800000, activeDuration: 1800000, calories: 150, averageHeartRate: 100, distance: 2.5, distanceUnit: 'Kilometer' }])),
    [F + 'weight-2026-10-01.json']: enc(JSON.stringify([{ weight: 160, date: '10/15/26', time: '08:00:00' }])),
    'Takeout/Fitbit/Your Profile/Profile.csv': enc('id,weight_unit\nabc,en_US\n'),
    'Takeout/Fitbit/Heart Rate Variability/Daily Heart Rate Variability Summary - 2026-10-15.csv': enc('timestamp,rmssd,nremhr,entropy\n2026-10-15,42.4,55,2.1\n'),
    'Takeout/Fitbit/Photos/cat.jpg': new Uint8Array([1, 2, 3]),
  });
  const z = await parseFiles([{ name: 'takeout-20261020.zip', data: takeout.buffer }], { now });
  const noon = z.daily.find((d) => d.date === localDay(Date.UTC(2026, 9, 15, 12)));
  assert(noon?.steps === 1234 && noon.avgHr === 70, 'takeout steps + avg hr');
  const d15 = z.daily.find((d) => d.date === '2026-10-15');
  assert(d15?.restingHr === 58 && d15.sleep?.minutes === 440 && d15.sleep.stages?.deep === 80, 'takeout resting hr + sleep');
  assert(d15?.weightKg === 72.6 && d15.hrvMs === 42.4 && d15.origin?.includes('com.fitbit.FitbitMobile'), 'takeout weight in lb + hrv csv');
  assert(!z.daily.some((d) => d.date < '2025-01-01'), 'old days dropped');
  assert(z.workouts.length === 1 && z.workouts[0].type === 'Walk' && z.workouts[0].distanceM === 2500 && z.workouts[0].source === 'takeout', 'takeout exercise');

  // Garmin export: daily summaries + sleep JSON, and a nested zip of original FIT uploads.
  const garmin = zipSync({
    'DI_CONNECT/DI-Connect-Aggregator/UDSFile_2026-10-01_2026-12-31.json': enc(JSON.stringify([{ calendarDate: '2026-10-16', totalSteps: 8000, totalDistanceMeters: 6000, activeKilocalories: 400, totalKilocalories: 2300, restingHeartRate: 52 }])),
    'DI_CONNECT/DI-Connect-Wellness/2026-10-01_2026-12-31_sleepData.json': enc(JSON.stringify([{ calendarDate: '2026-10-16', sleepStartTimestampGMT: '2026-10-15T22:00:00.0', sleepEndTimestampGMT: '2026-10-16T06:00:00.0', deepSleepSeconds: 3600, lightSleepSeconds: 18000, remSleepSeconds: 5400, awakeSleepSeconds: 1800 }])),
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0-_Part1.zip': zipSync({ 'run.fit': fit }),
  });
  const gz = await parseFiles([{ name: 'garmin.zip', data: garmin }], { now });
  const g16 = gz.daily.find((d) => d.date === '2026-10-16');
  assert(g16?.steps === 8000 && g16.totalKcal === 2300 && g16.restingHr === 52 && g16.sleep?.minutes === 450 && g16.sleep.stages?.rem === 90, 'garmin daily + sleep');
  assert(gz.workouts.length === 1 && gz.workouts[0].kcal === 400, 'garmin nested fit');

  // Dedupe against what the store already has: a Health Connect ride a minute later is the same ride.
  const existing = { 'health_connect:x': { ...tw, id: 'health_connect:x', source: 'health_connect', start: '2026-10-11T12:01:00.000Z' } };
  assert(newWorkouts(existing, [tw, gw]).length === 1, 'dedupe by start time');

  // Rubbish in, nothing out.
  const bad = await parseFiles([{ name: 'notes.txt', data: enc('hello') }, { name: 'x.fit', data: new Uint8Array(20) }], { now });
  assert(bad.workouts.length === 0 && bad.daily.length === 0 && bad.skipped === 2, 'unknown files skipped');
  console.log('ok ../src/health/importers.ts');
}

// Heart rate per set, set done times, Health Connect write helpers and watch-workout merging (src/health/parse.ts).
{
  const { splitHr, medianGap, trackDone, finishedTimes, setsText, cardioType, matchSession, isStrengthType, overlapShare } =
    await import(new URL('../src/health/parse.ts', import.meta.url));
  const assert = (ok, m) => { if (!ok) throw new Error('hr: ' + m); };
  const T0 = Date.parse('2026-11-05T10:00:00Z');
  // A 20-minute workout sampled every 5 s: 100 bpm resting, 150 in the 40 s before each tick of two sets.
  const ticks = [T0 + 5 * 60000, T0 + 10 * 60000];
  const samples = [];
  for (let t = T0; t <= T0 + 25 * 60000; t += 5000) samples.push({ t, bpm: ticks.some((d) => t > d - 40000 && t <= d) ? 150 : 100 });
  assert(medianGap(samples.map((x) => x.t)) === 5000 && medianGap([1]) === Infinity, 'median gap');
  const a = splitHr(samples, T0, T0 + 20 * 60000, [[ticks[0], ticks[1]]]);
  assert(a && !a.sparse && a.max === 150 && a.avg > 100 && a.avg < 110, 'session avg/max');
  assert(a.sets[0][0].max === 150 && a.sets[0][1].max === 150 && a.sets[0][0].avg > 120, 'per-set split');
  assert(a.rest.max === 100 && a.rest.avg === 100, 'rests');
  // Unknown done time (0) leaves that set empty; no times at all keeps only the session numbers.
  const b = splitHr(samples, T0, T0 + 20 * 60000, [[0, ticks[1]]]);
  assert(b.sets[0][0] === null && b.sets[0][1].max === 150, 'unknown tick');
  const c = splitHr(samples, T0, T0 + 20 * 60000);
  assert(c && c.sets === undefined && c.rest === undefined, 'no ticks');
  // Sparse: one sample a minute keeps only the session avg/max.
  const sparse = samples.filter((x) => (x.t - T0) % 60000 === 0);
  const d = splitHr(sparse, T0, T0 + 20 * 60000, [[ticks[0], ticks[1]]]);
  assert(d.sparse && d.sets === undefined && d.max === 150, 'sparse source');
  assert(splitHr([], T0, T0 + 1000) === null && splitHr([{ t: T0 - 1, bpm: 90 }], T0, T0 + 1000) === null, 'no samples');

  // Done times follow sets through ticks, edits, removals and finishing.
  const s1 = { reps: 8, weight: 20, done: false }, s2 = { reps: 8, weight: 20, done: false }, s3 = { reps: 8, weight: 20, done: false };
  let items = [{ sets: [s1, s2] }, { sets: [s3] }];
  let times = trackDone(undefined, items, undefined, 1);
  assert(JSON.stringify(times) === '[[0,0],[0]]', 'nothing done');
  let next = [{ sets: [{ ...s1, done: true }, s2] }, items[1]];
  times = trackDone(items, next, times, 100); items = next;
  assert(times[0][0] === 100 && times[0][1] === 0, 'tick stamps now');
  next = [{ sets: [{ ...items[0].sets[0], reps: 10 }, s2] }, items[1]];
  times = trackDone(items, next, times, 200); items = next;
  assert(times[0][0] === 100, 'edit keeps time');
  next = [{ sets: [items[0].sets[0], { ...s2, done: true }] }, { sets: [{ ...s3, done: true }] }];
  times = trackDone(items, next, times, 300); items = next;
  next = [{ sets: [items[0].sets[1]] }, items[1]]; // first set removed: the second keeps its time
  times = trackDone(items, next, times, 400); items = next;
  assert(JSON.stringify(times) === '[[300],[300]]', 'remove keeps identity');
  // Loaded from storage with no saved times: done sets stay unknown instead of getting "now".
  assert(JSON.stringify(trackDone(items, items, undefined, 999)) === '[[0],[0]]', 'no stamping on load');
  const fin = finishedTimes([{ sets: [{ done: true }, { done: false }, { done: true }] }, { sets: [{ done: false }] }, { sets: [{ done: true }] }], [[1, 2, 3], [4], [5]]);
  assert(JSON.stringify(fin) === '[[1,3],[5]]', 'finished layout');

  // Notes text and cardio type.
  const notes = setsText([
    { name: 'Bench press', timed: false, sets: [{ reps: 8, weight: 60, done: true }, { reps: 6, weight: 62.5, done: true }, { reps: 8, weight: 60, done: false }] },
    { name: 'Plank', timed: true, sets: [{ reps: 45, weight: 0, done: true }, { reps: 90, weight: 0, done: true }] },
    { name: 'Push-up', timed: false, sets: [{ reps: 12, weight: 0, done: true }] },
    { name: 'Skipped', timed: false, sets: [{ reps: 12, weight: 0, done: false }] },
  ]);
  assert(notes === 'Bench press: 60 kg × 8, 62.5 kg × 6\nPlank: 45 s, 1:30 min\nPush-up: 12 reps', 'notes text');
  assert(cardioType([{ name: 'Rowing, Stationary', amount: 600 }]) === 'ROWING_MACHINE', 'rower');
  assert(cardioType([{ name: 'Running, Treadmill', amount: 900 }, { name: 'Recumbent Bike', amount: 1200 }]) === 'BIKING_STATIONARY', 'most time wins');
  assert(cardioType([{ name: 'Jogging, Treadmill', amount: 1 }]) === 'RUNNING_TREADMILL' && cardioType([{ name: 'Walking, Treadmill', amount: 1 }]) === 'WALKING', 'treadmill');
  assert(cardioType([{ name: 'Stairmaster', amount: 1 }]) === 'STAIR_CLIMBING_MACHINE' && cardioType([{ name: 'Prowler Sprint', amount: 1 }]) === 'RUNNING', 'stairs, sprint');
  assert(cardioType([{ name: 'SkiErg', amount: 1 }]) === 'HIGH_INTENSITY_INTERVAL_TRAINING' && cardioType([]) === 'OTHER_WORKOUT', 'fallbacks');

  // Merging: a watch's strength session over most of ours merges; a run before it does not.
  const iso = (m) => new Date(T0 + m * 60000).toISOString();
  const ours = [{ id: 'a', startedAt: T0, endedAt: T0 + 60 * 60000 }, { id: 'b', startedAt: T0 + 120 * 60000, endedAt: T0 + 150 * 60000 }, { id: 'live', startedAt: T0 }];
  assert(isStrengthType('Strength training') && isStrengthType('Weightlifting') && isStrengthType('Workout') && !isStrengthType('Running'), 'strength types');
  assert(overlapShare(0, 10, 5, 20) === 0.5 && overlapShare(0, 10, 10, 20) === 0, 'overlap share');
  assert(matchSession({ type: 'Strength training', start: iso(2), end: iso(58) }, ours) === 'a', 'watch gym session merges');
  assert(matchSession({ type: 'Weightlifting', start: iso(125), end: iso(200) }, ours) === 'b', 'shorter range counts');
  assert(matchSession({ type: 'Running', start: iso(0), end: iso(60) }, ours) === undefined, 'cardio stays separate');
  assert(matchSession({ type: 'Strength training', start: iso(50), end: iso(110) }, ours) === undefined, 'small overlap stays separate');
  console.log('ok hr per set, notes, merge');
}

// History import from Strong, Hevy and FitNotes CSV, and our own "Export sets (CSV)" read back (src/importApps.ts).
(await import(new URL('../src/importApps.ts', import.meta.url))).selfCheck();
console.log('ok ../src/importApps.ts');

// Plan reasoning engine (src/planner.ts, src/data/split.ts): every profile gets a plan with exactly the days it chose,
// with reasons. Grid over goal × level × place × days × gender, then the cases from the bug report.
{
  const { planFor, explain } = await import(new URL('../src/planner.ts', import.meta.url));
  const { planById, perWeek, fitted } = await import(new URL('../src/data/plans.ts', import.meta.url));
  const { available, byId: ex } = await import(new URL('../src/data/exercises.ts', import.meta.url));
  const assert = (ok, m) => { if (!ok) throw new Error('planner: ' + m); };
  const base = { name: 'T', gender: 'male', age: 30, heightCm: 175, weightKg: 75, goalWeightKg: 75, goal: 'build muscle', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: false } };
  const prof = (x) => ({ ...base, ...x });

  // Fitted plans: stable ids, the days the id says, valid week indices, and a rotation that follows the week.
  for (const pl of fitted) {
    const m = pl.id.match(/^([a-z0-9-]+)~([1-7])(b?)$/);
    assert(m && planById[m[1]] && pl.base === m[1] && planById[pl.id] === pl, `id ${pl.id}`);
    assert(perWeek(pl) === +m[2] && pl.week.length === 7 && pl.week.every((i) => i === null || pl.days[i]), `week ${pl.id}`);
    const seq = pl.week.filter((i) => i !== null);
    assert(seq.every((i, k) => pl.days[i] === pl.days[k % pl.days.length]), `rotation ${pl.id}`);
    assert(pl.days.every((d) => d.slots.every((s) => ex[s.id])), `exercises ${pl.id}`);
    if (m[3]) assert(pl.level === 'beginner' && pl.easy, `beginner ${pl.id}`);
  }

  let cases = 0;
  for (const goal of ['build muscle', 'get stronger', 'lose fat', 'stay fit'])
    for (const level of ['beginner', 'intermediate', 'advanced'])
      for (const [place, gear] of [['gym', []], ['home', []], ['home', ['dumbbell', 'bands']], ['both', []], ['office', []]])
        for (const days of [2, 3, 4, 5, 6])
          for (const gender of ['male', 'female', 'other']) {
            const p = prof({ goal, level, place, gear, daysPerWeek: days, gender });
            const r = planFor(p);
            const pl = planById[r.planId];
            const tag = `${goal}/${level}/${place}${gear.length ? '+db' : ''}/${days}d/${gender} -> ${r.planId}`;
            assert(pl && r.reasons.length > 0 && r.reasons.every((x) => typeof x === 'string' && x.length > 0), `reasons ${tag}`);
            cases++;
            if (place === 'office') { assert(r.planId === 'desk-reset', `office ${tag}`); continue; }
            assert(perWeek(pl) === days, `exact days ${tag} (${perWeek(pl)})`);
            assert(new RegExp(`your ${days} days`).test(r.reasons[0]), `days reason first ${tag}`);
            assert(pl.category !== 'One muscle' && pl.category !== 'Recovery', `main plan ${tag}`);
            assert(pl.category !== 'Women' || gender === 'female', `women plan ${tag}`);
            assert(place !== 'gym' || pl.place !== 'home', `gym ${tag}`);
            assert(place !== 'home' || pl.place !== 'gym', `home ${tag}`);
            if (place === 'home') {
              const slots = pl.days.flatMap((d) => d.slots);
              assert(slots.filter((s) => available(ex[s.id], 'home', gear)).length / slots.length >= 0.8, `home gear ${tag}`);
            }
            if (level === 'beginner') assert(pl.level === 'beginner', `beginner level ${tag}`);
            assert(r.alternatives.every((a) => perWeek(planById[a.planId]) === days && a.reasons.length), `alternatives ${tag}`);
            assert(explain(p, r.planId).join() === r.reasons.join(), `explain matches ${tag}`);
          }

  // The bug: a beginner who picks 5 or 6 days gets 5 or 6 days, with lower volume, not a 3-day plan.
  for (const days of [5, 6]) {
    const r = planFor(prof({ daysPerWeek: days }));
    const pl = planById[r.planId];
    assert(perWeek(pl) === days && pl.level === 'beginner' && pl.easy, `beginner gym build muscle ${days}: ${r.planId}`);
    assert(r.reasons[0] === `Built for your ${days} days` && r.reasons[1] === 'Lower volume for your first weeks', `beginner reasons ${days}: ${r.reasons}`);
    if (days === 6) assert(pl.recovery === 2, 'six beginner days include two light recovery days');
  }
  const h5 = planFor(prof({ place: 'home', daysPerWeek: 5 }));
  assert(perWeek(planById[h5.planId]) === 5 && planById[h5.planId].place === 'home' && h5.reasons[0] === 'Built for your 5 days', `beginner home 5: ${h5.planId}`);
  for (const level of ['beginner', 'intermediate']) {
    const f6 = planFor(prof({ goal: 'lose fat', level, daysPerWeek: 6 }));
    assert(perWeek(planById[f6.planId]) === 6 && planById[f6.planId].tags.includes('lose fat'), `lose fat 6 ${level}: ${f6.planId}`);
  }
  // The early branches that used to force 3 days (body type, gain, endurance) now keep the chosen days too.
  for (const extra of [{ body: 'more' }, { body: 'lean' }, { concerns: ['gain'] }, { concerns: ['endurance'], goal: 'stay fit' }, { age: 64 }, { concerns: ['knee', 'back'] }])
    for (const days of [2, 4, 6]) {
      const r = planFor(prof({ ...extra, daysPerWeek: days }));
      assert(perWeek(planById[r.planId]) === days, `${JSON.stringify(extra)} ${days}d: ${r.planId}`);
    }
  // Intermediate lifters keep the curated plans when they fit.
  assert(planFor(prof({ level: 'intermediate', daysPerWeek: 6 })).planId === 'ppl-gym', 'intermediate 6 days: push pull legs');
  assert(planFor(prof({ level: 'intermediate', goal: 'get stronger', daysPerWeek: 4 })).planId === 'phul', 'intermediate strength 4 days: PHUL');
  assert(planFor(prof({ goal: 'get stronger', daysPerWeek: 3 })).planId === 'strength-5x5', 'beginner strength 3 days: 5x5');
  // Life stage still wins.
  const due = new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10);
  assert(planFor(prof({ gender: 'female', daysPerWeek: 6, women: { mode: 'pregnant', date: due } })).planId === 'pregnancy-safe', 'pregnancy wins');
  const born = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  assert(planFor(prof({ gender: 'female', daysPerWeek: 5, women: { mode: 'postpartum', date: born } })).planId === 'after-birth', 'after birth wins');
  console.log(`ok plan engine (${fitted.length} fitted plans, ${cases} profiles)`);
}
