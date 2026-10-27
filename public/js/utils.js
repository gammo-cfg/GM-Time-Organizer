// =====================================================================
// Utility helpers — DOM and dates. Pure functions, no side effects.
// =====================================================================

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const key in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
      const v = attrs[key];
      if (v === null || v === undefined || v === false) continue;
      if (key === 'className') node.className = v;
      else if (key === 'textContent') node.textContent = v;
      else if (key === 'innerHTML') node.innerHTML = v;
      else if (key === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
      else if (key === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (key.startsWith('on') && typeof v === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), v);
      } else if (typeof v === 'boolean') {
        if (v) node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(v));
      }
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) {
      for (const cc of c) if (cc !== null && cc !== undefined) node.appendChild(typeof cc === 'string' ? document.createTextNode(cc) : cc);
    } else if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(String(c)));
    } else {
      node.appendChild(c);
    }
  }
  return node;
}

export function pad2(n) { return n < 10 ? '0' + n : String(n); }

export function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function parseIso(iso) {
  const parts = iso.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function toIso(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function addDays(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function addMonths(iso, n) {
  const d = parseIso(iso);
  d.setMonth(d.getMonth() + n);
  return toIso(d);
}

export function weekdayIndex(iso) { return parseIso(iso).getDay(); }

export function startOfWeek(iso, weekStart) {
  const d = parseIso(iso);
  const current = d.getDay();
  const diff = ((current - weekStart) % 7 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toIso(d);
}

export function daysBetween(aIso, bIso) {
  const a = parseIso(aIso).getTime();
  const b = parseIso(bIso).getTime();
  return Math.round((b - a) / 86400000);
}

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const WEEKDAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const WEEKDAY_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function formatLongDate(iso) {
  const d = parseIso(iso);
  return WEEKDAY_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

export function formatShortDate(iso) {
  const d = parseIso(iso);
  return WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()].slice(0, 3);
}

export function timeToMinutes(hhmm) {
  const p = hhmm.split(':').map(Number);
  return p[0] * 60 + p[1];
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return pad2(h) + ':' + pad2(m);
}

export function currentMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
