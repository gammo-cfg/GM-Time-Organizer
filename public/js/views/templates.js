// =====================================================================
// Templates list view — preview + Apply / Rename / Delete per row.
// =====================================================================

import { api } from '../api.js';
import { toast } from '../ui.js';
import { openFromDayDialog, openRenameTemplate, confirmDeleteTemplate } from '../template-editor.js';
import { openApplyTemplate } from '../apply-template.js';

export async function templatesView({ outlet, setTopbar }) {
  let templates = [];
  let categories = [];

  setTopbar('Templates', (actions) => {
    const newBtn = document.createElement('button');
    newBtn.className = 'btn primary';
    newBtn.type = 'button';
    newBtn.textContent = '+ From day\u2026';
    newBtn.addEventListener('click', async () => {
      await openFromDayDialog();
      await load();
      render();
    });
    actions.appendChild(newBtn);
  });

  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  async function load() {
    const [t, c] = await Promise.all([api.list('templates'), api.list('categories')]);
    templates = (t && t.data) || [];
    categories = (c && c.data) || [];
  }

  function render() {
    stack.innerHTML = '';

    if (templates.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const t = document.createElement('div');
      t.className = 'empty-title';
      t.textContent = 'No templates yet';
      const b = document.createElement('div');
      b.className = 'empty-body';
      b.textContent = 'A template is a snapshot of a day\u2019s plan. Save one from a day you liked, then replay it onto any date.';
      empty.appendChild(t);
      empty.appendChild(b);
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Save a day as template';
      btn.style.marginTop = 'var(--sp-4)';
      btn.addEventListener('click', async () => {
        await openFromDayDialog();
        await load();
        render();
      });
      empty.appendChild(btn);
      stack.appendChild(empty);
      return;
    }

    const catMap = new Map();
    for (let i = 0; i < categories.length; i++) catMap.set(categories[i].id, categories[i]);

    const list = document.createElement('div');
    list.className = 'template-list';

    for (let i = 0; i < templates.length; i++) {
      (function (tpl) {
        const card = document.createElement('div');
        card.className = 'template-card';

        const head = document.createElement('div');
        head.className = 'template-head';

        const titleWrap = document.createElement('div');
        const titleEl = document.createElement('div');
        titleEl.className = 'template-title';
        titleEl.textContent = tpl.name;
        const subEl = document.createElement('div');
        subEl.className = 'template-sub';
        const blockCount = (tpl.blocks || []).length;
        subEl.textContent = blockCount + ' block' + (blockCount === 1 ? '' : 's');
        titleWrap.appendChild(titleEl);
        titleWrap.appendChild(subEl);
        head.appendChild(titleWrap);

        const actions = document.createElement('div');
        actions.className = 'template-actions';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn primary sm';
        applyBtn.type = 'button';
        applyBtn.textContent = 'Apply\u2026';
        applyBtn.addEventListener('click', async () => {
          await openApplyTemplate({ preselectTemplateId: tpl.id });
        });
        actions.appendChild(applyBtn);

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn secondary sm';
        renameBtn.type = 'button';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', async () => {
          const res = await openRenameTemplate(tpl);
          if (res) { await load(); render(); }
        });
        actions.appendChild(renameBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn ghost sm';
        delBtn.type = 'button';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async () => {
          const ok = await confirmDeleteTemplate(tpl);
          if (ok) { await load(); render(); }
        });
        actions.appendChild(delBtn);

        head.appendChild(actions);
        card.appendChild(head);

        const blocksWrap = document.createElement('div');
        blocksWrap.className = 'template-blocks';
        const sorted = (tpl.blocks || []).slice().sort(function (a, b) { return a.start.localeCompare(b.start); });
        if (sorted.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.className = 'template-empty-block';
          emptyMsg.textContent = 'This template has no blocks.';
          blocksWrap.appendChild(emptyMsg);
        } else {
          for (let k = 0; k < sorted.length; k++) {
            const tb = sorted[k];
            const cat = tb.categoryId ? catMap.get(tb.categoryId) : null;
            const row = document.createElement('div');
            row.className = 'template-block-row';

            const timeEl = document.createElement('span');
            timeEl.className = 'tbr-time';
            timeEl.textContent = tb.start + ' \u2013 ' + tb.end;

            const dot = document.createElement('span');
            dot.className = 'tbr-dot';
            if (cat) dot.style.setProperty('--c', cat.color);

            const titleEl2 = document.createElement('span');
            titleEl2.className = 'tbr-title';
            titleEl2.textContent = tb.title;

            row.appendChild(timeEl);
            row.appendChild(dot);
            row.appendChild(titleEl2);
            blocksWrap.appendChild(row);
          }
        }
        card.appendChild(blocksWrap);

        list.appendChild(card);
      })(templates[i]);
    }

    stack.appendChild(list);
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
    t.textContent = 'Could not load templates';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
