// =====================================================================
// Export / Import helpers — bundle and restore the entire data set.
// Refuses to submit a JSON file that isn't recognisable as a backup.
// =====================================================================

import { toast, confirm } from './ui.js';

const KNOWN_KEYS = ['settings', 'categories', 'blocks', 'tasks', 'habits', 'templates'];

export async function exportAll() {
  try {
    const r = await fetch('/api/export', { cache: 'no-store' });
    if (!r.ok) throw new Error('Server returned ' + r.status);
    const data = await r.json();
    const d = new Date();
    const pad = (n) => n < 10 ? '0' + n : String(n);
    const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    const filename = 'time-organizer-backup-' + stamp + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported ' + filename, 'success');
  } catch (e) {
    toast('Export failed: ' + (e && e.message ? e.message : 'error'), 'danger');
  }
}

export async function importAll() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) { fileInput.remove(); return; }

    let parsed = null;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (e) {
      toast('Not a valid JSON file.', 'danger');
      fileInput.remove();
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast('Not a Time Organizer backup.', 'danger');
      fileInput.remove();
      return;
    }

    let hasAny = false;
    for (let i = 0; i < KNOWN_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(parsed, KNOWN_KEYS[i])) { hasAny = true; break; }
    }
    if (!hasAny) {
      toast('This file does not look like a Time Organizer backup.', 'danger');
      fileInput.remove();
      return;
    }

    const counts = [];
    if (Array.isArray(parsed.categories)) counts.push(parsed.categories.length + ' categories');
    if (Array.isArray(parsed.blocks)) counts.push(parsed.blocks.length + ' blocks');
    if (Array.isArray(parsed.tasks)) counts.push(parsed.tasks.length + ' tasks');
    if (Array.isArray(parsed.habits)) counts.push(parsed.habits.length + ' habits');
    if (Array.isArray(parsed.templates)) counts.push(parsed.templates.length + ' templates');

    const ok = await confirm(
      'Replace all data?',
      'This will REPLACE your current data with: ' + (counts.length ? counts.join(', ') : 'nothing meaningful') + '. Automatic backups of the current files will be kept in data/backups. Continue?'
    );
    if (!ok) { fileInput.remove(); return; }

    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      const res = await r.json();
      if (!r.ok || !res.ok) {
        const msg = res && res.message ? res.message : ('HTTP ' + r.status);
        toast('Import failed: ' + msg, 'danger');
      } else {
        toast('Imported ' + (res.imported || []).length + ' data sets. Reloading\u2026', 'success');
        setTimeout(() => { location.reload(); }, 700);
      }
    } catch (e) {
      toast('Import failed: ' + (e && e.message ? e.message : 'error'), 'danger');
    }
    fileInput.remove();
  });

  fileInput.click();
}
