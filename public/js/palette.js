// =====================================================================
// Command palette — UI component.
// Open with openPalette({ getCommands }).
// getCommands must return Promise<Array<{ label, subtitle?, group, run }>>.
// Only one instance may be open at a time.
// =====================================================================

let active = null;

function fuzzyMatch(query, text) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = (text || '').toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t.charAt(i) === q.charAt(qi)) qi++;
  }
  return qi === q.length;
}

export async function openPalette(options) {
  if (active) return;
  const getCommands = options.getCommands;
  const onClose = options.onClose || null;

  const backdrop = document.createElement('div');
  backdrop.className = 'palette-backdrop';

  const palette = document.createElement('div');
  palette.className = 'palette';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'palette-search';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type to search blocks, tasks, habits, and commands\u2026';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const kbd = document.createElement('span');
  kbd.className = 'palette-kbd';
  kbd.textContent = 'Esc';

  searchWrap.appendChild(input);
  searchWrap.appendChild(kbd);
  palette.appendChild(searchWrap);

  const results = document.createElement('div');
  results.className = 'palette-results';
  palette.appendChild(results);

  backdrop.appendChild(palette);
  document.body.appendChild(backdrop);

  let commands = [];
  let filtered = [];
  let highlightedIndex = 0;

  function close() {
    if (active !== backdrop) return;
    document.removeEventListener('keydown', onKeydown, true);
    backdrop.remove();
    active = null;
    if (onClose) { try { onClose(); } catch (e) { console.error(e); } }
  }

  function renderList() {
    results.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'palette-empty';
      empty.textContent = commands.length === 0 ? 'Loading\u2026' : 'No matches';
      results.appendChild(empty);
      return;
    }

    const groups = new Map();
    for (let i = 0; i < filtered.length; i++) {
      const cmd = filtered[i];
      const g = cmd.group || 'Commands';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(cmd);
    }

    let flatIdx = 0;
    groups.forEach(function (items, groupName) {
      const title = document.createElement('div');
      title.className = 'palette-group-title';
      title.textContent = groupName;
      results.appendChild(title);

      for (let j = 0; j < items.length; j++) {
        const cmd = items[j];
        (function (c, idxAtBuild) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'palette-item' + (idxAtBuild === highlightedIndex ? ' is-highlighted' : '');
          btn.dataset.idx = String(idxAtBuild);

          const main = document.createElement('div');
          main.className = 'palette-item-main';

          const label = document.createElement('div');
          label.className = 'palette-item-label';
          label.textContent = c.label || '';
          main.appendChild(label);

          if (c.subtitle) {
            const sub = document.createElement('div');
            sub.className = 'palette-item-subtitle';
            sub.textContent = c.subtitle;
            main.appendChild(sub);
          }
          btn.appendChild(main);

          if (c.hint) {
            const hint = document.createElement('span');
            hint.className = 'palette-item-hint';
            hint.textContent = c.hint;
            btn.appendChild(hint);
          }

          btn.addEventListener('mouseenter', function () {
            highlightedIndex = idxAtBuild;
            paintHighlight();
          });
          btn.addEventListener('click', function () {
            runCommand(c);
          });

          results.appendChild(btn);
        })(cmd, flatIdx);
        flatIdx++;
      }
    });

    const hl = results.querySelector('.palette-item.is-highlighted');
    if (hl) hl.scrollIntoView({ block: 'nearest' });
  }

  function paintHighlight() {
    const items = results.querySelectorAll('.palette-item');
    for (let i = 0; i < items.length; i++) {
      const idx = parseInt(items[i].dataset.idx, 10);
      items[i].classList.toggle('is-highlighted', idx === highlightedIndex);
    }
  }

  function runCommand(cmd) {
    if (!cmd) return;
    close();
    try { cmd.run(); } catch (e) { console.error(e); }
  }

  function applyFilter(query) {
    const q = query.trim();
    if (!q) {
      filtered = commands.slice();
    } else {
      filtered = commands.filter(function (c) {
        return fuzzyMatch(q, c.label) || fuzzyMatch(q, c.subtitle) || fuzzyMatch(q, c.group);
      });
    }
    highlightedIndex = 0;
    renderList();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      highlightedIndex = (highlightedIndex + 1) % filtered.length;
      paintHighlight();
      const hl = results.querySelector('.palette-item.is-highlighted');
      if (hl) hl.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      highlightedIndex = (highlightedIndex - 1 + filtered.length) % filtered.length;
      paintHighlight();
      const hl = results.querySelector('.palette-item.is-highlighted');
      if (hl) hl.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightedIndex]) runCommand(filtered[highlightedIndex]);
      return;
    }
  }

  input.addEventListener('input', function () { applyFilter(input.value); });
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown, true);

  active = backdrop;
  input.focus();
  renderList();

  try {
    commands = await getCommands();
  } catch (e) {
    console.error('Palette load failed', e);
    commands = [];
  }
  if (active !== backdrop) return;
  applyFilter(input.value);
}
