// =====================================================================
// Apply template modal — pick a template, pick date(s), preview, apply.
// =====================================================================

import { api } from './api.js';
import { openModal, toast } from './ui.js';
import { getSettings } from './app.js';
import {
  todayIso, addDays, parseIso, toIso, startOfWeek, formatShortDate, WEEKDAY_SHORT
} from './utils.js';

function enumerateDates(fromIso, toIsoDate, mode, customWeekdays) {
  const out = [];
  let cur = fromIso;
  while (cur <= toIsoDate) {
    const wd = parseIso(cur).getDay();
    if (mode === 'all') out.push(cur);
    else if (mode === 'weekdays') { if (wd >= 1 && wd <= 5) out.push(cur); }
    else if (mode === 'custom') { if (customWeekdays.indexOf(wd) !== -1) out.push(cur); }
    cur = addDays(cur, 1);
  }
  return out;
}

export async function openApplyTemplate(options) {
  const opts = options || {};
  let templates = [];
  let categories = [];
  let allBlocks = [];

  try {
    const [tRes, cRes, bRes] = await Promise.all([
      api.list('templates'),
      api.list('categories'),
      api.list('blocks')
    ]);
    templates = (tRes && tRes.data) || [];
    categories = (cRes && cRes.data) || [];
    allBlocks = (bRes && bRes.data) || [];
  } catch (e) {
    toast('Could not load templates: ' + (e && e.message ? e.message : 'error'), 'danger');
    return null;
  }

  if (templates.length === 0) {
    toast('No templates yet. Save a day as a template first.', 'danger');
    return null;
  }

  const settings = getSettings();
  const today = todayIso();

  // ---- Form ----
  const form = document.createElement('div');
  form.className = 'form';

  // Template picker
  const tplWrap = document.createElement('div');
  tplWrap.className = 'field';
  const tplLbl = document.createElement('label');
  tplLbl.className = 'field-label';
  tplLbl.textContent = 'Template';
  const tplSel = document.createElement('select');
  tplSel.className = 'input';
  for (let i = 0; i < templates.length; i++) {
    const o = document.createElement('option');
    o.value = templates[i].id;
    o.textContent = templates[i].name + '  (' + (templates[i].blocks || []).length + ' blocks)';
    tplSel.appendChild(o);
  }
  if (opts.preselectTemplateId) tplSel.value = opts.preselectTemplateId;
  tplWrap.appendChild(tplLbl);
  tplWrap.appendChild(tplSel);
  form.appendChild(tplWrap);

  // Range type segmented
  const rangeWrap = document.createElement('div');
  rangeWrap.className = 'field';
  const rangeLbl = document.createElement('label');
  rangeLbl.className = 'field-label';
  rangeLbl.textContent = 'When';
  rangeWrap.appendChild(rangeLbl);

  const rangeSeg = document.createElement('div');
  rangeSeg.className = 'seg';
  rangeSeg.setAttribute('role', 'group');
  const rangeBtnSingle = document.createElement('button');
  rangeBtnSingle.type = 'button';
  rangeBtnSingle.className = 'seg-btn is-on';
  rangeBtnSingle.textContent = 'One day';
  const rangeBtnRange = document.createElement('button');
  rangeBtnRange.type = 'button';
  rangeBtnRange.className = 'seg-btn';
  rangeBtnRange.textContent = 'Date range';
  rangeSeg.appendChild(rangeBtnSingle);
  rangeSeg.appendChild(rangeBtnRange);
  rangeWrap.appendChild(rangeSeg);
  form.appendChild(rangeWrap);

  let rangeMode = 'single';

  // Single-date field
  const singleWrap = document.createElement('div');
  singleWrap.className = 'field';
  const singleLbl = document.createElement('label');
  singleLbl.className = 'field-label';
  singleLbl.textContent = 'Date';
  const singleInput = document.createElement('input');
  singleInput.className = 'input';
  singleInput.type = 'date';
  singleInput.value = today;
  singleWrap.appendChild(singleLbl);
  singleWrap.appendChild(singleInput);
  form.appendChild(singleWrap);

  // Range fields
  const rangeFields = document.createElement('div');
  rangeFields.style.display = 'none';
  rangeFields.style.flexDirection = 'column';
  rangeFields.style.gap = 'var(--sp-3)';

  const fromToRow = document.createElement('div');
  fromToRow.className = 'form-row cols-2';
  const fromWrap = document.createElement('div');
  fromWrap.className = 'field';
  const fromLbl = document.createElement('label');
  fromLbl.className = 'field-label';
  fromLbl.textContent = 'From';
  const fromInput = document.createElement('input');
  fromInput.className = 'input';
  fromInput.type = 'date';
  fromInput.value = today;
  fromWrap.appendChild(fromLbl);
  fromWrap.appendChild(fromInput);

  const toWrap = document.createElement('div');
  toWrap.className = 'field';
  const toLbl = document.createElement('label');
  toLbl.className = 'field-label';
  toLbl.textContent = 'To';
  const toInput = document.createElement('input');
  toInput.className = 'input';
  toInput.type = 'date';
  toInput.value = addDays(today, 6);
  toWrap.appendChild(toLbl);
  toWrap.appendChild(toInput);

  fromToRow.appendChild(fromWrap);
  fromToRow.appendChild(toWrap);
  rangeFields.appendChild(fromToRow);

  // Weekday filter
  const wdWrap = document.createElement('div');
  wdWrap.className = 'field';
  const wdLbl = document.createElement('label');
  wdLbl.className = 'field-label';
  wdLbl.textContent = 'Which days';
  wdWrap.appendChild(wdLbl);
  const wdSeg = document.createElement('div');
  wdSeg.className = 'seg';
  const wdBtnAll = document.createElement('button');
  wdBtnAll.type = 'button';
  wdBtnAll.className = 'seg-btn is-on';
  wdBtnAll.textContent = 'All';
  const wdBtnWeekdays = document.createElement('button');
  wdBtnWeekdays.type = 'button';
  wdBtnWeekdays.className = 'seg-btn';
  wdBtnWeekdays.textContent = 'Mon\u2013Fri';
  const wdBtnCustom = document.createElement('button');
  wdBtnCustom.type = 'button';
  wdBtnCustom.className = 'seg-btn';
  wdBtnCustom.textContent = 'Custom';
  wdSeg.appendChild(wdBtnAll);
  wdSeg.appendChild(wdBtnWeekdays);
  wdSeg.appendChild(wdBtnCustom);
  wdWrap.appendChild(wdSeg);

  let wdMode = 'all';
  let customWeekdays = [1, 2, 3, 4, 5];

  const customPicker = document.createElement('div');
  customPicker.className = 'weekday-picker';
  customPicker.style.display = 'none';
  customPicker.style.marginTop = 'var(--sp-2)';
  const wdButtons = [];
  for (let i = 0; i < 7; i++) {
    (function (day) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'weekday-btn' + (customWeekdays.indexOf(day) !== -1 ? ' is-on' : '');
      b.textContent = WEEKDAY_SHORT[day];
      b.addEventListener('click', function () {
        const idx = customWeekdays.indexOf(day);
        if (idx === -1) { customWeekdays = customWeekdays.concat([day]).sort((a,b)=>a-b); b.classList.add('is-on'); }
        else { customWeekdays = customWeekdays.filter(function (x) { return x !== day; }); b.classList.remove('is-on'); }
        updatePreview();
      });
      wdButtons.push(b);
      customPicker.appendChild(b);
    })(i);
  }
  wdWrap.appendChild(customPicker);
  rangeFields.appendChild(wdWrap);

  // Skip existing
  const skipWrap = document.createElement('div');
  skipWrap.className = 'field';
  const skipLabel = document.createElement('label');
  skipLabel.className = 'checkbox';
  const skipInput = document.createElement('input');
  skipInput.type = 'checkbox';
  skipInput.checked = true;
  const skipBox = document.createElement('span');
  skipBox.className = 'checkbox-box';
  skipLabel.appendChild(skipInput);
  skipLabel.appendChild(skipBox);
  skipLabel.appendChild(document.createTextNode('Skip dates that already have blocks'));
  skipWrap.appendChild(skipLabel);
  rangeFields.appendChild(skipWrap);

  form.appendChild(rangeFields);

  // Preview
  const previewWrap = document.createElement('div');
  previewWrap.className = 'apply-preview';
  const previewTitle = document.createElement('div');
  previewTitle.className = 'apply-preview-title';
  previewTitle.textContent = 'Preview';
  const previewBody = document.createElement('div');
  previewBody.className = 'apply-preview-body';
  const dateList = document.createElement('div');
  dateList.className = 'apply-date-list';
  previewWrap.appendChild(previewTitle);
  previewWrap.appendChild(previewBody);
  previewWrap.appendChild(dateList);
  form.appendChild(previewWrap);

  // ---- Compute state and update preview ----
  function getSelectedTemplate() {
    for (let i = 0; i < templates.length; i++) {
      if (templates[i].id === tplSel.value) return templates[i];
    }
    return null;
  }

  function getBlocksExistingByDate() {
    const map = new Map();
    for (let i = 0; i < allBlocks.length; i++) {
      const b = allBlocks[i];
      const rec = b.recurrence || {};
      if (rec.type === 'none' && rec.startDate) {
        if (!map.has(rec.startDate)) map.set(rec.startDate, 0);
        map.set(rec.startDate, map.get(rec.startDate) + 1);
      }
    }
    return map;
  }

  function computePlan() {
    const tpl = getSelectedTemplate();
    if (!tpl) return { dates: [], blocksPerDate: 0, willSkip: 0, willAdd: 0 };
    const blocksPerDate = (tpl.blocks || []).length;
    let dates = [];
    if (rangeMode === 'single') {
      if (singleInput.value) dates = [singleInput.value];
    } else {
      if (fromInput.value && toInput.value && fromInput.value <= toInput.value) {
        dates = enumerateDates(fromInput.value, toInput.value, wdMode, customWeekdays);
      }
    }
    const existingMap = getBlocksExistingByDate();
    let willSkip = 0, willAdd = 0;
    const annotated = dates.map(function (iso) {
      const existingCount = existingMap.get(iso) || 0;
      const skip = skipInput.checked && existingCount > 0;
      if (skip) willSkip++;
      else willAdd++;
      return { iso: iso, skip: skip, existingCount: existingCount };
    });
    return { dates: annotated, blocksPerDate: blocksPerDate, willSkip: willSkip, willAdd: willAdd };
  }

  function updatePreview() {
    const p = computePlan();
    const totalBlocks = p.willAdd * p.blocksPerDate;
    previewBody.innerHTML = '';
    if (p.dates.length === 0) {
      previewBody.textContent = 'Pick a date or date range to see what will happen.';
      dateList.innerHTML = '';
      return;
    }
    const strong = document.createElement('strong');
    strong.textContent = String(totalBlocks);
    previewBody.appendChild(strong);
    previewBody.appendChild(document.createTextNode(' block' + (totalBlocks === 1 ? '' : 's') + ' will be created across '));
    const strong2 = document.createElement('strong');
    strong2.textContent = String(p.willAdd);
    previewBody.appendChild(strong2);
    previewBody.appendChild(document.createTextNode(' day' + (p.willAdd === 1 ? '' : 's')));
    if (p.willSkip > 0) {
      previewBody.appendChild(document.createTextNode('  ('));
      previewBody.appendChild(document.createTextNode(String(p.willSkip) + ' day' + (p.willSkip === 1 ? '' : 's') + ' will be skipped'));
      previewBody.appendChild(document.createTextNode(')'));
    }
    dateList.innerHTML = '';
    for (let i = 0; i < p.dates.length; i++) {
      const d = p.dates[i];
      const chip = document.createElement('span');
      chip.className = 'apply-date-chip ' + (d.skip ? 'will-skip' : 'will-add');
      chip.textContent = formatShortDate(d.iso) + (d.skip ? ' (skip)' : '');
      chip.title = d.existingCount > 0 ? (d.existingCount + ' existing block' + (d.existingCount === 1 ? '' : 's')) : 'Empty';
      dateList.appendChild(chip);
    }
  }

  // Wire events
  rangeBtnSingle.addEventListener('click', function () {
    rangeMode = 'single';
    rangeBtnSingle.classList.add('is-on');
    rangeBtnRange.classList.remove('is-on');
    singleWrap.style.display = '';
    rangeFields.style.display = 'none';
    updatePreview();
  });
  rangeBtnRange.addEventListener('click', function () {
    rangeMode = 'range';
    rangeBtnRange.classList.add('is-on');
    rangeBtnSingle.classList.remove('is-on');
    singleWrap.style.display = 'none';
    rangeFields.style.display = 'flex';
    updatePreview();
  });

  wdBtnAll.addEventListener('click', function () {
    wdMode = 'all';
    wdBtnAll.classList.add('is-on');
    wdBtnWeekdays.classList.remove('is-on');
    wdBtnCustom.classList.remove('is-on');
    customPicker.style.display = 'none';
    updatePreview();
  });
  wdBtnWeekdays.addEventListener('click', function () {
    wdMode = 'weekdays';
    wdBtnWeekdays.classList.add('is-on');
    wdBtnAll.classList.remove('is-on');
    wdBtnCustom.classList.remove('is-on');
    customPicker.style.display = 'none';
    updatePreview();
  });
  wdBtnCustom.addEventListener('click', function () {
    wdMode = 'custom';
    wdBtnCustom.classList.add('is-on');
    wdBtnAll.classList.remove('is-on');
    wdBtnWeekdays.classList.remove('is-on');
    customPicker.style.display = 'flex';
    updatePreview();
  });

  tplSel.addEventListener('change', updatePreview);
  singleInput.addEventListener('change', updatePreview);
  fromInput.addEventListener('change', updatePreview);
  toInput.addEventListener('change', updatePreview);
  skipInput.addEventListener('change', updatePreview);

  updatePreview();

  // ---- Apply ----
  async function apply() {
    const p = computePlan();
    const tpl = getSelectedTemplate();
    if (!tpl) { toast('Pick a template.', 'danger'); return false; }
    if (p.willAdd === 0) {
      toast('Nothing to apply \u2014 every selected date is skipped.', 'danger');
      return false;
    }

    // Build set of existing category IDs so we don't reference deleted ones
    const catSet = new Set();
    for (let i = 0; i < categories.length; i++) catSet.add(categories[i].id);

    // Pre-build all blocks
    const additions = [];
    for (let i = 0; i < p.dates.length; i++) {
      const d = p.dates[i];
      if (d.skip) continue;
      for (let j = 0; j < (tpl.blocks || []).length; j++) {
        const tb = tpl.blocks[j];
        additions.push({
          title: tb.title,
          notes: tb.notes || '',
          categoryId: (tb.categoryId && catSet.has(tb.categoryId)) ? tb.categoryId : null,
          start: tb.start,
          end: tb.end,
          recurrence: { type: 'none', weekdays: [], interval: 1, startDate: d.iso, endDate: null },
          exceptions: []
        });
      }
    }

    try {
      // Fire them sequentially to keep the server's per-entity write queue sane
      for (let i = 0; i < additions.length; i++) {
        await api.create('blocks', additions[i]);
      }
      toast('Created ' + additions.length + ' block' + (additions.length === 1 ? '' : 's') + '.', 'success');
      return true;
    } catch (e) {
      toast('Apply failed after some blocks were created. Check your calendar.', 'danger');
      return false;
    }
  }

  return await openModal({
    title: 'Apply template',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      { label: 'Apply', variant: 'primary', onClick: apply }
    ]
  });
}
