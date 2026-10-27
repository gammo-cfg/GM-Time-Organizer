// =====================================================================
// Month view — 5-6 week grid, mini blocks with category dots,
// +N more overflow, prev/next/today navigation, click cell → day view.
// =====================================================================

import { api } from '../api.js';
import { getSettings } from '../app.js';
import { blocksForDate } from '../recurrence.js';
import {
  todayIso, addMonths, parseIso, toIso,
  WEEKDAY_SHORT, MONTH_NAMES
} from '../utils.js';

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

export async function monthView({ outlet, setTopbar }) {
  const settings = getSettings();
  let anchor = todayIso();
  let categories = [];
  let allBlocks = [];

  setTopbar('Month', null);
  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const [c, b] = await Promise.all([api.list('categories'), api.list('blocks')]);
    categories = (c && c.data) || [];
    allBlocks = (b && b.data) || [];
  }

  function goMonth(delta) { anchor = addMonths(anchor, delta); render(); }
  function goToday() { anchor = todayIso(); render(); }

  function goDay(iso) {
    try { sessionStorage.setItem('day-view:date', iso); } catch (e) {}
    location.hash = '#/day';
  }

  function render() {
    stack.innerHTML = '';

    const anchorDate = parseIso(anchor);
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const dim = daysInMonth(year, month);

    let total = 0;
    for (let d = 1; d <= dim; d++) {
      const iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      total += blocksForDate(allBlocks, iso).length;
    }

    // -------- Header --------
    const header = document.createElement('div');
    header.className = 'day-header';
    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'day-header-title';
    titleEl.textContent = MONTH_NAMES[month] + ' ' + year;
    const subEl = document.createElement('div');
    subEl.className = 'day-header-sub';
    subEl.textContent = total + ' block' + (total === 1 ? '' : 's') + ' this month \u00B7 click a day to open it';
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    const actions = document.createElement('div');
    actions.className = 'day-header-actions';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary sm';
    prevBtn.type = 'button';
    prevBtn.textContent = '\u2039';
    prevBtn.title = 'Previous month';
    prevBtn.addEventListener('click', () => goMonth(-1));
    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn secondary sm';
    todayBtn.type = 'button';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', goToday);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn secondary sm';
    nextBtn.type = 'button';
    nextBtn.textContent = '\u203A';
    nextBtn.title = 'Next month';
    nextBtn.addEventListener('click', () => goMonth(1));
    actions.appendChild(prevBtn);
    actions.appendChild(todayBtn);
    actions.appendChild(nextBtn);
    header.appendChild(titleWrap);
    header.appendChild(actions);
    stack.appendChild(header);

    // -------- Frame --------
    const frame = document.createElement('div');
    frame.className = 'month-frame';

    const head = document.createElement('div');
    head.className = 'month-head';
    for (let i = 0; i < 7; i++) {
      const wd = (settings.weekStart + i) % 7;
      const lbl = document.createElement('div');
      lbl.className = 'month-head-label';
      lbl.textContent = WEEKDAY_SHORT[wd];
      head.appendChild(lbl);
    }
    frame.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    const firstOfMonth = new Date(year, month, 1);
    const offset = ((firstOfMonth.getDay() - settings.weekStart) % 7 + 7) % 7;
    const rowsNeeded = Math.ceil((offset + dim) / 7);
    const totalCells = rowsNeeded * 7;
    const gridStart = new Date(year, month, 1 - offset);
    const today = todayIso();

    const catMap = new Map();
    for (const c of categories) catMap.set(c.id, c);

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const cellIso = toIso(cellDate);
      const isOther = cellDate.getMonth() !== month;
      const isToday = cellIso === today;

      const cell = document.createElement('div');
      cell.className = 'month-cell' + (isOther ? ' other' : '') + (isToday ? ' today' : '');
      cell.dataset.date = cellIso;

      const dayRow = document.createElement('div');
      dayRow.className = 'month-day';
      const dayNum = document.createElement('span');
      dayNum.textContent = String(cellDate.getDate());
      dayRow.appendChild(dayNum);

      const dayBlocks = blocksForDate(allBlocks, cellIso);
      if (dayBlocks.length > 0) {
        const count = document.createElement('span');
        count.className = 'month-count';
        count.textContent = String(dayBlocks.length);
        dayRow.appendChild(count);
      }
      cell.appendChild(dayRow);

      const maxShow = 2;
      for (let k = 0; k < Math.min(maxShow, dayBlocks.length); k++) {
        const b = dayBlocks[k];
        const cat = b.categoryId ? catMap.get(b.categoryId) : null;
        const mini = document.createElement('div');
        mini.className = 'month-mini-block';
        if (cat) mini.style.setProperty('--c', cat.color);
        else mini.style.setProperty('--c', 'var(--text-faint)');
        const dot = document.createElement('span');
        dot.className = 'mm-dot';
        const txt = document.createElement('span');
        txt.className = 'mm-text';
        txt.textContent = b.title;
        mini.appendChild(dot);
        mini.appendChild(txt);
        cell.appendChild(mini);
      }
      if (dayBlocks.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'month-more';
        more.textContent = '+' + (dayBlocks.length - maxShow) + ' more';
        cell.appendChild(more);
      }

      cell.addEventListener('click', () => goDay(cellIso));
      grid.appendChild(cell);
    }

    frame.appendChild(grid);
    stack.appendChild(frame);
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
    t.textContent = 'Could not load the month';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
