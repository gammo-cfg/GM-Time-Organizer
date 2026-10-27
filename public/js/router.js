// =====================================================================
// Hash-based router with async-aware view mounting and error boundary.
// =====================================================================

export function createRouter(options) {
  const outlet = options.outlet;
  const setTopbar = options.setTopbar;
  const routes = options.routes || {};
  const fallback = options.fallback || '/today';
  const onRouteChange = options.onRouteChange;

  function parseHash() {
    return (location.hash.replace(/^#/, '') || fallback).split('?')[0];
  }

  function render() {
    const path = parseHash();
    const view = routes[path];
    if (!view) {
      if (path !== fallback) { location.hash = '#' + fallback; return; }
      showError(outlet, new Error('Not found'));
      return;
    }
    outlet.innerHTML = '';
    if (onRouteChange) onRouteChange(path);
    try {
      const result = view({ outlet, setTopbar });
      if (result && typeof result.then === 'function') {
        result.catch((err) => showError(outlet, err));
      }
    } catch (err) {
      showError(outlet, err);
    }
  }

  function showError(out, err) {
    console.error(err);
    const wrap = document.createElement('div');
    wrap.className = 'empty';
    const t = document.createElement('div');
    t.className = 'empty-title';
    t.textContent = 'Something went wrong';
    const b = document.createElement('div');
    b.className = 'empty-body';
    b.textContent = err && err.message ? err.message : 'Unknown error';
    wrap.appendChild(t);
    wrap.appendChild(b);
    out.innerHTML = '';
    out.appendChild(wrap);
  }

  window.addEventListener('hashchange', render);

  return {
    start() {
      if (!location.hash) location.hash = '#' + fallback;
      else render();
    },
    go(path) {
      location.hash = '#' + path;
    },
    current() {
      return parseHash();
    }
  };
}
