'use strict';

/**
 * Per-entity input validators.
 * Every validator returns a NEW object containing only the allowed fields.
 */

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.code = 'validation_error';
    this.field = field || null;
  }
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function str(v, field, opts) {
  opts = opts || {};
  const required = opts.required !== false;
  const max = opts.max === undefined ? 1000 : opts.max;
  const min = opts.min === undefined ? 0 : opts.min;
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(field + ' is required', field);
    return '';
  }
  if (typeof v !== 'string') throw new ValidationError(field + ' must be a string', field);
  if (v.length < min) throw new ValidationError(field + ' is too short', field);
  if (v.length > max) throw new ValidationError(field + ' is too long', field);
  return v;
}

function color(v, field) {
  if (typeof v !== 'string' || !HEX_RE.test(v)) {
    throw new ValidationError(field + ' must be a #RRGGBB color', field);
  }
  return v.toLowerCase();
}

function dateVal(v, field, opts) {
  opts = opts || {};
  const required = opts.required === true;
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(field + ' is required', field);
    return null;
  }
  if (typeof v !== 'string' || !DATE_RE.test(v)) {
    throw new ValidationError(field + ' must be YYYY-MM-DD', field);
  }
  return v;
}

function timeVal(v, field) {
  if (typeof v !== 'string' || !TIME_RE.test(v)) {
    throw new ValidationError(field + ' must be HH:MM (00:00-23:59)', field);
  }
  return v;
}

function bool(v, field, fallback) {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw new ValidationError(field + ' must be a boolean', field);
  return v;
}

function int(v, field, opts) {
  opts = opts || {};
  if (v === undefined || v === null) return opts.fallback;
  if (!Number.isInteger(v)) throw new ValidationError(field + ' must be an integer', field);
  if (opts.min !== undefined && v < opts.min) throw new ValidationError(field + ' must be >= ' + opts.min, field);
  if (opts.max !== undefined && v > opts.max) throw new ValidationError(field + ' must be <= ' + opts.max, field);
  return v;
}

function weekdays(v, field) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new ValidationError(field + ' must be an array', field);
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const d = v[i];
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new ValidationError(field + ' must contain integers 0..6', field);
    }
    if (out.indexOf(d) === -1) out.push(d);
  }
  return out.sort(function (a, b) { return a - b; });
}

function pickEnum(v, field, allowed, fallback) {
  if (v === undefined || v === null) return fallback;
  if (allowed.indexOf(v) === -1) {
    throw new ValidationError(field + ' must be one of ' + allowed.join('|'), field);
  }
  return v;
}

function requireObject(v) {
  if (!isPlainObject(v)) throw new ValidationError('body must be a JSON object');
}

function validateCategory(input) {
  requireObject(input);
  return {
    name: str(input.name, 'name', { min: 1, max: 60 }),
    color: color(input.color, 'color')
  };
}

function validateRecurrence(r) {
  if (r === undefined || r === null) {
    return { type: 'none', weekdays: [], interval: 1, startDate: null, endDate: null };
  }
  if (!isPlainObject(r)) throw new ValidationError('recurrence must be an object', 'recurrence');
  const type = pickEnum(r.type, 'recurrence.type', ['none', 'daily', 'weekly', 'custom'], 'none');
  return {
    type: type,
    weekdays: (type === 'weekly' || type === 'custom') ? weekdays(r.weekdays, 'recurrence.weekdays') : [],
    interval: int(r.interval, 'recurrence.interval', { min: 1, max: 12, fallback: 1 }),
    startDate: dateVal(r.startDate, 'recurrence.startDate'),
    endDate: dateVal(r.endDate, 'recurrence.endDate')
  };
}

