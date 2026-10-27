// =====================================================================
// UI helpers — v3.1.
// - Modal action buttons now show a loading spinner when their onClick
//   returns a Promise, and only close on resolve (not on false).
// - setLoading() is exported so views can reuse the loading state.
// - Icons remain the drawn SVG set from icons.js.
// =====================================================================

import { icon } from './icons.js';

let toastStack = null;

function getToastStack() {
  if (!toastStack || !document.body.contains(toastStack)) {
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    document.body.appendChild(toastStack);
  }
  return toastStack;
}

export function toast(message, type) {
  const stack = getToastStack();
  const node = document.createElement('div');
  node.className = 'toast' + (type ? ' ' + type : '');
  node.textContent = message;
  stack.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 240);
  }, 2400);
}

// Toggle a button's loading state. Exported for reuse outside modals.
export function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
  } else {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

export function openModal(opts) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'modal-title';
    titleEl.textContent = opts.title || '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn ghost icon';
    closeBtn.type = 'button';
    closeBtn.innerHTML = icon('close');
    closeBtn.setAttribute('aria-label', 'Close');
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    if (typeof opts.body === 'string') {
      bodyEl.textContent = opts.body;
    } else if (opts.body instanceof Node) {
      bodyEl.appendChild(opts.body);
    }
    modal.appendChild(bodyEl);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const actions = opts.actions || [];
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (act.variant || 'secondary');
      btn.type = 'button';
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        if (typeof act.onClick === 'function') {
          let res;
          try { res = act.onClick(bodyEl, modal); }
          catch (e) { console.error(e); return; }
          if (res === false) return;
          if (res && typeof res.then === 'function') {
            setLoading(btn, true);
            res.then((r) => {
              setLoading(btn, false);
              if (r === false) return;
              close(r === undefined ? act.value : r);
            }).catch((e) => {
              setLoading(btn, false);
              console.error(e);
            });
            return;
          }
        }
        close(act.value);
      });
      footer.appendChild(btn);
    }
    modal.appendChild(footer);

    backdrop.appendChild(modal);

    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(undefined);
    }

    closeBtn.addEventListener('click', () => close(undefined));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(undefined);
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    const firstInput = bodyEl.querySelector('input, select, textarea, button');
    if (firstInput) setTimeout(() => firstInput.focus(), 40);
  });
}

export function confirm(title, message) {
  return openModal({
    title: title,
    body: message,
    actions: [
      { label: 'Cancel', variant: 'secondary', value: false },
      { label: 'Confirm', variant: 'danger', value: true }
    ]
  }).then((v) => !!v);
}

export const COLOR_OPTIONS = [
  { name: 'Slate', hex: '#5B6B8C' },
  { name: 'Sage',  hex: '#6E8B6B' },
  { name: 'Clay',  hex: '#A67C5E' },
  { name: 'Rose',  hex: '#A6727E' },
  { name: 'Gold',  hex: '#A08A50' },
  { name: 'Plum',  hex: '#7E6B8C' },
  { name: 'Teal',  hex: '#5E8B8A' },
  { name: 'Olive', hex: '#8B8A5E' }
];

export function buildColorPicker(selectedHex) {
  const wrap = document.createElement('div');
  wrap.className = 'color-picker';
  const radios = [];

  for (const opt of COLOR_OPTIONS) {
    const label = document.createElement('label');
    label.className = 'color-swatch';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'cat-color-' + Math.random().toString(36).slice(2, 8);
    input.value = opt.hex;
    input.checked = (opt.hex === selectedHex);

    const dot = document.createElement('span');
    dot.className = 'color-swatch-dot';
    dot.style.background = opt.hex;

    const labelText = document.createElement('span');
    labelText.className = 'color-swatch-label';
    labelText.textContent = opt.name;

    label.appendChild(input);
    label.appendChild(dot);
    label.appendChild(labelText);
    wrap.appendChild(label);
    radios.push(input);
  }

  wrap.getValue = function () {
    for (const r of radios) if (r.checked) return r.value;
    return COLOR_OPTIONS[0].hex;
  };
  return wrap;
}
