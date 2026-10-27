// =====================================================================
// Week view — 7-column grid with real blocks, recurrence, today highlight,
// prev/next/today navigation, click-to-create, click-to-edit.
// =====================================================================

import { api } from '../api.js';
import { getSettings } from '../app.js';
import { blocksForDate } from '../recurrence.js';
import { openBlockModal } from '../block-editor.js';
import {
  todayIso, addDays, startOfWeek, parseIso, toIso,
  timeToMinutes, minutesToTime, WEEKDAY_SHORT
} from '../utils.js';

const PX_PER_HOUR = 60;

function overlaps(a, b) {
  const aS = timeToMinutes(a.start), aE = timeToMinutes(a.end);
  const bS = timeToMinutes(b.start), bE = timeToMinutes(b.end);
  return aS < bE && bS < aE;
}

function assignLanes(items) {
  const sorted = items.slice().sort((a, b) => {
    const d = timeToMinutes(a.start) - timeToMinutes(b.start);
    return d !== 0 ? d : a.title.localeCompare(b.title);
  });
  return sorted.map((b, i) => {
    const overlappers = sorted.filter(x => overlaps(x, b));
    const beforeCount = sorted.slice(0, i).filter(x => overlaps(x, b)).length;
    return { block: b, lane: beforeCount, total: overlappers.length };
  });
}

function rangeIso(fromIso, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(addDays(fromIso, i));
  return out;
}