function validateBlock(input) {
  requireObject(input);
  const start = timeVal(input.start, 'start');
  const end = timeVal(input.end, 'end');
  if (start >= end) throw new ValidationError('end must be after start', 'end');
  const exceptions = Array.isArray(input.exceptions)
    ? input.exceptions.map(function (d, i) { return dateVal(d, 'exceptions[' + i + ']', { required: true }); })
    : [];
  return {
    title: str(input.title, 'title', { min: 1, max: 120 }),
    notes: str(input.notes, 'notes', { required: false, max: 2000 }),
    categoryId: (input.categoryId === undefined || input.categoryId === null || input.categoryId === '')
      ? null
      : str(input.categoryId, 'categoryId', { max: 64 }),
    start: start,
    end: end,
    recurrence: validateRecurrence(input.recurrence),
    exceptions: exceptions
  };
}

function validateCompletedDates(arr) {
  if (arr === undefined || arr === null) return [];
  if (!Array.isArray(arr)) throw new ValidationError('completedDates must be an array', 'completedDates');
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i];
    if (typeof d !== 'string' || !DATE_RE.test(d)) {
      throw new ValidationError('completedDates[' + i + '] must be YYYY-MM-DD', 'completedDates');
    }
    out.push(d);
  }
  out.sort();
  if (out.length > 200) out.splice(0, out.length - 200);
  return out;
}

function validateTask(input) {
  requireObject(input);
  const recurrence = validateRecurrence(input.recurrence);
  const completedDates = validateCompletedDates(input.completedDates);
  return {
    title: str(input.title, 'title', { min: 1, max: 200 }),
    notes: str(input.notes, 'notes', { required: false, max: 2000 }),
    categoryId: (input.categoryId === undefined || input.categoryId === null || input.categoryId === '')
      ? null
      : str(input.categoryId, 'categoryId', { max: 64 }),
    dueDate: dateVal(input.dueDate, 'dueDate'),
    priority: pickEnum(input.priority, 'priority', ['low', 'normal', 'high'], 'normal'),
    done: bool(input.done, 'done', false),
    recurrence: recurrence,
    completedDates: completedDates,
    order: int(input.order, 'order', { min: 0, max: 100000, fallback: 0 })
  };
}

function validateHabit(input) {
  requireObject(input);
  const logs = {};
  if (input.logs !== undefined && input.logs !== null) {
    if (!isPlainObject(input.logs)) throw new ValidationError('logs must be an object', 'logs');
    const keys = Object.keys(input.logs);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!DATE_RE.test(k)) throw new ValidationError('logs key must be YYYY-MM-DD: ' + k, 'logs');
      if (typeof input.logs[k] !== 'boolean') throw new ValidationError('logs.' + k + ' must be boolean', 'logs.' + k);
      logs[k] = input.logs[k];
    }
  }
  return {
    title: str(input.title, 'title', { min: 1, max: 120 }),
    weekdays: weekdays(input.weekdays, 'weekdays'),
    color: color(input.color, 'color'),
    logs: logs
  };
}

function validateTemplate(input) {
  requireObject(input);
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.map(function (b) { return validateBlock(b); })
    : [];
  return {
    name: str(input.name, 'name', { min: 1, max: 80 }),
    blocks: blocks
  };
}

function validateSettings(input) {
  requireObject(input);
  return {
    theme: pickEnum(input.theme, 'theme', ['light', 'dark'], 'dark'),
    accent: pickEnum(input.accent, 'accent', ['rust', 'forest', 'slate'], 'rust'),
    weekStart: int(input.weekStart, 'weekStart', { min: 0, max: 6, fallback: 1 }),
    dayStartHour: int(input.dayStartHour, 'dayStartHour', { min: 0, max: 23, fallback: 8 }),
    dayEndHour: int(input.dayEndHour, 'dayEndHour', { min: 1, max: 24, fallback: 22 }),
    showNowLine: bool(input.showNowLine, 'showNowLine', true)
  };
}

module.exports = {
  ValidationError: ValidationError,
  ID_RE: ID_RE,
  validators: {
    categories: validateCategory,
    blocks: validateBlock,
    tasks: validateTask,
    habits: validateHabit,
    templates: validateTemplate,
    settings: validateSettings
  }
};
