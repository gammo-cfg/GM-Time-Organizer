// =====================================================================
// Stats view — computed reporting over blocks / tasks / habits / categories.
// Period: Week / Month / Year. All computation client-side.
// =====================================================================

import { api } from '../api.js';
import { getSettings } from '../app.js';
import { occursOn } from '../recurrence.js';
import {
  todayIso, addDays, parseIso, startOfWeek,
  timeToMinutes, WEEKDAY_SHORT, MONTH_NAMES
} from '../utils.js';

function daysInRange(startIso, endIso) {
  const out = [];
  let cur = startIso;
  let guard = 0;
  while (cur <= endIso && guard < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

function computeStreak(habit) {
  const weekdays = Array.isArray(habit.weekdays) ? habit.weekdays : [];
  if (weekdays.length === 0) return 0;
  const logs = habit.logs || {};
  const today = todayIso();
  const todayWd = parseIso(today).getDay();
  const todayScheduled = weekdays.indexOf(todayWd) !== -1;
  let cursor = today;
  if (todayScheduled && logs[today] !== true) cursor = addDays(today, -1);
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

export async function statsView({ outlet, setTopbar }) {
  const settings = getSettings();
  let period = 'week';
  let categories = [];
  let blocks = [];
  let tasks = [];
  let habits = [];

  setTopbar('Stats', null);
  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const [c, b, t, h] = await Promise.all([
      api.list('categories'),
      api.list('blocks'),
      api.list('tasks'),
      api.list('habits')
    ]);
    categories = (c && c.data) || [];
    blocks = (b && b.data) || [];
    tasks = (t && t.data) || [];
    habits = (h && h.data) || [];
  }

  function computeRange() {
    const today = todayIso();
    const d = parseIso(today);
    if (period === 'week') {
      const start = startOfWeek(today, settings.weekStart);
      return { start: start, end: addDays(start, 6) };
    }
    if (period === 'month') {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return {
        start: y + '-' + String(m).padStart(2, '0') + '-01',
        end: y + '-' + String(m).padStart(2, '0') + '-' + String(dim).padStart(2, '0')
      };
    }
    return { start: d.getFullYear() + '-01-01', end: d.getFullYear() + '-12-31' };
  }

  function computeStats() {
    const range = computeRange();
    const days = daysInRange(range.start, range.end);
    const categoryMinutes = new Map();
    const dailyMinutes = new Map();
    let totalMinutes = 0;
    let blockOccurrences = 0;

    for (let i = 0; i < days.length; i++) {
      const iso = days[i];
      let dayMin = 0;
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j];
        if (occursOn(b, iso)) {
          const dur = timeToMinutes(b.end) - timeToMinutes(b.start);
          totalMinutes += dur;
          dayMin += dur;
          blockOccurrences++;
          const key = b.categoryId || '__none__';
          categoryMinutes.set(key, (categoryMinutes.get(key) || 0) + dur);
        }
      }
      dailyMinutes.set(iso, dayMin);
    }

    return {
      range: range,
      days: days,
      categoryMinutes: categoryMinutes,
      dailyMinutes: dailyMinutes,
      totalMinutes: totalMinutes,
      blockOccurrences: blockOccurrences
    };
  }

  function bucketByPeriod(days, dailyMinutes) {
    if (period === 'week') {
      return days.map(function (iso) {
        return { label: WEEKDAY_SHORT[parseIso(iso).getDay()], minutes: dailyMinutes.get(iso) || 0 };
      });
    }
    if (period === 'month') {
      const buckets = [];
      let curSum = 0;
      for (let i = 0; i < days.length; i++) {
        if (i > 0 && (i % 7 === 0)) {
          buckets.push({ label: 'W' + (buckets.length + 1), minutes: curSum });
          curSum = 0;
        }
        curSum += dailyMinutes.get(days[i]) || 0;
      }
      buckets.push({ label: 'W' + (buckets.length + 1), minutes: curSum });
      return buckets;
    }
    const months = new Array(12);
    for (let k = 0; k < 12; k++) months[k] = 0;
    for (let i = 0; i < days.length; i++) {
      const m = parseIso(days[i]).getMonth();
      months[m] += dailyMinutes.get(days[i]) || 0;
    }
    const out = [];
    for (let k = 0; k < 12; k++) {
      out.push({ label: MONTH_NAMES[k].slice(0, 3), minutes: months[k] });
    }
    return out;
  }

  function render() {
    stack.innerHTML = '';

    const computed = computeStats();
    const range = computed.range;
    const days = computed.days;
    const categoryMinutes = computed.categoryMinutes;
    const dailyMinutes = computed.dailyMinutes;
    const totalMinutes = computed.totalMinutes;
    const blockOccurrences = computed.blockOccurrences;

    // Period toggle header
    const header = document.createElement('div');
    header.className = 'day-header';

    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'day-header-title';
    titleEl.textContent = 'Statistics';
    const subEl = document.createElement('div');
    subEl.className = 'day-header-sub';
    const label = period === 'week' ? 'This week' : (period === 'month' ? 'This month' : 'This year');
    subEl.textContent = label + ' \u00B7 ' + range.start + ' \u2192 ' + range.end;
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    const actions = document.createElement('div');
    actions.className = 'day-header-actions';
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'group');
    const opts = [['week', 'Week'], ['month', 'Month'], ['year', 'Year']];
    for (let i = 0; i < opts.length; i++) {
      const v = opts[i][0];
      const l = opts[i][1];
      const b = document.createElement('button');
      b.className = 'seg-btn' + (period === v ? ' is-on' : '');
      b.type = 'button';
      b.textContent = l;
      (function (vv) {
        b.addEventListener('click', function () {
          period = vv;
          render();
        });
      })(v);
      seg.appendChild(b);
    }
    actions.appendChild(seg);
    header.appendChild(titleWrap);
    header.appendChild(actions);
    stack.appendChild(header);

    // Headline grid
    const grid = document.createElement('div');
    grid.className = 'stats-grid';

    // Card 1: Planned time
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;
    const card1 = document.createElement('div');
    card1.className = 'stat-card';
    const c1Label = document.createElement('div');
    c1Label.className = 'stat-label';
    c1Label.textContent = 'Planned time';
    const c1Value = document.createElement('div');
    c1Value.className = 'stat-value';
    c1Value.textContent = String(totalH);
    const c1Unit = document.createElement('span');
    c1Unit.className = 'stat-unit';
    c1Unit.textContent = totalM > 0 ? 'h ' + totalM + 'm' : 'h';
    c1Value.appendChild(c1Unit);
    const c1Trend = document.createElement('div');
    c1Trend.className = 'stat-trend';
    c1Trend.textContent = days.length + ' days in range';
    card1.appendChild(c1Label);
    card1.appendChild(c1Value);
    card1.appendChild(c1Trend);
    grid.appendChild(card1);

    // Card 2: Block occurrences
    const card2 = document.createElement('div');
    card2.className = 'stat-card';
    const c2Label = document.createElement('div');
    c2Label.className = 'stat-label';
    c2Label.textContent = 'Block occurrences';
    const c2Value = document.createElement('div');
    c2Value.className = 'stat-value';
    c2Value.textContent = String(blockOccurrences);
    const c2Trend = document.createElement('div');
    c2Trend.className = 'stat-trend';
    c2Trend.textContent = blocks.length + ' distinct block' + (blocks.length === 1 ? '' : 's');
    card2.appendChild(c2Label);
    card2.appendChild(c2Value);
    card2.appendChild(c2Trend);
    grid.appendChild(card2);

    // Card 3: Tasks completed
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(function (t) { return !!t.done; }).length;
    const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    const card3 = document.createElement('div');
    card3.className = 'stat-card';
    const c3Label = document.createElement('div');
    c3Label.className = 'stat-label';
    c3Label.textContent = 'Tasks completed';
    const c3Value = document.createElement('div');
    c3Value.className = 'stat-value';
    c3Value.textContent = String(doneTasks);
    const c3Unit = document.createElement('span');
    c3Unit.className = 'stat-unit';
    c3Unit.textContent = '/ ' + totalTasks;
    c3Value.appendChild(c3Unit);
    const c3Trend = document.createElement('div');
    c3Trend.className = 'stat-trend';
    c3Trend.textContent = pct + '% completion';
    card3.appendChild(c3Label);
    card3.appendChild(c3Value);
    card3.appendChild(c3Trend);
    grid.appendChild(card3);

    // Card 4: Active streaks
    let activeStreaks = 0;
    for (let i = 0; i < habits.length; i++) {
      if (computeStreak(habits[i]) > 0) activeStreaks++;
    }
    const card4 = document.createElement('div');
    card4.className = 'stat-card';
    const c4Label = document.createElement('div');
    c4Label.className = 'stat-label';
    c4Label.textContent = 'Active streaks';
    const c4Value = document.createElement('div');
    c4Value.className = 'stat-value';
    c4Value.textContent = String(activeStreaks);
    const c4Unit = document.createElement('span');
    c4Unit.className = 'stat-unit';
    c4Unit.textContent = 'of ' + habits.length;
    c4Value.appendChild(c4Unit);
    const c4Trend = document.createElement('div');
    c4Trend.className = 'stat-trend';
    c4Trend.textContent = activeStreaks > 0 ? 'On track' : 'Start today';
    card4.appendChild(c4Label);
    card4.appendChild(c4Value);
    card4.appendChild(c4Trend);
    grid.appendChild(card4);

    stack.appendChild(grid);

    // Spark chart
    const sparkCard = document.createElement('div');
    sparkCard.className = 'stat-card';
    sparkCard.style.minHeight = 'auto';

    const sparkLabel = document.createElement('div');
    sparkLabel.className = 'stat-label';
    sparkLabel.textContent = 'Hours per ' + (period === 'week' ? 'day' : (period === 'month' ? 'week' : 'month'));
    sparkCard.appendChild(sparkLabel);

    const buckets = bucketByPeriod(days, dailyMinutes);
    let maxBucket = 1;
    for (let i = 0; i < buckets.length; i++) if (buckets[i].minutes > maxBucket) maxBucket = buckets[i].minutes;

    const chart = document.createElement('div');
    chart.className = 'stat-chart';
    chart.style.height = '80px';
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      const bar = document.createElement('div');
      bar.className = 'sc-bar' + (b.minutes === maxBucket && maxBucket > 0 ? ' peak' : '');
      const hPx = Math.max(2, Math.round((b.minutes / maxBucket) * 76));
      bar.style.height = hPx + 'px';
      const hours = Math.round((b.minutes / 60) * 10) / 10;
      bar.title = b.label + ': ' + hours + 'h';
      chart.appendChild(bar);
    }
    sparkCard.appendChild(chart);

    const barLabels = document.createElement('div');
    barLabels.style.cssText = 'display:flex;gap:3px;margin-top:4px;';
    for (let i = 0; i < buckets.length; i++) {
      const l = document.createElement('div');
      l.style.cssText = 'flex:1;font-size:9px;color:var(--text-faint);text-align:center;';
      l.textContent = buckets[i].label;
      barLabels.appendChild(l);
    }
    sparkCard.appendChild(barLabels);
    stack.appendChild(sparkCard);

    // Category split
    const splitCard = document.createElement('div');
    splitCard.className = 'stat-card';
    splitCard.style.minHeight = 'auto';

    const splitLabel = document.createElement('div');
    splitLabel.className = 'stat-label';
    splitLabel.textContent = 'Time by category';
    splitCard.appendChild(splitLabel);

    const split = document.createElement('div');
    split.className = 'stat-split';

    const catEntries = [];
    categoryMinutes.forEach(function (mins, key) {
      const cat = categories.find(function (c) { return c.id === key; });
      catEntries.push({
        label: cat ? cat.name : 'Uncategorized',
        color: cat ? cat.color : 'var(--text-faint)',
        minutes: mins
      });
    });
    catEntries.sort(function (a, b) { return b.minutes - a.minutes; });

    if (catEntries.length === 0) {
      const noData = document.createElement('div');
      noData.style.cssText = 'font-size:var(--fs-12);color:var(--text-muted);padding:var(--sp-3) 0;';
      noData.textContent = 'No blocks planned in this range yet.';
      split.appendChild(noData);
    } else {
      const top = catEntries.slice(0, 6);
      const maxCat = top[0].minutes || 1;
      for (let i = 0; i < top.length; i++) {
        const entry = top[i];
        const row = document.createElement('div');
        row.className = 'stat-split-row';
        const lbl = document.createElement('span');
        lbl.className = 's-label';
        lbl.textContent = entry.label;
        const track = document.createElement('span');
        track.className = 's-bar-track';
        const fill = document.createElement('span');
        fill.className = 's-bar-fill';
        fill.style.width = Math.max(2, Math.round((entry.minutes / maxCat) * 100)) + '%';
        fill.style.setProperty('--c', entry.color);
        track.appendChild(fill);
        const val = document.createElement('span');
        val.className = 's-value';
        const h = Math.floor(entry.minutes / 60);
        const m = entry.minutes % 60;
        val.textContent = m > 0 ? h + 'h' + m : h + 'h';
        row.appendChild(lbl);
        row.appendChild(track);
        row.appendChild(val);
        split.appendChild(row);
      }
    }

    splitCard.appendChild(split);
    stack.appendChild(splitCard);
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
    t.textContent = 'Could not load statistics';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
