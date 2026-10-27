// =====================================================================
// App bootstrap — v3. Topbar eyebrow removed per craft floor.
// =====================================================================

import { createRouter } from './router.js';
import { applyCachedTheme, loadSettings } from './app.js';
import { api } from './api.js';
import { openPalette } from './palette.js';
import { getPaletteCommands } from './commands.js';
import { wireShortcuts } from './shortcuts.js';
import { settingsView } from './views/settings.js';
import { categoriesView } from './views/categories.js';
import { blocksView } from './views/blocks.js';
import { templatesView } from './views/templates.js';
import { todayView } from './views/today.js';
import { weekView } from './views/week.js';
import { monthView } from './views/month.js';
import { tasksView } from './views/tasks.js';
import { habitsView } from './views/habits.js';
import { statsView } from './views/stats.js';

applyCachedTheme();

const outlet = document.getElementById('outlet');
const topbar = document.getElementById('topbar');

function setTopbar(title, actions) {
  topbar.innerHTML = '';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'topbar-title';
  const h1 = document.createElement('h1');
  h1.textContent = title || '';
  titleWrap.appendChild(h1);
  topbar.appendChild(titleWrap);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'topbar-actions';
  if (typeof actions === 'function') {
    try { actions(actionsWrap); } catch (e) { console.error(e); }
  }

  const themeToggle = document.createElement('div');
  themeToggle.className = 'seg';
  themeToggle.setAttribute('role', 'group');
  themeToggle.setAttribute('aria-label', 'Theme');
  const lightBtn = document.createElement('button');
  lightBtn.className = 'seg-btn';
  lightBtn.type = 'button';
  lightBtn.textContent = 'Light';
  lightBtn.setAttribute('data-set', 'light');
  const darkBtn = document.createElement('button');
  darkBtn.className = 'seg-btn';
  darkBtn.type = 'button';
  darkBtn.textContent = 'Dark';
  darkBtn.setAttribute('data-set', 'dark');
  themeToggle.appendChild(lightBtn);
  themeToggle.appendChild(darkBtn);

  function paintTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    lightBtn.classList.toggle('is-on', current === 'light');
    darkBtn.classList.toggle('is-on', current === 'dark');
  }
  async function chooseTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    paintTheme();
    try {
      const res = await api.patchSettings({ theme: theme });
      const mod = await import('./app.js');
      mod.setSettings(res.data);
    } catch (e) {
      console.error('Could not persist theme', e);
    }
  }
  lightBtn.addEventListener('click', () => chooseTheme('light'));
  darkBtn.addEventListener('click', () => chooseTheme('dark'));
  paintTheme();

  actionsWrap.appendChild(themeToggle);
  topbar.appendChild(actionsWrap);
}

function wireRail() {
  const items = document.querySelectorAll('.rail-nav-item[data-route]');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = '#' + item.getAttribute('data-route');
    });
  }
}

function setActiveRoute(route) {
  const all = document.querySelectorAll('.rail-nav-item[data-route]');
  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    item.classList.toggle('is-active', item.getAttribute('data-route') === route);
  }
}

async function loadRailCategories() {
  const box = document.getElementById('rail-categories');
  if (!box) return;
  box.innerHTML = '';
  let cats = [];
  try {
    const res = await api.list('categories');
    cats = (res && res.data) || [];
  } catch (e) {
    console.error('Could not load categories', e);
  }

  if (cats.length === 0) {
    const link = document.createElement('a');
    link.className = 'rail-nav-item';
    link.href = '#/categories';
    link.style.color = 'var(--text-faint)';
    link.style.fontStyle = 'italic';
    link.textContent = 'Manage categories\u2026';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = '#/categories';
    });
    box.appendChild(link);
    return;
  }

  for (const cat of cats) {
    const a = document.createElement('a');
    a.className = 'rail-nav-item';
    a.href = '#/categories';
    const dot = document.createElement('span');
    dot.className = 'rail-dot';
    dot.style.background = cat.color;
    a.appendChild(dot);
    a.appendChild(document.createTextNode(cat.name));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = '#/categories';
    });
    box.appendChild(a);
  }
}

function wirePalette() {
  const isMac = navigator.platform && /Mac/i.test(navigator.platform);
  document.addEventListener('keydown', function (e) {
    const key = e.key ? e.key.toLowerCase() : '';
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && key === 'k') {
      e.preventDefault();
      openPalette({ getCommands: getPaletteCommands });
    }
  });
}

async function boot() {
  try { await loadSettings(); }
  catch (e) { console.error('Could not load settings', e); }

  wireRail();
  wirePalette();
  wireShortcuts();
  await loadRailCategories();

  document.addEventListener('categories:changed', loadRailCategories);

  const router = createRouter({
    outlet: outlet,
    setTopbar: setTopbar,
    fallback: '/today',
    onRouteChange: setActiveRoute,
    routes: {
      '/today': todayView,
      '/day': todayView,
      '/week': weekView,
      '/month': monthView,
      '/blocks': blocksView,
      '/templates': templatesView,
      '/tasks': tasksView,
      '/habits': habitsView,
      '/stats': statsView,
      '/categories': categoriesView,
      '/settings': settingsView
    }
  });

  router.start();
}

boot();
