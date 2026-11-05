// Runs the assert-based self-checks of the pure logic (streaks, targets, women's context, engine rules, muscles).
// Usage: node --experimental-strip-types scripts/selfcheck.mjs
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
const { byId } = await import(new URL('../src/data/exercises.ts', import.meta.url));
for (const m of ['../src/calc.ts', '../src/engine.ts', '../src/data/muscles.ts', '../src/data/order.ts', '../src/data/program.ts', '../src/data/poses.ts', '../src/data/cardio.ts', '../src/data/pairing.ts', '../src/health/parse.ts']) {
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
