// =====================================================================
// Today / Day view — v3.1.
// - Now-line tracks real time (60s interval, self-cleaning)
// - Orchestrated entrance plays on mount + navigation, skipped on save
// - All other behavior unchanged from v2.2.1.
// =====================================================================

import { api } from '../api.js';
import { getSettings } from '../app.js';
import { blocksForDate } from '../recurrence.js';
import { openBlockModal } from '../block-editor.js';
import { openSaveAsTemplate } from '../template-editor.js';
import { toast, confirm } from '../ui.js';
import {
  todayIso, timeToMinutes, minutesToTime, formatLongDate, addDays
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

export async function todayView({ outlet, setTopbar }) {
  const settings = getSettings();
  let currentDate = todayIso();
  try {
    const pre = sessionStorage.getItem('day-view:date');
    if (pre && /^\d{4}-\d{2}-\d{2}$/.test(pre)) {
      currentDate = pre;
      sessionStorage.removeItem('day-view:date');
    }
  } catch (e) {}

  let categories = [];
  let allBlocks = [];
  let needsScroll = true;
  let dragEndedAt = 0;
  let skipEntrance = false;
  let nowLineInterval = null;

  setTopbar('Today', null);
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

  function openEditor(existing, preset) {
    openBlockModal({
      categories: categories,
      existing: existing || null,
      defaultDate: currentDate,
      preset: preset || null,
      onSave: async () => {
        skipEntrance = true;
        await load();
        render();
      }
    });
  }

  async function saveDayAsTemplate() {
    const blocksToday = blocksForDate(allBlocks, currentDate).filter(function (b) {
      return b.recurrence && b.recurrence.type === 'none';
    });
    if (blocksToday.length === 0) {
      toast('No one-off blocks on this day to save.', 'danger');
      return;
    }
    await openSaveAsTemplate(currentDate);
  }

  async function goDay(delta) {
    currentDate = addDays(currentDate, delta);
    needsScroll = true;
    skipEntrance = false;
    await load();
    render();
  }

  async function goToday() {
    currentDate = todayIso();
    needsScroll = true;
    skipEntrance = false;
    await load();
    render();
  }

  function printDay() {
    window.print();
  }

  function render() {
    if (nowLineInterval) {
      clearInterval(nowLineInterval);
      nowLineInterval = null;
    }

    stack.innerHTML = '';

    const blocksToday = blocksForDate(allBlocks, currentDate);
    const dayStartMin = settings.dayStartHour * 60;
    const dayEndMin = settings.dayEndHour * 60;
    const isToday = currentDate === todayIso();

    // -------- Header --------
    const header = document.createElement('div');
    header.className = 'day-header';

    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'day-header-title';
    titleEl.textContent = formatLongDate(currentDate);
    const subEl = document.createElement('div');
    subEl.className = 'day-header-sub';
    const totalMin = blocksToday.reduce((sum, b) => sum + (timeToMinutes(b.end) - timeToMinutes(b.start)), 0);
    const tH = Math.floor(totalMin / 60);
    const tM = totalMin % 60;
    const totalStr = tH + 'h' + (tM ? ' ' + tM + 'm' : '');
    subEl.textContent = blocksToday.length + ' block' + (blocksToday.length === 1 ? '' : 's') + ' \u00B7 ' + totalStr + ' planned';
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    const actions = document.createElement('div');
    actions.className = 'day-header-actions';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary sm';
    prevBtn.type = 'button';
    prevBtn.textContent = '\u2039';
    prevBtn.title = 'Previous day';
    prevBtn.addEventListener('click', () => goDay(-1));

    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn secondary sm';
    todayBtn.type = 'button';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', goToday);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn secondary sm';
    nextBtn.type = 'button';
    nextBtn.textContent = '\u203A';
    nextBtn.title = 'Next day';
    nextBtn.addEventListener('click', () => goDay(1));

    const printBtn = document.createElement('button');
    printBtn.className = 'btn secondary sm';
    printBtn.type = 'button';
    printBtn.textContent = 'Print';
    printBtn.title = 'Print this day (Ctrl+P)';
    printBtn.addEventListener('click', printDay);

    const templateBtn = document.createElement('button');
    templateBtn.className = 'btn secondary sm';
    templateBtn.type = 'button';
    templateBtn.textContent = 'Save as template';
    templateBtn.title = 'Capture this day as a reusable template';
    templateBtn.addEventListener('click', saveDayAsTemplate);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary sm';
    addBtn.type = 'button';
    addBtn.textContent = '+ Block';
    addBtn.addEventListener('click', () => openEditor(null));

    actions.appendChild(prevBtn);
    actions.appendChild(todayBtn);
    actions.appendChild(nextBtn);
    actions.appendChild(printBtn);
    actions.appendChild(templateBtn);
    actions.appendChild(addBtn);

    header.appendChild(titleWrap);
    header.appendChild(actions);
    stack.appendChild(header);

    // -------- Timeline frame --------
    const frame = document.createElement('div');
    frame.className = 'timeline-frame';

    const allDay = document.createElement('div');
    allDay.className = 'timeline-allday';
    const allDayLbl = document.createElement('div');
    allDayLbl.className = 'timeline-allday-label';
    allDayLbl.textContent = 'Planned';
    allDay.appendChild(allDayLbl);
    const allDayItems = document.createElement('div');
    allDayItems.className = 'timeline-allday-items';
    if (blocksToday.length === 0) {
      const hint = document.createElement('span');
      hint.style.fontSize = 'var(--fs-12)';
      hint.style.color = 'var(--text-faint)';
      hint.style.fontStyle = 'italic';
      hint.textContent = 'No blocks yet \u2014 click anywhere on the timeline to create one.';
      allDayItems.appendChild(hint);
    } else {
      for (const b of blocksToday) {
        const cat = b.categoryId ? categories.find(c => c.id === b.categoryId) : null;
        const chip = document.createElement('span');
        chip.className = 'chip cat';
        if (cat) chip.style.setProperty('--c', cat.color);
        else chip.style.setProperty('--c', 'var(--text-faint)');
        chip.textContent = b.title;
        allDayItems.appendChild(chip);
      }
    }
    allDay.appendChild(allDayItems);
    frame.appendChild(allDay);

    const tl = document.createElement('div');
    tl.className = 'timeline';
    if (skipEntrance) {
      tl.classList.add('skip-entrance');
      skipEntrance = false;
    }

    const hoursCol = document.createElement('div');
    hoursCol.className = 'timeline-hours';
    for (let h = settings.dayStartHour; h < settings.dayEndHour; h++) {
      const lbl = document.createElement('div');
      lbl.className = 'hour-label';
      lbl.textContent = (h < 10 ? '0' + h : String(h)) + ':00';
      hoursCol.appendChild(lbl);
    }
    tl.appendChild(hoursCol);

    const track = document.createElement('div');
    track.className = 'timeline-track';
    const totalMinutes = dayEndMin - dayStartMin;
    const totalPx = (totalMinutes / 60) * PX_PER_HOUR;
    track.style.height = totalPx + 'px';

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (isToday && nowMin >= dayStartMin && nowMin < dayEndMin) {
      const hourStart = Math.floor(nowMin / 60) * 60;
      const hourTopPx = ((hourStart - dayStartMin) / 60) * PX_PER_HOUR;
      const highlight = document.createElement('div');
      highlight.className = 'hour-now';
      highlight.style.top = hourTopPx + 'px';
      highlight.style.height = PX_PER_HOUR + 'px';
      track.appendChild(highlight);
    }

    const laneData = assignLanes(blocksToday);
    const catMap = new Map();
    for (const c of categories) catMap.set(c.id, c);

    function attachDrag(blockEl, block) {
      let dragState = null;

      function onMouseMove(e) {
        if (!dragState) return;
        const deltaY = e.clientY - dragState.startY;
        if (Math.abs(deltaY) > 4) dragState.didDrag = true;
        if (!dragState.didDrag) return;

        const deltaMin = Math.round(((deltaY / PX_PER_HOUR) * 60) / 15) * 15;

        let newStart = dragState.startMin;
        let newEnd = dragState.endMin;

        if (dragState.mode === 'move') {
          const duration = dragState.endMin - dragState.startMin;
          newStart = dragState.startMin + deltaMin;
          newEnd = dragState.endMin + deltaMin;
          if (newStart < dayStartMin) { newStart = dayStartMin; newEnd = newStart + duration; }
          if (newEnd > dayEndMin) { newEnd = dayEndMin; newStart = newEnd - duration; }
        } else if (dragState.mode === 'resize-bottom') {
          newEnd = Math.max(dragState.startMin + 15, Math.min(dragState.endMin + deltaMin, dayEndMin));
        } else if (dragState.mode === 'resize-top') {
          newStart = Math.max(dayStartMin, Math.min(dragState.startMin + deltaMin, dragState.endMin - 15));
        }

        dragState.newStart = newStart;
        dragState.newEnd = newEnd;

        const topPx = ((newStart - dayStartMin) / 60) * PX_PER_HOUR;
        const heightPx = ((newEnd - newStart) / 60) * PX_PER_HOUR;
        blockEl.style.top = topPx + 'px';
        blockEl.style.height = Math.max(heightPx, 12) + 'px';

        const timeSpan = blockEl.querySelector('.block-time');
        if (timeSpan) timeSpan.textContent = minutesToTime(newStart) + ' \u2013 ' + minutesToTime(newEnd);
      }

      async function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        blockEl.classList.remove('is-dragging');
        document.body.classList.remove('is-dragging');

        if (!dragState) return;
        const d = dragState;
        dragState = null;

        if (!d.didDrag) return;
        dragEndedAt = Date.now();

        if (d.newStart === d.startMin && d.newEnd === d.endMin) return;

        const isRecurring = d.block.recurrence && d.block.recurrence.type && d.block.recurrence.type !== 'none';
        if (isRecurring) {
          const ok = await confirm(
            'Move recurring block?',
            'This block repeats. Move ALL occurrences to ' + minutesToTime(d.newStart) + ' \u2013 ' + minutesToTime(d.newEnd) + '?'
          );
          if (!ok) {
            blockEl.style.top = d.origTop + 'px';
            blockEl.style.height = d.origHeight + 'px';
            const timeSpan = blockEl.querySelector('.block-time');
            if (timeSpan) timeSpan.textContent = minutesToTime(d.startMin) + ' \u2013 ' + minutesToTime(d.endMin);
            return;
          }
        }

        try {
          await api.update('blocks', d.block.id, Object.assign({}, d.block, {
            start: minutesToTime(d.newStart),
            end: minutesToTime(d.newEnd)
          }));
          toast('Block updated.', 'success');
          skipEntrance = true;
          await load();
          render();
        } catch (err) {
          toast('Save failed: ' + (err && err.message ? err.message : 'error'), 'danger');
          blockEl.style.top = d.origTop + 'px';
          blockEl.style.height = d.origHeight + 'px';
          const timeSpan = blockEl.querySelector('.block-time');
          if (timeSpan) timeSpan.textContent = minutesToTime(d.startMin) + ' \u2013 ' + minutesToTime(d.endMin);
        }
      }

      blockEl.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        let mode = 'move';
        if (e.target.classList && e.target.classList.contains('handle')) {
          mode = e.target.classList.contains('top') ? 'resize-top' : 'resize-bottom';
        }
        e.preventDefault();
        dragState = {
          mode: mode,
          block: block,
          blockEl: blockEl,
          startY: e.clientY,
          startMin: timeToMinutes(block.start),
          endMin: timeToMinutes(block.end),
          origTop: parseFloat(blockEl.style.top) || 0,
          origHeight: parseFloat(blockEl.style.height) || 0,
          didDrag: false,
          newStart: timeToMinutes(block.start),
          newEnd: timeToMinutes(block.end)
        };
        blockEl.classList.add('is-dragging');
        document.body.classList.add('is-dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      blockEl.addEventListener('click', function (e) {
        if (Date.now() - dragEndedAt < 150) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        openEditor(block);
      });
    }

    for (const item of laneData) {
      const b = item.block;
      const cat = b.categoryId ? catMap.get(b.categoryId) : null;
      const startMin = timeToMinutes(b.start);
      const endMin = timeToMinutes(b.end);
      const topPx = ((startMin - dayStartMin) / 60) * PX_PER_HOUR;
      const heightPx = ((endMin - startMin) / 60) * PX_PER_HOUR;

      const blockEl = document.createElement('button');
      blockEl.type = 'button';
      blockEl.className = 'block';
      if (heightPx < 30) blockEl.classList.add('mini');
      else if (heightPx < 55) blockEl.classList.add('compact');
      if (cat) blockEl.style.setProperty('--c', cat.color);
      blockEl.style.top = topPx + 'px';
      blockEl.style.height = Math.max(heightPx, 12) + 'px';
      if (item.total > 1) {
        const widthPct = 100 / item.total;
        const leftPct = (item.lane / item.total) * 100;
        blockEl.style.left = 'calc(' + leftPct + '% + 2px)';
        blockEl.style.width = 'calc(' + widthPct + '% - 4px)';
      } else {
        blockEl.style.left = '2px';
        blockEl.style.width = 'calc(100% - 4px)';
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'block-title';
      titleSpan.textContent = b.title;
      blockEl.appendChild(titleSpan);

      if (heightPx >= 30) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'block-time';
        timeSpan.textContent = b.start + ' \u2013 ' + b.end;
        blockEl.appendChild(timeSpan);
      }

      if (heightPx >= 20) {
        const handleTop = document.createElement('span');
        handleTop.className = 'handle top';
        blockEl.appendChild(handleTop);
        const handleBottom = document.createElement('span');
        handleBottom.className = 'handle bottom';
        blockEl.appendChild(handleBottom);
      }

      attachDrag(blockEl, b);
      track.appendChild(blockEl);
    }

    if (isToday && settings.showNowLine && nowMin >= dayStartMin && nowMin < dayEndMin) {
      const nowTopPx = ((nowMin - dayStartMin) / 60) * PX_PER_HOUR;
      const nowLine = document.createElement('div');
      nowLine.className = 'now-line';
      nowLine.style.top = nowTopPx + 'px';
      nowLine.id = 'today-now-line';
      track.appendChild(nowLine);

      // Real-time tracking — updates every 60s, self-clears when the view changes
      nowLineInterval = setInterval(function () {
        const line = document.getElementById('today-now-line');
        if (!line) {
          clearInterval(nowLineInterval);
          nowLineInterval = null;
          return;
        }
        const n = new Date();
        const m = n.getHours() * 60 + n.getMinutes();
        if (m < dayStartMin || m >= dayEndMin) {
          line.style.display = 'none';
          return;
        }
        line.style.display = '';
        const topPx = ((m - dayStartMin) / 60) * PX_PER_HOUR;
        line.style.top = topPx + 'px';
      }, 60000);
    }

    track.addEventListener('click', (e) => {
      if (e.target !== track && !e.target.classList.contains('hour-now')) return;
      const rect = track.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutesFromStart = (y / PX_PER_HOUR) * 60;
      const clickedMin = dayStartMin + minutesFromStart;
      const rounded = Math.floor(clickedMin / 15) * 15;
      const clamped = Math.max(dayStartMin, Math.min(rounded, dayEndMin - 15));
      const startTime = minutesToTime(clamped);
      const endMinCalc = Math.min(clamped + 60, dayEndMin);
      const endTime = minutesToTime(endMinCalc);
      openEditor(null, { start: startTime, end: endTime });
    });

    tl.appendChild(track);
    frame.appendChild(tl);
    stack.appendChild(frame);

    const footer = document.createElement('div');
    footer.className = 'print-footer';
    footer.textContent = 'Printed ' + new Date().toLocaleString('en-GB');
    stack.appendChild(footer);

    if (isToday && settings.showNowLine && needsScroll) {
      needsScroll = false;
      setTimeout(() => {
        const line = document.getElementById('today-now-line');
        if (line) {
          const rect = line.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: 'instant' });
        }
      }, 60);
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
    t.textContent = 'Could not load your day';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
