// =====================================================================
// Task editor modal — v2.1. Adds recurrence (Repeat) support.
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

export async function openTaskModal(opts) {
  const options = opts || {};
  const categories = options.categories || [];
  const existing = options.existing || null;
  const defaultDueDate = options.defaultDueDate !== undefined ? options.defaultDueDate : todayIso();
  const onSave = options.onSave;
  const isEdit = !!existing;

  const initRec = (existing && existing.recurrence) || { type: 'none', weekdays: [], interval: 1, startDate: null, endDate: null };

  const form = document.createElement('div');
  form.className = 'form';

  // --- Title ---
  const titleF = buildField('Title', 'text', existing ? existing.title : '');
  titleF.input.placeholder = 'What needs to be done?';
  titleF.input.maxLength = 200;
  form.appendChild(titleF.wrap);

  // --- Notes ---
  const notesWrap = document.createElement('div');
  notesWrap.className = 'field';
  const notesLbl = document.createElement('label');
  notesLbl.className = 'field-label';
  notesLbl.textContent = 'Notes (optional)';
  const notesTa = document.createElement('textarea');
  notesTa.className = 'input';
  notesTa.rows = 3;
  notesTa.maxLength = 2000;
  notesTa.placeholder = 'Any context\u2026';
  if (existing && existing.notes) notesTa.value = existing.notes;
  notesWrap.appendChild(notesLbl);
  notesWrap.appendChild(notesTa);
  form.appendChild(notesWrap);

  // --- Category ---
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

  // --- Due date ---
  const dueF = buildField('Due date', 'date', existing ? existing.dueDate : defaultDueDate);
  form.appendChild(dueF.wrap);

  // --- Repeat segmented control ---
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

  const state = {
    type: initRec.type,
    none: {},
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

  const dynamicArea = document.createElement('div');
  dynamicArea.style.marginTop = 'var(--sp-3)';
  repeatField.appendChild(dynamicArea);

  function paintTypes() {
    for (const k in typeBtns) typeBtns[k].classList.toggle('is-on', k === state.type);
  }

  function renderDynamic() {
    dynamicArea.innerHTML = '';
    const t = state.type;

    if (t === 'none') {
      const hint = document.createElement('div');
      hint.className = 'field-hint';
      hint.textContent = 'One-off task. Checking it off marks it done.';
      dynamicArea.appendChild(hint);
      return;
    }

    // Info hint
    const info = document.createElement('div');
    info.className = 'field-hint';
    info.style.marginBottom = 'var(--sp-3)';
    info.textContent = 'When you check it off, the due date advances to the next occurrence.';
    dynamicArea.appendChild(info);

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
  form.appendChild(repeatField);

  paintTypes();
  renderDynamic();

  // --- Priority ---
  const prioWrap = document.createElement('div');
  prioWrap.className = 'field';
  const prioLbl = document.createElement('label');
  prioLbl.className = 'field-label';
  prioLbl.textContent = 'Priority';
  prioWrap.appendChild(prioLbl);
  const prioSeg = document.createElement('div');
  prioSeg.className = 'seg';
  prioSeg.setAttribute('role', 'group');
  const priorities = [
    { v: 'low', label: 'Low' },
    { v: 'normal', label: 'Normal' },
    { v: 'high', label: 'High' }
  ];
  let currentPriority = existing ? existing.priority : 'normal';
  const prioBtns = {};
  for (const p of priorities) {
    const b = document.createElement('button');
    b.className = 'seg-btn' + (p.v === currentPriority ? ' is-on' : '');
    b.type = 'button';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      currentPriority = p.v;
      for (const k in prioBtns) prioBtns[k].classList.toggle('is-on', k === currentPriority);
    });
    prioBtns[p.v] = b;
    prioSeg.appendChild(b);
  }
  prioWrap.appendChild(prioSeg);
  form.appendChild(prioWrap);

  function buildPayload() {
    const title = titleF.input.value.trim();
    if (!title) { toast('Title is required.', 'danger'); titleF.input.focus(); return null; }

    const dueDate = dueF.input.value || null;

    let rec;
    if (state.type === 'none') {
      if (!dueDate) { toast('Due date is required.', 'danger'); dueF.input.focus(); return null; }
      rec = { type: 'none', weekdays: [], interval: 1, startDate: null, endDate: null };
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
      notes: notesTa.value.trim(),
      categoryId: catSel.value || null,
      dueDate: dueDate,
      priority: currentPriority,
      done: existing ? !!existing.done : false,
      recurrence: rec,
      completedDates: (existing && Array.isArray(existing.completedDates)) ? existing.completedDates.slice() : []
    };
  }

  async function save() {
    const payload = buildPayload();
    if (!payload) return false;

    try {
      let res;
      if (isEdit) res = await api.update('tasks', existing.id, payload);
      else res = await api.create('tasks', payload);
      toast(isEdit ? 'Task updated.' : 'Task created.', 'success');
      if (typeof onSave === 'function') onSave(res.data);
      return res.data;
    } catch (e) {
      toast('Save failed: ' + (e && e.message ? e.message : 'error'), 'danger');
      return false;
    }
  }

  return await openModal({
    title: isEdit ? 'Edit task' : 'New task',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      { label: isEdit ? 'Save' : 'Create', variant: 'primary', onClick: save }
    ]
  });
}
