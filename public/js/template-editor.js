// =====================================================================
// Template editor modal — used by:
//   - "Save as template" from the Day view (existing date, capture blocks)
//   - "From day…" button in Templates view
//   - "Rename" on an existing template
// =====================================================================

import { api } from './api.js';
import { openModal, toast, confirm } from './ui.js';
import { todayIso, formatShortDate } from './utils.js';

function stripBlockForTemplate(b) {
  return {
    title: b.title,
    notes: b.notes || '',
    categoryId: b.categoryId || null,
    start: b.start,
    end: b.end
  };
}

// Create from a specific day. Loads that day's blocks, opens a modal for the name.
export async function openSaveAsTemplate(sourceDate) {
  let blocksForDay = [];
  try {
    const res = await api.list('blocks');
    const all = (res && res.data) || [];
    blocksForDay = all.filter(function (b) {
      if (b.recurrence && b.recurrence.type && b.recurrence.type !== 'none') return false;
      return b.recurrence && b.recurrence.startDate === sourceDate;
    });
    if (blocksForDay.length === 0) {
      // Fallback: try to find any blocks matching the day via the day view cache
      const dayRes = await fetch('/api/blocks').then(r => r.json());
      const all2 = (dayRes && dayRes.data) || [];
      blocksForDay = all2.filter(function (b) {
        return b.recurrence && b.recurrence.type === 'none' && b.recurrence.startDate === sourceDate;
      });
    }
  } catch (e) {
    toast('Could not load blocks: ' + (e && e.message ? e.message : 'error'), 'danger');
    return null;
  }

  if (blocksForDay.length === 0) {
    toast('No one-off blocks on ' + formatShortDate(sourceDate) + ' to capture.', 'danger');
    return null;
  }

  const form = document.createElement('div');
  form.className = 'form';

  const nameWrap = document.createElement('div');
  nameWrap.className = 'field';
  const nameLbl = document.createElement('label');
  nameLbl.className = 'field-label';
  nameLbl.textContent = 'Template name';
  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.type = 'text';
  nameInput.maxLength = 80;
  nameInput.value = 'Day of ' + formatShortDate(sourceDate);
  nameInput.placeholder = 'Productive day';
  nameWrap.appendChild(nameLbl);
  nameWrap.appendChild(nameInput);
  form.appendChild(nameWrap);

  const previewWrap = document.createElement('div');
  previewWrap.className = 'apply-preview';
  const previewTitle = document.createElement('div');
  previewTitle.className = 'apply-preview-title';
  previewTitle.textContent = 'Captured from ' + formatShortDate(sourceDate) + ' \u00B7 ' + blocksForDay.length + ' block' + (blocksForDay.length === 1 ? '' : 's');
  previewWrap.appendChild(previewTitle);

  const previewBody = document.createElement('div');
  previewBody.className = 'apply-preview-body';
  const sorted = blocksForDay.slice().sort(function (a, b) { return a.start.localeCompare(b.start); });
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const line = document.createElement('div');
    line.style.padding = '2px 0';
    line.textContent = b.start + ' \u2013 ' + b.end + '   ' + b.title;
    previewBody.appendChild(line);
  }
  previewWrap.appendChild(previewBody);

  const hint = document.createElement('div');
  hint.className = 'apply-preview-hint';
  hint.textContent = 'The template stores only the shape of the day \u2014 title, time, notes, category. Nothing else.';
  previewWrap.appendChild(hint);
  form.appendChild(previewWrap);

  async function save() {
    const name = nameInput.value.trim();
    if (!name) { toast('Name is required.', 'danger'); nameInput.focus(); return false; }
    const payload = {
      name: name,
      blocks: blocksForDay.map(stripBlockForTemplate)
    };
    try {
      const res = await api.create('templates', payload);
      toast('Template "' + name + '" saved.', 'success');
      return res.data;
    } catch (e) {
      toast('Save failed: ' + (e && e.message ? e.message : 'error'), 'danger');
      return false;
    }
  }

  return await openModal({
    title: 'Save day as template',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      { label: 'Save template', variant: 'primary', onClick: save }
    ]
  });
}

// Rename an existing template
export async function openRenameTemplate(existing) {
  const form = document.createElement('div');
  form.className = 'form';

  const nameWrap = document.createElement('div');
  nameWrap.className = 'field';
  const nameLbl = document.createElement('label');
  nameLbl.className = 'field-label';
  nameLbl.textContent = 'Template name';
  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.type = 'text';
  nameInput.maxLength = 80;
  nameInput.value = existing.name;
  nameWrap.appendChild(nameLbl);
  nameWrap.appendChild(nameInput);
  form.appendChild(nameWrap);

  async function save() {
    const name = nameInput.value.trim();
    if (!name) { toast('Name is required.', 'danger'); nameInput.focus(); return false; }
    try {
      const res = await api.update('templates', existing.id, {
        name: name,
        blocks: existing.blocks || []
      });
      toast('Template renamed.', 'success');
      return res.data;
    } catch (e) {
      toast('Save failed: ' + (e && e.message ? e.message : 'error'), 'danger');
      return false;
    }
  }

  return await openModal({
    title: 'Rename template',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      { label: 'Save', variant: 'primary', onClick: save }
    ]
  });
}

export async function confirmDeleteTemplate(existing) {
  const ok = await confirm(
    'Delete template',
    'Delete "' + existing.name + '"? This does not affect blocks already on the calendar.'
  );
  if (!ok) return false;
  try {
    await api.remove('templates', existing.id);
    toast('Template deleted.', 'success');
    return true;
  } catch (e) {
    toast('Could not delete: ' + (e && e.message ? e.message : 'error'), 'danger');
    return false;
  }
}

// Pick a date, then save that day as a template
export async function openFromDayDialog() {
  const form = document.createElement('div');
  form.className = 'form';

  const dateWrap = document.createElement('div');
  dateWrap.className = 'field';
  const dateLbl = document.createElement('label');
  dateLbl.className = 'field-label';
  dateLbl.textContent = 'Which day should I capture?';
  const dateInput = document.createElement('input');
  dateInput.className = 'input';
  dateInput.type = 'date';
  dateInput.value = todayIso();
  dateWrap.appendChild(dateLbl);
  dateWrap.appendChild(dateInput);
  form.appendChild(dateWrap);

  const hint = document.createElement('div');
  hint.className = 'field-hint';
  hint.textContent = 'Only one-off blocks on that exact date are captured. Recurring blocks are ignored.';
  form.appendChild(hint);

  const picked = await openModal({
    title: 'New template from a day',
    body: form,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: null },
      { label: 'Next', variant: 'primary', onClick: function () { return dateInput.value || false; } }
    ]
  });

  if (!picked) return;
  await openSaveAsTemplate(picked);
}
