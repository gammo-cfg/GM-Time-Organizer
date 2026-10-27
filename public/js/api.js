// =====================================================================
// API client — thin wrapper around fetch for the local server.
// Every method throws an Error on non-2xx (with .status and .data).
// =====================================================================

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const err = new Error((data && data.message) || ('HTTP ' + r.status));
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Settings (singleton)
  getSettings: () => req('GET', '/api/settings'),
  patchSettings: (patch) => req('PATCH', '/api/settings', patch),

  // Generic array entities
  list:   (entity)        => req('GET',    '/api/' + entity),
  get:    (entity, id)    => req('GET',    '/api/' + entity + '/' + encodeURIComponent(id)),
  create: (entity, body)  => req('POST',   '/api/' + entity, body),
  update: (entity, id, body) => req('PUT', '/api/' + entity + '/' + encodeURIComponent(id), body),
  remove: (entity, id)    => req('DELETE', '/api/' + entity + '/' + encodeURIComponent(id))
};
