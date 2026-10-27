// =====================================================================
// Settings view — real settings + Data (export/import).
// =====================================================================

import { api } from '../api.js';
import { getSettings, setSettings } from '../app.js';
import { exportAll, importAll } from '../export-import.js';

export async function settingsView({ outlet, setTopbar }) {
  setTopbar('Settings', null);

  const current = getSettings();

  outlet.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view-stack';
  wrap.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Calendar</span></div>
      <div class="card-body">
        <div class="form">
          <div class="form-row cols-2">
            <div class="field">
              <label class="field-label" for="week-start">Week starts on</label>
              <select class="input" id="week-start">
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="field">
              <label class="field-label" for="day-start">Day starts at</label>
              <select class="input" id="day-start"></select>
            </div>
            <div class="field">
              <label class="field-label" for="day-end">Day ends at</label>
              <select class="input" id="day-end"></select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label class="switch">
                <input type="checkbox" id="show-now" />
                <span class="switch-track"></span>
                Show current-time line on the timeline
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <span class="field-hint" id="save-status" style="margin-right: auto;"></span>
        <button class="btn primary" id="save-btn" type="button">Save</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Data</span></div>
      <div class="card-body">
        <p style="font-size: var(--fs-13); color: var(--text-muted); margin: 0 0 var(--sp-4);">
          Export all of your Time Organizer data as a single JSON file. Import it later to restore
          everything — useful before big changes, or when moving to a new PC.
        </p>
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;">
          <button class="btn secondary" id="export-btn" type="button">Export data\u2026</button>
          <button class="btn secondary" id="import-btn" type="button">Import data\u2026</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">About</span></div>
      <div class="card-body">
        <p style="font-size: var(--fs-13); color: var(--text-muted); margin: 0;">
          Time Organizer runs entirely on your PC. All data is stored as JSON files in the
          <code>data/</code> folder next to <code>server.js</code>. Nothing is sent anywhere.
        </p>
      </div>
    </div>
  `;
  outlet.appendChild(wrap);

  const weekStartEl = wrap.querySelector('#week-start');
  const dayStartEl = wrap.querySelector('#day-start');
  const dayEndEl = wrap.querySelector('#day-end');
  const showNowEl = wrap.querySelector('#show-now');
  const saveBtn = wrap.querySelector('#save-btn');
  const statusEl = wrap.querySelector('#save-status');
  const exportBtn = wrap.querySelector('#export-btn');
  const importBtn = wrap.querySelector('#import-btn');

  for (let h = 0; h < 24; h++) {
    const label = String(h).padStart(2, '0') + ':00';
    const o1 = document.createElement('option');
    o1.value = String(h); o1.textContent = label;
    dayStartEl.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = String(h); o2.textContent = label;
    dayEndEl.appendChild(o2);
  }

  weekStartEl.value = String(current.weekStart);
  dayStartEl.value = String(current.dayStartHour);
  dayEndEl.value = String(current.dayEndHour);
  showNowEl.checked = !!current.showNowLine;

  saveBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Saving...';
    saveBtn.disabled = true;
    try {
      const res = await api.patchSettings({
        weekStart: Number(weekStartEl.value),
        dayStartHour: Number(dayStartEl.value),
        dayEndHour: Number(dayEndEl.value),
        showNowLine: !!showNowEl.checked
      });
      setSettings(res.data);
      statusEl.textContent = 'Saved.';
      setTimeout(() => { statusEl.textContent = ''; }, 1800);
    } catch (err) {
      statusEl.textContent = (err && err.message) ? err.message : 'Save failed.';
    } finally {
      saveBtn.disabled = false;
    }
  });

  exportBtn.addEventListener('click', () => { exportAll(); });
  importBtn.addEventListener('click', () => { importAll(); });
}
