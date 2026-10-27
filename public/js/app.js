// =====================================================================
// App state — cached settings, theme application, subscribers.
// =====================================================================

let settings = {
  theme: 'dark',
  accent: 'rust',
  weekStart: 1,
  dayStartHour: 8,
  dayEndHour: 22,
  showNowLine: true
};

const listeners = new Set();

export function getSettings() { return settings; }

export function setSettings(patch) {
  settings = Object.assign({}, settings, patch);
  applyTheme();
  for (const fn of listeners) {
    try { fn(settings); } catch (e) { console.error(e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', settings.theme);
  try { localStorage.setItem('theme', settings.theme); } catch (e) {}
}

export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem('theme');
    if (cached === 'light' || cached === 'dark') {
      document.documentElement.setAttribute('data-theme', cached);
    }
  } catch (e) {}
}

export async function loadSettings() {
  const { api } = await import('./api.js');
  const res = await api.getSettings();
  if (res && res.ok && res.data) {
    settings = Object.assign({}, settings, res.data);
    applyTheme();
  }
  return settings;
}
