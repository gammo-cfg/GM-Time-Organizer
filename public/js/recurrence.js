// =====================================================================
// Recurrence engine — pure logic, no DOM, no side effects.
// =====================================================================

import { weekdayIndex, daysBetween, addDays, formatShortDate } from './utils.js';

const WEEKDAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function occursOn(block, isoDate) {
  const rec = (block && block.recurrence) || {};
  const type = rec.type || 'none';

  if (Array.isArray(block && block.exceptions) && block.exceptions.indexOf(isoDate) !== -1) {
    return false;
  }

  if (rec.startDate && isoDate < rec.startDate) return false;
  if (rec.endDate && isoDate > rec.endDate) return false;

  if (type === 'none') {
    return rec.startDate === isoDate;
  }

  if (type === 'daily') {
    return true;
  }

  if (type === 'weekly' || type === 'custom') {
    const wd = weekdayIndex(isoDate);
    const days = Array.isArray(rec.weekdays) ? rec.weekdays : [];
    if (days.indexOf(wd) === -1) return false;

    if (type === 'custom') {
      const interval = rec.interval || 1;
      if (interval <= 1 || !rec.startDate) return true;
      const weeks = Math.floor(daysBetween(rec.startDate, isoDate) / 7);
      return weeks % interval === 0;
    }

    return true;
  }

  return false;
}

export function blocksForDate(blocks, isoDate) {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(b => occursOn(b, isoDate));
}

export function nextOccurrence(block, fromIso, maxDays) {
  const limit = maxDays || 730;
  for (let i = 0; i <= limit; i++) {
    const iso = addDays(fromIso, i);
    if (occursOn(block, iso)) return iso;
  }
  return null;
}

// Strictly-after version: never returns fromIso itself.
// Used by recurring tasks to advance to the next occurrence on check.
export function nextOccurrenceAfter(block, fromIso, maxDays) {
  const limit = maxDays || 730;
  const start = addDays(fromIso, 1);
  for (let i = 0; i <= limit; i++) {
    const iso = addDays(start, i);
    if (occursOn(block, iso)) return iso;
  }
  return null;
}

export function recurrenceLabel(rec) {
  const r = rec || {};
  const type = r.type || 'none';

  if (type === 'none') {
    return r.startDate ? 'Once on ' + formatShortDate(r.startDate) : 'Once';
  }

  if (type === 'daily') {
    return 'Every day' + rangeSuffix(r.startDate, r.endDate);
  }

  if (type === 'weekly') {
    return 'Every ' + daysLabel(r.weekdays) + rangeSuffix(r.startDate, r.endDate);
  }

  if (type === 'custom') {
    const n = r.interval || 1;
    const prefix = n === 1 ? 'Every week on ' : 'Every ' + n + ' weeks on ';
    return prefix + daysLabel(r.weekdays) + rangeSuffix(r.startDate, r.endDate);
  }

  return '';
}

function daysLabel(days) {
  if (!Array.isArray(days) || days.length === 0) return 'no days';
  return days.map(d => WEEKDAY_NAMES[d]).join(', ');
}

function rangeSuffix(from, to) {
  if (!from && !to) return '';
  if (from && to) return ' (from ' + formatShortDate(from) + ' to ' + formatShortDate(to) + ')';
  if (from) return ' (from ' + formatShortDate(from) + ')';
  return ' (until ' + formatShortDate(to) + ')';
}
