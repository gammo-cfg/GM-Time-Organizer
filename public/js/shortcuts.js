// =====================================================================
// Global keyboard shortcuts.
// Rules:
//   - Ignore when typing in an input/textarea/select or contentEditable
//   - Ignore when a modal or the palette is open
//   - Ignore when Ctrl / Meta / Alt is held (Ctrl+K is handled elsewhere)
//   - Two-key sequences g <letter> must be typed within 1.5s
// =====================================================================

import { openHelp } from './help.js';
import { newBlock, newTask, newHabit } from './actions.js';

let pendingPrefix = '';
let pendingTimer = null;

function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

function isModalOpen() {
  return !!document.querySelector('.palette-backdrop, .modal-backdrop');
}

function clearPending() {
  pendingPrefix = '';
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
}

function startPending(prefix) {
  pendingPrefix = prefix;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(clearPending, 1500);
}

const SEQUENCES = {
  'd': '/today',
  'w': '/week',
  'm': '/month',
  't': '/tasks',
  'h': '/habits',
  's': '/stats',
  'b': '/blocks',
  'c': '/categories',
  ',': '/settings'
};

function contextualNew() {
  const route = (location.hash || '').replace(/^#/, '').split('?')[0];
  if (route === '/tasks') { newTask(); return; }
  if (route === '/habits') { newHabit(); return; }
  newBlock();
}

export function wireShortcuts() {
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isModalOpen()) return;
    if (isTyping()) return;

    const key = e.key;
    if (!key) return;

    if (!pendingPrefix) {
      if (key === '?') {
        e.preventDefault();
        openHelp();
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        startPending('g');
        return;
      }
      if (key === 'n') {
        e.preventDefault();
        contextualNew();
        return;
      }
      return;
    }

    if (pendingPrefix === 'g') {
      const target = SEQUENCES[key];
      clearPending();
      if (target) {
        e.preventDefault();
        location.hash = '#' + target;
      }
    }
  });
}
