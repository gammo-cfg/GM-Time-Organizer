// =====================================================================
// Habit editor modal — title, color, weekdays, delete (edit mode only).
// =====================================================================

import { api } from './api.js';
import { openModal, toast, confirm, buildColorPicker } from './ui.js';

const WEEKDAY_SHORT = ['S','M','T','W','T','F','S'];

function buildTextField(label, type, value, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lbl = document.createElement('label');
  lbl.className = 'field-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.className = 'input';
  input.type = type;
  if (value !== undefined && value !== null) input.value = String(value);
  if (placeholder) input.placeholder = placeholder;
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return { wrap: wrap, input: input };
}

export async function openHabitModal(opts) {
  const options = opts || {};
  const existing = options.existing || null;
  const onSave = options.onSave;
  const onDelete = options.onDelete;
  const isEdit = !!existing;

  const form = document.createElement('div');
  form.className = 'form';

  const titleF = buildTextField('Habit name', 'text', existing ? existing.title : '', 'Morning walk');
  titleF.input.maxLength = 120;
  form.appendChild(titleF.wrap);

  const colorWrap = document.createElement('div');
  colorWrap.className = 'field';
  const colorLbl = document.createElement('label');
  colorLbl.className = 'field-label';
  colorLbl.textContent = 'Color';
  colorWrap.appendChild(colorLbl);
  const initialColor = existing ? existing.color : '#6E8B6B';
  const picker = buildColorPicker(initialColor);
  colorWrap.appendChild(picker);
  form.appendChild(colorWrap);

  const wdWrap = document.createElement('div');
  wdWrap.className = 'field';
  const wdLbl = document.createElement('label');
  wdLbl.className = 'field-label';
  wdLbl.textContent = 'Scheduled days';
  wdWrap.appendChild(wdLbl);
  const wdPicker = document.createElement('div');
  wdPicker.className = 'weekday-picker';
  let selected = (existing && Array.isArray(existing.weekdays) && existing.weekdays.length > 0)
    ? existing.weekdays.slice()
    : [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < 7; i++) {
    (function (day) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'weekday-btn' + (selected.indexOf(day) !== -1 ? ' is-on' : '');
      b.textContent = WEEKDAY_SHORT[day];
      b.addEventListener('click', () => {
        const idx = selected.indexOf(day);
        if (idx === -1) {
          selected = selected.concat([day]);
          b.classList.add('is-on');
        } else {
          selected = selected.filter(d => d !== day);
          b.classList.remove('is-on');
        }
      });
      wdPicker.appendChild(b);
    })(i);
  }
  wdWrap.appendChild(wdPicker);
  form.appendChild(wdWrap);

  async function save() {
    const title = titleF.input.value.trim();
    if (!title) { toast('Name is required.', 'danger'); titleF.input.focus(); return false; }
    if (selected.length === 0) { toast('Pick at least one day.', 'danger'); return false; }
    const color = picker.getValue();
    const weekdays = selected.slice().sort((a, b) => a - b);
    const payload = {
      title: title,
      weekdays: weekdays,
      color: color,
      logs: existing ? (existing.logs || {}) : {}
    };
    try {
      let res;
      if (isEdit) res = await api.update('habits', existing.id, payload);
      else res = await api.create('habits', payload);
      toast(isEdit ? 'Habit updated.' : 'Habit created.', 'success');
      if (typeof onSave === 'function') onSave(res.data);
      return res.data;
    } catch (e) {
      toast('Save failed: ' + (e && e.message ? e.message : 'error'), 'danger');
      return false;
    }
  }

  async function doDelete() {
    const ok = await confirm('Delete habit', 'Delete "' + existing.title + '"? All logs will be lost.');
    if (!ok) return false;
    try {
      await api.remove('habits', existing.id);
      toast('Habit deleted.', 'success');
      if (typeof onDelete === 'function') onDelete(existing);
      return null;
    } catch (e) {
      toast('Could not delete: ' + (e && e.message ? e.message : 'error'), 'danger');
      return false;
    }
  }

  const actions = [];
  if (isEdit) actions.push({ label: 'Delete', variant: 'danger', onClick: doDelete });
  actions.push({ label: 'Cancel', variant: 'secondary', value: null });
  actions.push({ label: isEdit ? 'Save' : 'Create', variant: 'primary', onClick: save });

  return await openModal({
    title: isEdit ? 'Edit habit' : 'New habit',
    body: form,
    actions: actions
  });
}
