// =====================================================================
// Recurrence engine test harness.
// Imports the browser ES module from Node (Node 22+ auto-detects ESM).
// Run: node scripts/test-recurrence.mjs
// =====================================================================

import { occursOn, blocksForDate, nextOccurrence, recurrenceLabel } from '../public/js/recurrence.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(desc, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log('PASS  ' + desc);
  } else {
    failed++;
    failures.push({ desc: desc, actual: actual, expected: expected });
    console.log('FAIL  ' + desc + '   expected=' + e + '   got=' + a);
  }
}

function mkBlock(rec, exceptions) {
  return {
    id: 'x',
    title: 't',
    start: '08:00',
    end: '09:00',
    recurrence: rec,
    exceptions: exceptions || []
  };
}

// Type 'none'
const noneBlock = mkBlock({ type: 'none', weekdays: [], interval: 1, startDate: '2026-10-26', endDate: null });
check('none: matches its date', occursOn(noneBlock, '2026-10-26'), true);
check('none: excludes other date', occursOn(noneBlock, '2026-10-27'), false);

// Type 'daily'
const dailyBlock = mkBlock({ type: 'daily', weekdays: [], interval: 1, startDate: null, endDate: null });
check('daily: matches today', occursOn(dailyBlock, '2026-10-26'), true);
check('daily: matches distant date', occursOn(dailyBlock, '2030-06-15'), true);

// Type 'daily' with range
const dailyRanged = mkBlock({ type: 'daily', weekdays: [], interval: 1, startDate: '2026-10-01', endDate: '2026-10-31' });
check('daily+range: matches start date', occursOn(dailyRanged, '2026-10-01'), true);
check('daily+range: matches end date', occursOn(dailyRanged, '2026-10-31'), true);
check('daily+range: excludes before', occursOn(dailyRanged, '2026-09-30'), false);
check('daily+range: excludes after', occursOn(dailyRanged, '2026-11-01'), false);

// Type 'weekly' on Mon(1), Wed(3), Fri(5)
const weekly = mkBlock({ type: 'weekly', weekdays: [1,3,5], interval: 1, startDate: null, endDate: null });
check('weekly: Mon 2026-10-26 matches', occursOn(weekly, '2026-10-26'), true);
check('weekly: Tue 2026-10-27 excluded', occursOn(weekly, '2026-10-27'), false);
check('weekly: Wed 2026-10-28 matches', occursOn(weekly, '2026-10-28'), true);
check('weekly: Fri 2026-10-30 matches', occursOn(weekly, '2026-10-30'), true);
check('weekly: Sat 2026-10-31 excluded', occursOn(weekly, '2026-10-31'), false);

// Type 'custom' every 2 weeks, Mon+Wed, anchored Mon 2026-10-26
const custom = mkBlock({ type: 'custom', weekdays: [1,3], interval: 2, startDate: '2026-10-26', endDate: null });
check('custom: week 0 Mon 2026-10-26 matches', occursOn(custom, '2026-10-26'), true);
check('custom: week 0 Wed 2026-10-28 matches', occursOn(custom, '2026-10-28'), true);
check('custom: week 1 Mon 2026-11-02 excluded', occursOn(custom, '2026-11-02'), false);
check('custom: week 1 Wed 2026-11-04 excluded', occursOn(custom, '2026-11-04'), false);
check('custom: week 2 Mon 2026-11-09 matches', occursOn(custom, '2026-11-09'), true);
check('custom: week 2 Wed 2026-11-11 matches', occursOn(custom, '2026-11-11'), true);

// Exceptions
const withExc = mkBlock({ type: 'daily', weekdays: [], interval: 1, startDate: null, endDate: null }, ['2026-10-27']);
check('exception: normal day matches', occursOn(withExc, '2026-10-26'), true);
check('exception: excluded day', occursOn(withExc, '2026-10-27'), false);
check('exception: day after excluded', occursOn(withExc, '2026-10-28'), true);

// blocksForDate
const pool = [weekly, dailyRanged, custom, noneBlock];
check('blocksForDate: count on Wed 2026-10-28', blocksForDate(pool, '2026-10-28').length, 3);
check('blocksForDate: count on Sun 2026-11-01', blocksForDate(pool, '2026-11-01').length, 0);

// nextOccurrence
check('nextOccurrence: none from today', nextOccurrence(noneBlock, '2026-10-26'), '2026-10-26');
check('nextOccurrence: from tomorrow', nextOccurrence(noneBlock, '2026-10-27'), null);

// recurrenceLabel
check('label: none starts with Once', recurrenceLabel({ type: 'none', startDate: '2026-10-26' }).indexOf('Once') === 0, true);
check('label: weekly mentions day', recurrenceLabel({ type: 'weekly', weekdays: [1,3] }).indexOf('Mon') !== -1, true);
check('label: custom mentions interval', recurrenceLabel({ type: 'custom', weekdays: [1], interval: 2, startDate: '2026-10-26' }).indexOf('2 weeks') !== -1, true);

console.log('');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);

if (failed > 0) {
  console.log('RESULT: FAILED');
  for (const f of failures) {
    console.log('  - ' + f.desc + '  expected=' + JSON.stringify(f.expected) + '  got=' + JSON.stringify(f.actual));
  }
  process.exit(1);
} else {
  console.log('RESULT: ALL PASS');
  process.exit(0);
}
