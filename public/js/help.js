// =====================================================================
// Help overlay — lists every keyboard shortcut. Opened with '?'.
// =====================================================================

import { openModal } from './ui.js';

const ROWS = [
  { section: 'Navigation' },
  { keys: ['Ctrl', 'K'], desc: 'Open command palette' },
  { keys: ['g', 'd'],    desc: 'Go to Today' },
  { keys: ['g', 'w'],    desc: 'Go to Week' },
  { keys: ['g', 'm'],    desc: 'Go to Month' },
  { keys: ['g', 't'],    desc: 'Go to Tasks' },
  { keys: ['g', 'h'],    desc: 'Go to Habits' },
  { keys: ['g', 's'],    desc: 'Go to Stats' },
  { keys: ['g', 'b'],    desc: 'Go to Blocks' },
  { keys: ['g', 'c'],    desc: 'Go to Categories' },
  { keys: ['g', ','],    desc: 'Go to Settings' },
  { section: 'Actions' },
  { keys: ['n'],         desc: 'New item for the current view (block / task / habit)' },
  { section: 'Help' },
  { keys: ['?'],         desc: 'Show this help' },
  { keys: ['Esc'],       desc: 'Close dialogs and palette' }
];

export function openHelp() {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:1px;font-size:var(--fs-13);';

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];

    if (row.section) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:var(--fs-10);letter-spacing:var(--ls-wide);text-transform:uppercase;font-weight:600;color:var(--text-faint);margin:var(--sp-3) 0 var(--sp-1);';
      h.textContent = row.section;
      body.appendChild(h);
      continue;
    }

    const line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-2) 0;border-bottom:1px solid var(--border-soft);';

    const keysWrap = document.createElement('div');
    keysWrap.style.cssText = 'display:flex;gap:4px;min-width:90px;flex-shrink:0;';
    for (let k = 0; k < row.keys.length; k++) {
      const kbd = document.createElement('span');
      kbd.className = 'kbd';
      kbd.textContent = row.keys[k];
      keysWrap.appendChild(kbd);
    }

    const desc = document.createElement('div');
    desc.style.cssText = 'color:var(--text-muted);font-size:var(--fs-13);';
    desc.textContent = row.desc;

    line.appendChild(keysWrap);
    line.appendChild(desc);
    body.appendChild(line);
  }

  const note = document.createElement('p');
  note.style.cssText = 'margin-top:var(--sp-4);font-size:var(--fs-11);color:var(--text-faint);';
  note.textContent = 'Sequences like g d must be typed quickly — press g, then the next key within 1.5 seconds.';
  body.appendChild(note);

  openModal({
    title: 'Keyboard shortcuts',
    body: body,
    actions: [{ label: 'Close', variant: 'primary', value: true }]
  });
}
