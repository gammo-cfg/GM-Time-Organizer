// =====================================================================
// Habits view — weekly grid, toggle cells, streak calculation, editor.
// Streak logic:
//   - Walk backward from today (or yesterday if today is scheduled but
//     not yet marked done — grace period).
//   - Skip days not in habit.weekdays.
//   - Stop on the first scheduled day where logs[iso] is not true.
// =====================================================================

import { api } from '../api.js';
import { getSettings } from '../app.js';
import { toast } from '../ui.js';
import { openHabitModal } from '../habit-editor.js';
import {
  todayIso, addDays, startOfWeek, parseIso,
  WEEKDAY_SHORT, MONTH_NAMES
} from '../utils.js';

function computeStreak(habit) {
  const weekdays = Array.isArray(habit.weekdays) ? habit.weekdays : [];
  if (weekdays.length === 0) return 0;
  const logs = habit.logs || {};
  const today = todayIso();
  const todayWd = parseIso(today).getDay();
  const todayScheduled = weekdays.indexOf(todayWd) !== -1;

  let cursor = today;
  // Grace: if today is scheduled but not done yet, skip it without breaking
  if (todayScheduled && logs[today] !== true) {
    cursor = addDays(today, -1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const wd = parseIso(cursor).getDay();
    if (weekdays.indexOf(wd) !== -1) {
      if (logs[cursor] === true) streak++;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function formatWeekRange(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return s.getDate() + '\u2013' + e.getDate() + ' ' + MONTH_NAMES[s.getMonth()] + ' ' + s.getFullYear();
  }
  return s.getDate() + ' ' + MONTH_NAMES[s.getMonth()].slice(0, 3) + ' \u2013 ' + e.getDate() + ' ' + MONTH_NAMES[e.getMonth()].slice(0, 3) + ' ' + e.getFullYear();
}

export async function habitsView({ outlet, setTopbar }) {
  const settings = getSettings();
  let weekAnchor = todayIso();
  let habits = [];

  setTopbar('Habits', (actions) => {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.type = 'button';
    addBtn.textContent = '+ Habit';
    addBtn.addEventListener('click', () => openEditor(null));
    actions.appendChild(addBtn);
  });

  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const res = await api.list('habits');
    habits = (res && res.data) || [];
  }

  function openEditor(existing) {
    openHabitModal({
      existing: existing || null,
      onSave: async () => { await load(); render(); },
      onDelete: async () => { await load(); render(); }
    });
  }

  async function toggleDay(habit, iso) {
    if (iso > todayIso()) return;
    const logs = Object.assign({}, habit.logs || {});
    if (logs[iso] === true) delete logs[iso];
    else logs[iso] = true;
    try {
      await api.update('habits', habit.id, {
        title: habit.title,
        weekdays: habit.weekdays || [],
        color: habit.color,
        logs: logs
      });
      await load();
      render();
    } catch (e) {
      toast('Could not save: ' + (e && e.message ? e.message : 'error'), 'danger');
    }
  }

  function getWeekDays() {
    const start = startOfWeek(weekAnchor, settings.weekStart);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
    return days;
  }

  function shiftWeek(delta) {
    weekAnchor = addDays(weekAnchor, delta * 7);
    render();
  }

  function resetWeek() {
    weekAnchor = todayIso();
    render();
  }

  function render() {
    stack.innerHTML = '';

    const days = getWeekDays();
    const today = todayIso();
    const firstIso = days[0];
    const lastIso = days[6];

    // Header
    const header = document.createElement('div');
    header.className = 'day-header';

    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'day-header-title';
    titleEl.textContent = 'Habits';
    const subEl = document.createElement('div');
    subEl.className = 'day-header-sub';
    subEl.textContent = formatWeekRange(firstIso, lastIso) + ' \u00B7 ' + habits.length + ' habit' + (habits.length === 1 ? '' : 's');
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    const actions = document.createElement('div');
    actions.className = 'day-header-actions';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary sm';
    prevBtn.type = 'button';
    prevBtn.textContent = '\u2039';
    prevBtn.title = 'Previous week';
    prevBtn.addEventListener('click', () => shiftWeek(-1));
    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn secondary sm';
    todayBtn.type = 'button';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', resetWeek);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn secondary sm';
    nextBtn.type = 'button';
    nextBtn.textContent = '\u203A';
    nextBtn.title = 'Next week';
    nextBtn.addEventListener('click', () => shiftWeek(1));
    actions.appendChild(prevBtn);
    actions.appendChild(todayBtn);
    actions.appendChild(nextBtn);

    header.appendChild(titleWrap);
    header.appendChild(actions);
    stack.appendChild(header);

    // Empty state
    if (habits.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const t = document.createElement('div');
      t.className = 'empty-title';
      t.textContent = 'No habits yet';
      const b = document.createElement('div');
      b.className = 'empty-body';
      b.textContent = 'Habits are daily or weekly routines you want to track. Mark a day done to start a streak.';
      empty.appendChild(t);
      empty.appendChild(b);
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Create first habit';
      btn.style.marginTop = 'var(--sp-4)';
      btn.addEventListener('click', () => openEditor(null));
      empty.appendChild(btn);
      stack.appendChild(empty);
      return;
    }

    // Habit card
    const card = document.createElement('div');
    card.className = 'demo-habit-card';

    const gridHeader = document.createElement('div');
    gridHeader.className = 'habit-header';

    const nameHeader = document.createElement('div');
    nameHeader.textContent = 'Habit';
    gridHeader.appendChild(nameHeader);

    for (const iso of days) {
      const cell = document.createElement('div');
      cell.className = 'hc-day' + (iso === today ? ' today' : '');
      cell.textContent = WEEKDAY_SHORT[parseIso(iso).getDay()];
      gridHeader.appendChild(cell);
    }

    const streakHeader = document.createElement('div');
    streakHeader.className = 'hc-streak';
    streakHeader.textContent = 'Streak';
    gridHeader.appendChild(streakHeader);

    card.appendChild(gridHeader);

    const list = document.createElement('div');
    list.className = 'habit-list';

    for (const habit of habits) {
      const row = document.createElement('div');
      row.className = 'habit-row';

      const nameCell = document.createElement('div');
      nameCell.className = 'habit-name';
      nameCell.style.cursor = 'pointer';
      nameCell.title = 'Click to edit';
      const dot = document.createElement('span');
      dot.className = 'habit-dot';
      dot.style.setProperty('--c', habit.color);
      nameCell.appendChild(dot);
      nameCell.appendChild(document.createTextNode(habit.title));
      nameCell.addEventListener('click', () => openEditor(habit));
      row.appendChild(nameCell);

      const weekdays = Array.isArray(habit.weekdays) ? habit.weekdays : [];
      const logs = habit.logs || {};

      for (const iso of days) {
        const wd = parseIso(iso).getDay();
        const scheduled = weekdays.indexOf(wd) !== -1;
        const isToday = iso === today;
        const isFuture = iso > today;
        const isDone = logs[iso] === true;

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'habit-cell';
        cell.style.setProperty('--c', habit.color);
        if (!scheduled) cell.classList.add('skipped');
        if (isToday) cell.classList.add('today');
        if (isDone && scheduled) cell.classList.add('done');
        if (isFuture) cell.classList.add('future');
        if (isFuture || !scheduled) {
          cell.disabled = true;
          cell.setAttribute('aria-label', 'Not available');
        } else {
          cell.setAttribute('aria-label', isDone ? 'Mark undone' : 'Mark done');
          cell.addEventListener('click', () => toggleDay(habit, iso));
        }
        row.appendChild(cell);
      }

      const streak = computeStreak(habit);
      const streakCell = document.createElement('div');
      streakCell.className = 'habit-streak';
      const sn = document.createElement('span');
      sn.className = 'streak-n';
      sn.textContent = String(streak);
      const su = document.createElement('span');
      su.className = 'streak-u';
      su.textContent = 'd';
      streakCell.appendChild(sn);
      streakCell.appendChild(su);
      row.appendChild(streakCell);

      list.appendChild(row);
    }

    card.appendChild(list);
    stack.appendChild(card);
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
    t.textContent = 'Could not load habits';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