function sameMonth(d1, d2) {
  return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

export async function weekView({ outlet, setTopbar }) {
  const settings = getSettings();
  let currentWeekStart = startOfWeek(todayIso(), settings.weekStart);
  let categories = [];
  let allBlocks = [];

  setTopbar('Week', null);
  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const [c, b] = await Promise.all([
      api.list('categories'),
      api.list('blocks')
    ]);
    categories = (c && c.data) || [];
    allBlocks = (b && b.data) || [];
  }

  function openEditor(existing, preset, defaultDate) {
    openBlockModal({
      categories: categories,
      existing: existing || null,
      defaultDate: defaultDate || currentWeekStart,
      preset: preset || null,
      onSave: async () => { await load(); render(); }
    });
  }

  async function goWeek(delta) {
    currentWeekStart = addDays(currentWeekStart, delta * 7);
    await load();
    render();
  }

  async function goThisWeek() {
    currentWeekStart = startOfWeek(todayIso(), settings.weekStart);
    await load();
    render();
  }

  function render() {
    stack.innerHTML = '';

    const weekDays = rangeIso(currentWeekStart, 7);
    const today = todayIso();
    const isThisWeek = weekDays.indexOf(today) !== -1;

    // -------- Header --------
    const header = document.createElement('div');
    header.className = 'day-header';

    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'day-header-title';
    const firstDay = parseIso(weekDays[0]);
    const lastDay = parseIso(weekDays[6]);
    const monthLabel = sameMonth(firstDay, lastDay)
      ? firstDay.getDate() + '\u2013' + lastDay.getDate() + ' ' + firstDay.toLocaleString('en', { month: 'long' }) + ' ' + firstDay.getFullYear()
      : firstDay.getDate() + ' ' + firstDay.toLocaleString('en', { month: 'short' }) + ' \u2013 ' + lastDay.getDate() + ' ' + lastDay.toLocaleString('en', { month: 'short' }) + ' ' + lastDay.getFullYear();
    titleEl.textContent = monthLabel;

    const subEl = document.createElement('div');
    subEl.className = 'day-header-sub';
    const weekBlockCount = weekDays.reduce((sum, iso) => sum + blocksForDate(allBlocks, iso).length, 0);
    subEl.textContent = weekBlockCount + ' block' + (weekBlockCount === 1 ? '' : 's') + ' this week';

    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    const actions = document.createElement('div');
    actions.className = 'day-header-actions';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary sm';
    prevBtn.type = 'button';
    prevBtn.textContent = '\u2039';
    prevBtn.title = 'Previous week';
    prevBtn.addEventListener('click', () => goWeek(-1));

    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn secondary sm';
    todayBtn.type = 'button';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', goThisWeek);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn secondary sm';
    nextBtn.type = 'button';
    nextBtn.textContent = '\u203A';
    nextBtn.title = 'Next week';
    nextBtn.addEventListener('click', () => goWeek(1));

    actions.appendChild(prevBtn);
    actions.appendChild(todayBtn);
    actions.appendChild(nextBtn);
    header.appendChild(titleWrap);
    header.appendChild(actions);
    stack.appendChild(header);

    // -------- Week frame --------
    const frame = document.createElement('div');
    frame.className = 'week-frame';

    // Head row
    const head = document.createElement('div');
    head.className = 'week-head';
    const spacer = document.createElement('div');
    spacer.className = 'week-head-spacer';
    head.appendChild(spacer);
    for (const iso of weekDays) {
      const d = parseIso(iso);
      const cell = document.createElement('div');
      cell.className = 'week-head-cell' + (iso === today ? ' today' : '');
      const wd = document.createElement('div');
      wd.className = 'wd';
      wd.textContent = WEEKDAY_SHORT[d.getDay()];
      const dn = document.createElement('div');
      dn.className = 'dn';
      dn.textContent = String(d.getDate());
      cell.appendChild(wd);
      cell.appendChild(dn);
      head.appendChild(cell);
    }
    frame.appendChild(head);

    // Body
    const body = document.createElement('div');
    body.className = 'week-body';

    const hoursCol = document.createElement('div');
    hoursCol.className = 'week-hours';
    for (let h = settings.dayStartHour; h < settings.dayEndHour; h++) {
      const lbl = document.createElement('div');
      lbl.className = 'hour-label';
      lbl.textContent = (h < 10 ? '0' + h : String(h)) + ':00';
      hoursCol.appendChild(lbl);
    }
    body.appendChild(hoursCol);

    const dayStartMin = settings.dayStartHour * 60;
    const dayEndMin = settings.dayEndHour * 60;
    const totalPx = ((dayEndMin - dayStartMin) / 60) * PX_PER_HOUR;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const showNowLine = isThisWeek && settings.showNowLine && nowMin >= dayStartMin && nowMin < dayEndMin;

    const catMap = new Map();
    for (const c of categories) catMap.set(c.id, c);

    for (const iso of weekDays) {
      const col = document.createElement('div');
      col.className = 'week-col' + (iso === today ? ' today' : '');
      col.style.height = totalPx + 'px';
      col.dataset.date = iso;

      const blocks = blocksForDate(allBlocks, iso);
      const laneData = assignLanes(blocks);

      for (const item of laneData) {
        const b = item.block;
        const cat = b.categoryId ? catMap.get(b.categoryId) : null;
        const startMin = timeToMinutes(b.start);
        const endMin = timeToMinutes(b.end);
        const topPx = ((startMin - dayStartMin) / 60) * PX_PER_HOUR;
        const heightPx = ((endMin - startMin) / 60) * PX_PER_HOUR;

        const blockEl = document.createElement('button');
        blockEl.type = 'button';
        blockEl.className = 'week-block';
        if (heightPx < 30) blockEl.classList.add('mini');
        if (cat) blockEl.style.setProperty('--c', cat.color);
        else blockEl.style.setProperty('--c', 'var(--text-faint)');
        blockEl.style.top = topPx + 'px';
        blockEl.style.height = Math.max(heightPx, 10) + 'px';

        if (item.total > 1) {
          const widthPct = 100 / item.total;
          const leftPct = (item.lane / item.total) * 100;
          blockEl.style.left = 'calc(' + leftPct + '% + 2px)';
          blockEl.style.right = 'calc(' + (100 - leftPct - widthPct) + '% + 2px)';
        }

        const titleSpan = document.createElement('div');
        titleSpan.className = 'wb-title';
        titleSpan.textContent = b.title;
        blockEl.appendChild(titleSpan);

        if (heightPx >= 30) {
          const timeSpan = document.createElement('div');
          timeSpan.className = 'wb-time';
          timeSpan.textContent = b.start + ' \u2013 ' + b.end;
          blockEl.appendChild(timeSpan);
        }

        blockEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditor(b, null, iso);
        });

        col.appendChild(blockEl);
      }

      // Click empty column space → create at that time
      col.addEventListener('click', (e) => {
        if (e.target !== col) return;
        const rect = col.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const minutesFromStart = (y / PX_PER_HOUR) * 60;
        const clickedMin = dayStartMin + minutesFromStart;
        const rounded = Math.floor(clickedMin / 15) * 15;
        const clamped = Math.max(dayStartMin, Math.min(rounded, dayEndMin - 15));
        const startTime = minutesToTime(clamped);
        const endMinCalc = Math.min(clamped + 60, dayEndMin);
        const endTime = minutesToTime(endMinCalc);
        openEditor(null, { start: startTime, end: endTime }, iso);
      });

      // Now line in the today column
      if (showNowLine && iso === today) {
        const nowTopPx = ((nowMin - dayStartMin) / 60) * PX_PER_HOUR;
        const nowLine = document.createElement('div');
        nowLine.className = 'week-now';
        nowLine.style.top = nowTopPx + 'px';
        col.appendChild(nowLine);
      }

      body.appendChild(col);
    }

    frame.appendChild(body);
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
    t.textContent = 'Could not load the week';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
