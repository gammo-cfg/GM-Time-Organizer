// =====================================================================
// Categories view — CRUD for categories with 8-color picker.
// Emits 'categories:changed' after any successful write.
// =====================================================================

import { api } from '../api.js';
import { openModal, toast, confirm, buildColorPicker, COLOR_OPTIONS } from '../ui.js';

async function fetchCategories() {
  const res = await api.list('categories');
  return (res && res.data) || [];
}

function notifyChanged() {
  document.dispatchEvent(new CustomEvent('categories:changed'));
}

export async function categoriesView({ outlet, setTopbar }) {
  let categories = [];

  setTopbar('Categories', (actions) => {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.type = 'button';
    addBtn.textContent = '+ Category';
    addBtn.addEventListener('click', () => openEditor(null));
    actions.appendChild(addBtn);
  });

  outlet.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'view-stack';
  outlet.appendChild(stack);

  function render() {
    stack.innerHTML = '';

    if (categories.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const t = document.createElement('div');
      t.className = 'empty-title';
      t.textContent = 'No categories yet';
      const b = document.createElement('div');
      b.className = 'empty-body';
      b.textContent = 'Categories color-code your blocks on the timeline. Add your first one to get started.';
      empty.appendChild(t);
      empty.appendChild(b);
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Create first category';
      btn.style.marginTop = 'var(--sp-4)';
      btn.addEventListener('click', () => openEditor(null));
      empty.appendChild(btn);
      stack.appendChild(empty);
      return;
    }

    const card = document.createElement('div');
    card.className = 'card';
    const header = document.createElement('div');
    header.className = 'card-header';
    const h = document.createElement('span');
    h.className = 'card-title';
    h.textContent = categories.length + ' categor' + (categories.length === 1 ? 'y' : 'ies');
    header.appendChild(h);
    card.appendChild(header);

    const list = document.createElement('div');
    list.style.padding = '0';

    for (const cat of categories) {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:var(--sp-3);align-items:center;padding:var(--sp-4) var(--sp-6);border-bottom:1px solid var(--border-soft);';
      if (cat === categories[categories.length - 1]) {
        row.style.borderBottom = 'none';
      }

      const dot = document.createElement('span');
      dot.style.cssText = 'width:14px;height:14px;border-radius:var(--r-sm);background:' + cat.color + ';';
      row.appendChild(dot);

      const name = document.createElement('div');
      name.style.cssText = 'font-size:var(--fs-13);color:var(--text);font-weight:500;';
      name.textContent = cat.name;
      row.appendChild(name);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:var(--sp-2);';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn ghost sm';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEditor(cat));
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn ghost sm';
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => onDelete(cat));
      actions.appendChild(delBtn);

      row.appendChild(actions);
      list.appendChild(row);
    }

    card.appendChild(list);
    stack.appendChild(card);
  }

  async function refresh() {
    categories = await fetchCategories();
    render();
  }

  async function onDelete(cat) {
    const ok = await confirm('Delete category', 'Delete "' + cat.name + '"? Blocks using this category will lose their color.');
    if (!ok) return;
    try {
      await api.remove('categories', cat.id);
      await refresh();
      notifyChanged();
      toast('Category deleted.', 'success');
    } catch (e) {
      toast('Could not delete: ' + (e.message || 'error'), 'danger');
    }
  }

  function openEditor(existing) {
    const form = document.createElement('div');
    form.className = 'form';

    const nameField = document.createElement('div');
    nameField.className = 'field';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'field-label';
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.className = 'input';
    nameInput.type = 'text';
    nameInput.placeholder = 'Work';
    nameInput.value = existing ? existing.name : '';
    nameInput.maxLength = 60;
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    form.appendChild(nameField);

    const colorField = document.createElement('div');
    colorField.className = 'field';
    const colorLabel = document.createElement('label');
    colorLabel.className = 'field-label';
    colorLabel.textContent = 'Color';
    colorField.appendChild(colorLabel);
    const initialColor = existing ? existing.color : COLOR_OPTIONS[0].hex;
    const picker = buildColorPicker(initialColor);
    colorField.appendChild(picker);
    form.appendChild(colorField);

    async function save() {
      const name = nameInput.value.trim();
      nameInput.classList.remove('error');
      if (!name) {
        nameInput.classList.add('error');
        nameInput.focus();
        return false;
      }
      const color = picker.getValue();
      try {
        if (existing) {
          await api.update('categories', existing.id, { name: name, color: color });
        } else {
          await api.create('categories', { name: name, color: color });
        }
        await refresh();
        notifyChanged();
        toast(existing ? 'Category updated.' : 'Category created.', 'success');
        return undefined;
      } catch (e) {
        toast('Save failed: ' + (e.message || 'error'), 'danger');
        return false;
      }
    }

    openModal({
      title: existing ? 'Edit category' : 'New category',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'secondary', value: undefined },
        { label: 'Save', variant: 'primary', onClick: save }
      ]
    });
  }

  try {
    await refresh();
  } catch (e) {
    stack.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    const t = document.createElement('div');
    t.className = 'empty-title';
    t.textContent = 'Could not load categories';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = (e && e.message) ? e.message : 'Unknown error';
    empty.appendChild(t);
    empty.appendChild(b);
    stack.appendChild(empty);
  }
}
