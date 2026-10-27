// =====================================================================
// Block editor modal — reusable, imports the modal helper from ui.js.
// Used by the Blocks list view and by the Today timeline.
//
// Options:
//   categories   — array of { id, name, color }
//   existing     — existing block to edit (null to create)
//   defaultDate  — YYYY-MM-DD used as the seed for recurrence
//   preset       — { start: 'HH:MM', end: 'HH:MM' } for click-to-create
//   onSave       — called with the saved block after a successful write
// =====================================================================

import { api } from './api.js';
import { openModal, toast } from './ui.js';
import { todayIso } from './utils.js';

const WEEKDAY_SHORT = ['S','M','T','W','T','F','S'];

function buildField(label, type, value) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lbl = document.createElement('label');
  lbl.className = 'field-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.className = 'input';
  input.type = type;
  if (value !== undefined && value !== null && value !== '') input.value = String(value);
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return { wrap: wrap, input: input };
}

export async function openBlockModal(opts) {
  const options = opts || {};
  const categories = options.categories || [];
  const existing = options.existing || null;
  const defaultDate = options.defaultDate || todayIso();
  const preset = options.preset || null;
  const onSave = options.onSave;
  const isEdit = !!existing;

  const initRec = existing && existing.recurrence ? existing.recurrence : {
    type: 'none', weekdays: [], interval: 1, startDate: defaultDate, endDate: null
  };

  const initStart = existing ? existing.start : (preset && preset.start ? preset.start : '08:00');
  const initEnd = existing ? existing.end : (preset && preset.end ? preset.end : '09:00');

  const form = document.createElement('div');
  form.className = 'form';

  const titleF = buildField('Title', 'text', existing ? existing.title : '');
  titleF.input.placeholder = 'Focus block';
  titleF.input.maxLength = 120;
  form.appendChild(titleF.wrap);

  const catWrap = document.createElement('div');
  catWrap.className = 'field';
  const catLbl = document.createElement('label');
  catLbl.className = 'field-label';
  catLbl.textContent = 'Category';
  const catSel = document.createElement('select');
  catSel.className = 'input';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '\u2014 None \u2014';
  catSel.appendChild(noneOpt);
  for (const c of categories) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    catSel.appendChild(o);
  }
  catSel.value = (existing && existing.categoryId) ? existing.categoryId : '';
  catWrap.appendChild(catLbl);
  catWrap.appendChild(catSel);
  form.appendChild(catWrap);

  const timesRow = document.createElement('div');
  timesRow.className = 'form-row cols-2';
  const startF = buildField('Start', 'time', initStart);
  const endF = buildField('End', 'time', initEnd);
  timesRow.appendChild(startF.wrap);
  timesRow.appendChild(endF.wrap);
  form.appendChild(timesRow);

  const repeatField = document.createElement('div');
  repeatField.className = 'field';
  const repeatLbl = document.createElement('label');
  repeatLbl.className = 'field-label';
  repeatLbl.textContent = 'Repeat';
  repeatField.appendChild(repeatLbl);

  const typeSeg = document.createElement('div');
  typeSeg.className = 'seg';
  typeSeg.setAttribute('role', 'group');
  const typeBtns = {};
  const typeDefs = [
    { v: 'none', label: 'Never' },
    { v: 'daily', label: 'Every day' },
    { v: 'weekly', label: 'Selected days' },
    { v: 'custom', label: 'Custom' }
  ];
  for (const td of typeDefs) {
    const b = document.createElement('button');
    b.className = 'seg-btn' + (td.v === initRec.type ? ' is-on' : '');
    b.type = 'button';
    b.textContent = td.label;
    b.addEventListener('click', () => { state.type = td.v; paintTypes(); renderDynamic(); });
    typeBtns[td.v] = b;
    typeSeg.appendChild(b);
  }
  repeatField.appendChild(typeSeg);

  const dynamicArea = document.createElement('div');
  dynamicArea.style.marginTop = 'var(--sp-3)';
  repeatField.appendChild(dynamicArea);
  form.appendChild(repeatField);

  function paintTypes() {
    for (const k in typeBtns) typeBtns[k].classList.toggle('is-on', k === state.type);
  }

  const state = {
    type: initRec.type,
    none: { date: initRec.type === 'none' && initRec.startDate ? initRec.startDate : defaultDate },
    daily: {
      from: initRec.type === 'daily' && initRec.startDate ? initRec.startDate : '',
      to: initRec.type === 'daily' && initRec.endDate ? initRec.endDate : ''
    },
    weekly: {
      weekdays: initRec.type === 'weekly' && Array.isArray(initRec.weekdays) ? initRec.weekdays.slice() : [],
      from: initRec.type === 'weekly' && initRec.startDate ? initRec.startDate : '',
      to: initRec.type === 'weekly' && initRec.endDate ? initRec.endDate : ''
    },
    custom: {
      weekdays: initRec.type === 'custom' && Array.isArray(initRec.weekdays) ? initRec.weekdays.slice() : [],
      interval: initRec.type === 'custom' ? (initRec.interval || 1) : 1,
      from: initRec.type === 'custom' && initRec.startDate ? initRec.startDate : '',
      to: initRec.type === 'custom' && initRec.endDate ? initRec.endDate : ''
    }
  };

  function renderDynamic() {
    dynamicArea.innerHTML = '';
    const t = state.type;

    if (t === 'none') {
      const f = buildField('Date', 'date', state.none.date);
      f.input.addEventListener('change', () => { state.none.date = f.input.value; });
      dynamicArea.appendChild(f.wrap);
      return;
    }

    if (t === 'daily') {
      const row = document.createElement('div');
      row.className = 'form-row cols-2';
      const fromF = buildField('From (optional)', 'date', state.daily.from);
      fromF.input.addEventListener('change', () => { state.daily.from = fromF.input.value; });
      const toF = buildField('To (optional)', 'date', state.daily.to);
      toF.input.addEventListener('change', () => { state.daily.to = toF.input.value; });
      row.appendChild(fromF.wrap);
      row.appendChild(toF.wrap);
      dynamicArea.appendChild(row);
      return;
    }

    if (t === 'weekly' || t === 'custom') {
      const wdWrap = document.createElement('div');
      wdWrap.className = 'field';
      const wdLbl = document.createElement('label');
      wdLbl.className = 'field-label';
      wdLbl.textContent = 'On these days';
      wdWrap.appendChild(wdLbl);
      const picker = document.createElement('div');
      picker.className = 'weekday-picker';
      const selected = state[t].weekdays;
      for (let i = 0; i < 7; i++) {
        (function (day) {
          const b = document.createElement('button');
          b.className = 'weekday-btn' + (selected.indexOf(day) !== -1 ? ' is-on' : '');
          b.type = 'button';
          b.textContent = WEEKDAY_SHORT[day];
          b.addEventListener('click', () => {
            const arr = state[t].weekdays;
            const idx = arr.indexOf(day);
            if (idx === -1) {
              state[t].weekdays = arr.concat([day]).sort((a, b) => a - b);
              b.classList.add('is-on');
            } else {
              state[t].weekdays = arr.filter(d => d !== day);
              b.classList.remove('is-on');
            }
          });
          picker.appendChild(b);
        })(i);
      }
      wdWrap.appendChild(picker);
      dynamicArea.appendChild(wdWrap);

      if (t === 'custom') {
        const intF = buildField('Every N weeks', 'number', state.custom.interval);
        intF.input.min = '1';
        intF.input.max = '12';
        intF.input.style.maxWidth = '100px';
        intF.input.addEventListener('change', () => {
          const n = parseInt(intF.input.value, 10);
          state.custom.interval = isNaN(n) || n < 1 ? 1 : n;
          intF.input.value = String(state.custom.interval);
        });
        dynamicArea.appendChild(intF.wrap);
      }

      const rangeRow = document.createElement('div');
      rangeRow.className = 'form-row cols-2';
      const fromLabel = t === 'custom' ? 'Starting from' : 'From (optional)';
      const fromF = buildField(fromLabel, 'date', state[t].from);
      fromF.input.addEventListener('change', () => { state[t].from = fromF.input.value; });
      const toF = buildField('To (optional)', 'date', state[t].to);
      toF.input.addEventListener('change', () => { state[t].to = toF.input.value; });
      rangeRow.appendChild(fromF.wrap);
      rangeRow.appendChild(toF.wrap);
      dynamicArea.appendChild(rangeRow);
    }
  }

  paintTypes();
  renderDynamic();

  function buildPayload() {
    const title = titleF.input.value.trim();
    if (!title) { toast('Title is required.', 'danger'); titleF.input.focus(); return null; }
    const start = startF.input.value;
    const end = endF.input.value;
    if (!start || !end) { toast('Start and end times are required.', 'danger'); return null; }
    if (start >= end) { toast('End must be after start.', 'danger'); return null; }

    let rec;
    if (state.type === 'none') {
      if (!state.none.date) { toast('Date is required.', 'danger'); return null; }
      rec = { type: 'none', weekdays: [], interval: 1, startDate: state.none.date, endDate: null };
    } else if (state.type === 'daily') {
      rec = { type: 'daily', weekdays: [], interval: 1, startDate: state.daily.from || null, endDate: state.daily.to || null };
    } else if (state.type === 'weekly') {
      if (!state.weekly.weekdays.length) { toast('Pick at least one day.', 'danger'); return null; }
      rec = { type: 'weekly', weekdays: state.weekly.weekdays.slice(), interval: 1, startDate: state.weekly.from || null, endDate: state.weekly.to || null };
    } else if (state.type === 'custom') {
      if (!state.custom.weekdays.length) { toast('Pick at least one day.', 'danger'); return null; }
      if (!state.custom.from) { toast('Starting date is required for custom recurrence.', 'danger'); return null; }
      rec = { type: 'custom', weekdays: state.custom.weekdays.slice(), interval: state.custom.interval, startDate: state.custom.from, endDate: state.custom.to || null };
    } else {
      return null;
    }

    return {
      title: title,
      categoryId: catSel.value || null,
      start: start,
      end: end,
      recurrence: rec,
      exceptions: (existing && Array.isArray(existing.exceptions)) ? existing.exceptions.slice() : []
    };
  }

  const result = await openModal({
    title: isEdit ? 'Edit block' : 'New block',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      {
        label: isEdit ? 'Save' : 'Create',
        variant: 'primary',
        onClick: async () => {
          const payload = buildPayload();
          if (!payload) return false;
          try {
            let res;
            if (isEdit) {
              res = await api.update('blocks', existing.id, payload);
            } else {
              res = await api.create('blocks', payload);
            }
            toast(isEdit ? 'Block updated.' : 'Block created.', 'success');
            if (typeof onSave === 'function') onSave(res.data);
            return res.data;
          } catch (e) {
            toast('Save failed: ' + (e && e.message ? e.message : 'error'), 'danger');
            return false;
          }
        }
      }
    ]
  });

  return result;
}
