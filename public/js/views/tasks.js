// =====================================================================
// Tasks view — v3. Real SVG icons for edit and delete actions.
// All other behavior unchanged from v2.2.1.
// =====================================================================

import { api } from '../api.js';
import { toast, confirm } from '../ui.js';
import { icon } from '../icons.js';
import { openTaskModal } from '../task-editor.js';
import { nextOccurrenceAfter } from '../recurrence.js';
import { todayIso, formatShortDate } from '../utils.js';

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

function priorityRank(p) {
  return PRIORITY_RANK[p] !== undefined ? PRIORITY_RANK[p] : 1;
}

export async function tasksView({ outlet, setTopbar }) {
  let categories = [];
  let tasks = [];
  let filterCategory = '';
  let sortBy = 'manual';
  let showDone = false;
  let dragEndedAt = 0;

  setTopbar('Tasks', (actions) => {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.type = 'button';
    addBtn.textContent = '+ Task';
    addBtn.addEventListener('click', () => openEditor(null));
    actions.appendChild(addBtn);
  });

  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const [c, t] = await Promise.all([api.list('categories'), api.list('tasks')]);
    categories = (c && c.data) || [];
    tasks = (t && t.data) || [];
  }

  function openEditor(existing) {
    openTaskModal({
      categories: categories,
      existing: existing || null,
      onSave: async () => { await load(); render(); }
    });
  }

  async function toggleDone(task) {
    const rec = task.recurrence || { type: 'none' };
    const isRecurring = rec.type !== 'none';

    if (!isRecurring) {
      try {
        await api.update('tasks', task.id, Object.assign({}, task, { done: !task.done }));
        await load();
        render();
      } catch (e) {
        toast('Could not toggle: ' + (e && e.message ? e.message : 'error'), 'danger');
      }
      return;
    }

    const completedDate = task.dueDate || todayIso();
    const completedDates = Array.isArray(task.completedDates) ? task.completedDates.slice() : [];
    if (completedDates.indexOf(completedDate) === -1) completedDates.push(completedDate);

    const anchor = { recurrence: rec, exceptions: [] };
    const next = nextOccurrenceAfter(anchor, completedDate);

    const updated = Object.assign({}, task, {
      dueDate: next || completedDate,
      done: next === null,
      completedDates: completedDates
    });

    try {
      await api.update('tasks', task.id, updated);
      if (next) {
        toast('Task done. Next: ' + formatShortDate(next), 'success');
      } else {
        toast('Recurring task series complete.', 'success');
      }
      await load();
      render();
    } catch (e) {
      toast('Could not toggle: ' + (e && e.message ? e.message : 'error'), 'danger');
    }
  }

  async function onDelete(task) {
    const ok = await confirm('Delete task', 'Delete "' + task.title + '"?');
    if (!ok) return;
    try {
      await api.remove('tasks', task.id);
      await load();
      render();
      toast('Task deleted.', 'success');
    } catch (e) {
      toast('Could not delete: ' + (e && e.message ? e.message : 'error'), 'danger');
    }
  }

  function compareTasks(a, b) {
    if (sortBy === 'manual') {
      const oa = typeof a.order === 'number' ? a.order : 0;
      const ob = typeof b.order === 'number' ? b.order : 0;
      if (oa !== ob) return oa - ob;
      const da = a.dueDate || '9999-12-31';
      const db = b.dueDate || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    }
    if (sortBy === 'due') {
      const da = a.dueDate || '9999-12-31';
      const db = b.dueDate || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    }
    if (sortBy === 'priority') {
      const diff = priorityRank(a.priority) - priorityRank(b.priority);
      if (diff !== 0) return diff;
      const da = a.dueDate || '9999-12-31';
      const db = b.dueDate || '9999-12-31';
      return da < db ? -1 : (da > db ? 1 : 0);
    }
    return a.title.localeCompare(b.title);
  }

  async function persistOrder(reordered) {
    if (sortBy !== 'manual') sortBy = 'manual';
    let updates = 0;
    try {
      for (let i = 0; i < reordered.length; i++) {
        const t = reordered[i];
        const oldOrder = typeof t.order === 'number' ? t.order : 0;
        if (oldOrder === i) continue;
        const payload = Object.assign({}, t, { order: i });
        await api.update('tasks', t.id, payload);
        updates++;
      }
      await load();
      render();
      if (updates > 0) toast('Task reordered.', 'success');
    } catch (e) {
      toast('Reorder failed: ' + (e && e.message ? e.message : 'error'), 'danger');
      await load();
      render();
    }
  }

  function makeListReorderable(listEl, sectionTasks) {
    let state = null;
    let indicator = null;

    function clearIndicator() {
      if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator);
      indicator = null;
    }

    function getDropTarget(e) {
      const rows = Array.from(listEl.querySelectorAll('.task-row:not(.is-dragging)'));
      let closest = null;
      let closestDist = Infinity;
      let insertBefore = false;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rect = r.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = r;
          insertBefore = e.clientY < centerY;
        }
      }
      return { closest, insertBefore };
    }

    function showIndicator(target) {
      clearIndicator();
      if (!target.closest) return;
      indicator = document.createElement('div');
      indicator.className = 'task-drop-indicator';
      if (target.insertBefore) {
        listEl.insertBefore(indicator, target.closest);
      } else {
        listEl.insertBefore(indicator, target.closest.nextSibling);
      }
    }

    function onMouseMove(e) {
      if (!state) return;
      const deltaY = Math.abs(e.clientY - state.startY);
      if (deltaY > 4 && !state.didDrag) {
        state.didDrag = true;
        state.row.classList.add('is-dragging');
        document.body.classList.add('is-dragging');
      }
      if (!state.didDrag) return;
      const target = getDropTarget(e);
      showIndicator(target);
    }

    async function onMouseUp(e) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!state) { clearIndicator(); return; }
      const s = state;
      state = null;

      s.row.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging');

      if (!s.didDrag) { clearIndicator(); return; }
      dragEndedAt = Date.now();

      const allRows = Array.from(listEl.querySelectorAll('.task-row'));

      let insertIndexInFull = allRows.length;
      if (indicator) {
        let next = indicator.nextSibling;
        while (next && (!next.classList || !next.classList.contains('task-row'))) {
          next = next.nextSibling;
        }
        if (next) {
          const idx = allRows.indexOf(next);
          if (idx !== -1) insertIndexInFull = idx;
        }
      }
      clearIndicator();

      let insertIndex = insertIndexInFull;
      if (insertIndexInFull > s.sourceIndex) insertIndex = insertIndexInFull - 1;

      if (insertIndex === s.sourceIndex) return;

      const reordered = sectionTasks.slice();
      const moved = reordered.splice(s.sourceIndex, 1)[0];
      reordered.splice(insertIndex, 0, moved);

      await persistOrder(reordered);
    }

    listEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      const row = e.target.closest('.task-row');
      if (!row) return;
      const id = row.dataset.taskId;
      if (!id) return;
      const idx = sectionTasks.findIndex(function (t) { return t.id === id; });
      if (idx === -1) return;
      e.preventDefault();
      state = {
        row: row,
        startY: e.clientY,
        didDrag: false,
        sourceIndex: idx
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  function render() {
    stack.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--sp-3);align-items:center;justify-content:space-between;margin-bottom:var(--sp-2);';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;';

    const catFilterWrap = document.createElement('div');
    catFilterWrap.style.cssText = 'display:flex;align-items:center;gap:var(--sp-2);';
    const catFilterLbl = document.createElement('span');
    catFilterLbl.style.cssText = 'font-size:var(--fs-11);color:var(--text-muted);';
    catFilterLbl.textContent = 'Category';
    const catFilterSel = document.createElement('select');
    catFilterSel.className = 'input';
    catFilterSel.style.cssText = 'padding:4px 8px;font-size:var(--fs-12);max-width:180px;';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    catFilterSel.appendChild(allOpt);
    for (const c of categories) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      catFilterSel.appendChild(o);
    }
    catFilterSel.value = filterCategory;
    catFilterSel.addEventListener('change', () => { filterCategory = catFilterSel.value; render(); });
    catFilterWrap.appendChild(catFilterLbl);
    catFilterWrap.appendChild(catFilterSel);
    left.appendChild(catFilterWrap);

    const sortWrap = document.createElement('div');
    sortWrap.style.cssText = 'display:flex;align-items:center;gap:var(--sp-2);';
    const sortLbl = document.createElement('span');
    sortLbl.style.cssText = 'font-size:var(--fs-11);color:var(--text-muted);';
    sortLbl.textContent = 'Sort';
    const sortSel = document.createElement('select');
    sortSel.className = 'input';
    sortSel.style.cssText = 'padding:4px 8px;font-size:var(--fs-12);';
    [['manual','Manual'],['due','Due date'],['priority','Priority'],['title','Title']].forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      sortSel.appendChild(o);
    });
    sortSel.value = sortBy;
    sortSel.addEventListener('change', () => { sortBy = sortSel.value; render(); });
    sortWrap.appendChild(sortLbl);
    sortWrap.appendChild(sortSel);
    left.appendChild(sortWrap);

    if (sortBy === 'manual') {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:var(--fs-11);color:var(--text-faint);font-style:italic;';
      hint.textContent = 'Drag a row to reorder';
      left.appendChild(hint);
    }

    toolbar.appendChild(left);

    const right = document.createElement('div');
    const toggleDoneBtn = document.createElement('button');
    toggleDoneBtn.className = 'btn ghost sm';
    toggleDoneBtn.type = 'button';
    toggleDoneBtn.textContent = showDone ? 'Hide done' : 'Show done';
    toggleDoneBtn.addEventListener('click', () => { showDone = !showDone; render(); });
    right.appendChild(toggleDoneBtn);
    toolbar.appendChild(right);

    stack.appendChild(toolbar);

    const filtered = tasks.filter(t => !filterCategory || t.categoryId === filterCategory);
    const today = todayIso();

    const overdue = [];
    const todayList = [];
    const upcoming = [];
    const noDate = [];
    const doneList = [];

    for (const t of filtered) {
      if (t.done) { doneList.push(t); continue; }
      if (!t.dueDate) { noDate.push(t); continue; }
      if (t.dueDate < today) { overdue.push(t); continue; }
      if (t.dueDate === today) { todayList.push(t); continue; }
      upcoming.push(t);
    }

    const sortGroup = (arr) => arr.slice().sort(compareTasks);

    const catMap = new Map();
    for (const c of categories) catMap.set(c.id, c);

    function buildRow(task) {
      const rec = task.recurrence || { type: 'none' };
      const isRecurring = rec.type !== 'none';

      const row = document.createElement('div');
      row.className = 'task-row' + (task.done ? ' is-done' : '');
      row.dataset.taskId = task.id;
      row.style.cssText = 'position:relative;';

      const check = document.createElement('button');
      check.className = 'task-check';
      check.type = 'button';
      check.setAttribute('aria-label', isRecurring ? 'Complete and advance' : 'Toggle done');
      check.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(task); });
      row.appendChild(check);

      const body = document.createElement('div');
      body.className = 'task-body';

      const title = document.createElement('div');
      title.className = 'task-title';
      title.textContent = task.title;
      body.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'task-meta';
      const cat = task.categoryId ? catMap.get(task.categoryId) : null;
      if (cat) {
        const chip = document.createElement('span');
        chip.className = 'chip cat';
        chip.style.setProperty('--c', cat.color);
        chip.style.padding = '0 7px';
        chip.style.fontSize = '10px';
        chip.textContent = cat.name;
        meta.appendChild(chip);
        const sep = document.createElement('span');
        sep.className = 'meta-sep';
        meta.appendChild(sep);
      }
      if (task.dueDate) {
        const due = document.createElement('span');
        due.className = 'due' + (task.dueDate < today && !task.done ? ' overdue' : '');
        if (task.dueDate === today) due.textContent = 'Today';
        else if (task.dueDate < today && !task.done) due.textContent = 'Overdue \u00B7 ' + formatShortDate(task.dueDate);
        else due.textContent = formatShortDate(task.dueDate);
        meta.appendChild(due);
      }
      if (isRecurring) {
        const sep2 = document.createElement('span');
        sep2.className = 'meta-sep';
        meta.appendChild(sep2);
        const recBadge = document.createElement('span');
        recBadge.className = 'badge accent';
        recBadge.style.fontSize = '9px';
        recBadge.textContent = 'Recurring';
        meta.appendChild(recBadge);
      }
      if (meta.childNodes.length > 0) body.appendChild(meta);

      row.appendChild(body);

      const prio = document.createElement('span');
      prio.className = 'task-priority ' + (task.priority || 'normal');
      prio.title = (task.priority || 'normal') + ' priority';
      row.appendChild(prio);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn ghost icon sm';
      editBtn.type = 'button';
      editBtn.innerHTML = icon('edit');
      editBtn.setAttribute('aria-label', 'Edit task');
      editBtn.setAttribute('title', 'Edit');
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditor(task); });
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn ghost icon sm';
      delBtn.type = 'button';
      delBtn.innerHTML = icon('trash');
      delBtn.setAttribute('aria-label', 'Delete task');
      delBtn.setAttribute('title', 'Delete');
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(task); });
      actions.appendChild(delBtn);

      row.appendChild(actions);

      row.addEventListener('click', (e) => {
        if (Date.now() - dragEndedAt < 150) return;
        if (e.target.closest('button')) return;
        openEditor(task);
      });

      return row;
    }

    function buildSection(title, items) {
      if (items.length === 0) return null;
      const wrap = document.createElement('div');
      const h = document.createElement('div');
      h.className = 'task-section-title';
      h.textContent = title + ' \u00B7 ' + items.length;
      wrap.appendChild(h);
      const list = document.createElement('div');
      list.className = 'task-list';
      for (const t of items) list.appendChild(buildRow(t));
      wrap.appendChild(list);
      makeListReorderable(list, items);
      return wrap;
    }

    const sOver = buildSection('Overdue', sortGroup(overdue));
    if (sOver) stack.appendChild(sOver);
    const sToday = buildSection('Today', sortGroup(todayList));
    if (sToday) stack.appendChild(sToday);
    const sUp = buildSection('Upcoming', sortGroup(upcoming));
    if (sUp) stack.appendChild(sUp);
    const sNo = buildSection('No date', sortGroup(noDate));
    if (sNo) stack.appendChild(sNo);
    if (showDone) {
      const sDone = buildSection('Done', sortGroup(doneList));
      if (sDone) stack.appendChild(sDone);
    }

    const totalOpen = overdue.length + todayList.length + upcoming.length + noDate.length;
    if (totalOpen === 0 && (!showDone || doneList.length === 0)) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const t = document.createElement('div');
      t.className = 'empty-title';
      t.textContent = tasks.length === 0 ? 'No tasks yet' : 'Nothing matches this filter';
      const b = document.createElement('div');
      b.className = 'empty-body';
      b.textContent = tasks.length === 0 ? 'Tasks are things to do without a fixed hour. Add one to get started.' : 'Try clearing the category filter.';
      empty.appendChild(t);
      empty.appendChild(b);
      if (tasks.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'btn primary';
        btn.type = 'button';
        btn.textContent = 'Create first task';
        btn.style.marginTop = 'var(--sp-4)';
        btn.addEventListener('click', () => openEditor(null));
        empty.appendChild(btn);
      }
      stack.appendChild(empty);
    }
  }

  try {
    await load();
    render();
  } catch (e) {
    stack.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    const t = document.createElement('div');
    t.className = 'empty-title';
    t.textContent = 'Could not load tasks';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
