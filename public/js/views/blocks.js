// =====================================================================
// Blocks list view — grouped by Today / Upcoming / Past.
// =====================================================================

import { api } from '../api.js';
import { toast, confirm } from '../ui.js';
import { todayIso, formatShortDate, escapeHtml } from '../utils.js';
import { nextOccurrence, recurrenceLabel } from '../recurrence.js';
import { openBlockModal } from '../block-editor.js';

export async function blocksView({ outlet, setTopbar }) {
  let categories = [];
  let blocks = [];
  const today = todayIso();

  setTopbar('Blocks', (actions) => {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.type = 'button';
    addBtn.textContent = '+ Block';
    addBtn.addEventListener('click', () => openEditor(null));
    actions.appendChild(addBtn);
  });

  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function refresh() {
    const [cRes, bRes] = await Promise.all([
      api.list('categories'),
      api.list('blocks')
    ]);
    categories = (cRes && cRes.data) || [];
    blocks = (bRes && bRes.data) || [];
    render();
  }

  function openEditor(existing) {
    openBlockModal({
      categories: categories,
      existing: existing,
      defaultDate: today,
      onSave: () => { refresh(); }
    });
  }

  async function onDelete(b) {
    const ok = await confirm('Delete block', 'Delete "' + b.title + '"?');
    if (!ok) return;
    try {
      await api.remove('blocks', b.id);
      await refresh();
      toast('Block deleted.', 'success');
    } catch (e) {
      toast('Could not delete: ' + (e && e.message ? e.message : 'error'), 'danger');
    }
  }

  function render() {
    stack.innerHTML = '';

    if (blocks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const t = document.createElement('div');
      t.className = 'empty-title';
      t.textContent = 'No blocks yet';
      const b = document.createElement('div');
      b.className = 'empty-body';
      b.textContent = 'Time blocks appear on your daily timeline. Create one to get started.';
      empty.appendChild(t);
      empty.appendChild(b);
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Create first block';
      btn.style.marginTop = 'var(--sp-4)';
      btn.addEventListener('click', () => openEditor(null));
      empty.appendChild(btn);
      stack.appendChild(empty);
      return;
    }

    const sorted = blocks.slice().sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    const groups = { today: [], upcoming: [], past: [] };
    for (const b of sorted) {
      const next = nextOccurrence(b, today);
      if (next === today) groups.today.push({ b: b, next: next });
      else if (next) groups.upcoming.push({ b: b, next: next });
      else groups.past.push({ b: b, next: null });
    }

    function buildSection(title, items) {
      if (items.length === 0) return null;
      const wrap = document.createElement('div');
      const h = document.createElement('div');
      h.className = 'task-section-title';
      h.textContent = title;
      wrap.appendChild(h);

      const card = document.createElement('div');
      card.className = 'card';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const b = item.b;
        const cat = b.categoryId ? categories.find(c => c.id === b.categoryId) : null;

        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto auto;gap:var(--sp-4);align-items:center;padding:var(--sp-3) var(--sp-5);border-bottom:' + (i === items.length - 1 ? 'none' : '1px solid var(--border-soft)') + ';';

        const dot = document.createElement('span');
        dot.style.cssText = 'width:12px;height:12px;border-radius:var(--r-xs);background:' + (cat ? cat.color : 'var(--text-faint)') + ';flex-shrink:0;';
        row.appendChild(dot);

        const main = document.createElement('div');
        main.style.minWidth = '0';
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:var(--fs-13);font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        titleEl.textContent = b.title;
        main.appendChild(titleEl);

        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:var(--fs-11);color:var(--text-muted);margin-top:2px;';
        let metaText = b.start + ' \u2013 ' + b.end + '  \u00B7  ' + recurrenceLabel(b.recurrence);
        if (cat) metaText += '  \u00B7  ' + cat.name;
        meta.textContent = metaText;
        main.appendChild(meta);

        row.appendChild(main);

        const badge = document.createElement('span');
        if (item.next === today) { badge.className = 'badge success'; badge.textContent = 'Today'; }
        else if (item.next) { badge.className = 'badge'; badge.textContent = formatShortDate(item.next); }
        else { badge.className = 'badge danger'; badge.textContent = 'Past'; }
        row.appendChild(badge);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:var(--sp-1);';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn ghost sm';
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditor(b));
        actions.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'btn ghost sm';
        delBtn.type = 'button';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => onDelete(b));
        actions.appendChild(delBtn);
        row.appendChild(actions);

        card.appendChild(row);
      }

      wrap.appendChild(card);
      return wrap;
    }

    const s1 = buildSection('Today', groups.today);
    if (s1) stack.appendChild(s1);
    const s2 = buildSection('Upcoming', groups.upcoming);
    if (s2) stack.appendChild(s2);
    const s3 = buildSection('Past', groups.past);
    if (s3) stack.appendChild(s3);
  }

  try {
    await refresh();
  } catch (e) {
    stack.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    const t = document.createElement('div');
    t.className = 'empty-title';
    t.textContent = 'Could not load blocks';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
