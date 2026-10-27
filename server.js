'use strict';

/**
 * Time Organizer — zero-dependency local HTTP server.
 * Binds to 127.0.0.1 only.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const pkg = require('./package.json');
const { Store } = require('./lib/store');
const { ValidationError, validators } = require('./lib/validate');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4777;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.TIME_ORGANIZER_DATA || path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const store = new Store(DATA_DIR, BACKUP_DIR);

const ENTITY_DEFAULTS = {
  settings: {
    theme: 'dark',
    accent: 'rust',
    weekStart: 1,
    dayStartHour: 8,
    dayEndHour: 22,
    showNowLine: true
  },
  categories: [],
  blocks: [],
  tasks: [],
  habits: [],
  templates: []
};

const ARRAY_ENTITIES = new Set(['categories', 'blocks', 'tasks', 'habits', 'templates']);
const ID_OK = /^[a-zA-Z0-9_-]{1,64}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function log() {
  const args = Array.prototype.slice.call(arguments);
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log.apply(console, ['[' + t + ']'].concat(args));
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  }, headers || {}));
  res.end(body);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function safeJoin(baseDir, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0].split('#')[0]);
  } catch (e) {
    return null;
  }
  const normalized = path.normalize(decoded).replace(/^[\\/]+/, '');
  const full = path.join(baseDir, normalized);
  const rel = path.relative(baseDir, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

function streamFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(filePath).pipe(res);
}

async function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = safeJoin(PUBLIC_DIR, urlPath);
  if (!filePath) { send(res, 400, 'Bad request'); return; }
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      const indexStat = await fsp.stat(indexPath);
      if (!indexStat.isFile()) throw new Error('not a file');
      streamFile(req, res, indexPath, indexStat);
      return;
    }
    if (!stat.isFile()) throw new Error('not a file');
    streamFile(req, res, filePath, stat);
  } catch (e) {
    send(res, 404, 'Not found');
  }
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        const err = new Error('Body too large');
        err.status = 413;
        err.code = 'body_too_large';
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) { resolve({}); return; }
      try { resolve(JSON.parse(text)); }
      catch (e) {
        const err = new Error('Invalid JSON');
        err.status = 400;
        err.code = 'invalid_json';
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch (e) {
    return false;
  }
}

function requireJson(req) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  return ct.indexOf('application/json') !== -1;
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

async function handleSettings(req, res) {
  if (req.method === 'GET') {
    const data = await store.read('settings', ENTITY_DEFAULTS.settings);
    sendJson(res, 200, { ok: true, data: data });
    return;
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'forbidden_origin' }); return; }
    if (!requireJson(req)) { sendJson(res, 415, { ok: false, error: 'json_required' }); return; }
    const body = await readJsonBody(req);
    const current = await store.read('settings', ENTITY_DEFAULTS.settings);
    const merged = Object.assign({}, current, body);
    const clean = validators.settings(merged);
    await store.write('settings', clean);
    sendJson(res, 200, { ok: true, data: clean });
    return;
  }
  sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function handleArrayEntity(req, res, entity, id) {
  if (req.method === 'GET' && !id) {
    const data = await store.read(entity, []);
    sendJson(res, 200, { ok: true, entity: entity, data: data });
    return;
  }
  if (req.method === 'GET' && id) {
    const data = await store.read(entity, []);
    const found = data.find(function (x) { return x.id === id; });
    if (!found) { sendJson(res, 404, { ok: false, error: 'not_found' }); return; }
    sendJson(res, 200, { ok: true, data: found });
    return;
  }
  if (req.method === 'POST' && !id) {
    if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'forbidden_origin' }); return; }
    if (!requireJson(req)) { sendJson(res, 415, { ok: false, error: 'json_required' }); return; }
    const body = await readJsonBody(req);
    const clean = validators[entity](body);
    const data = await store.read(entity, []);
    const stamp = nowIso();
    const item = Object.assign({ id: newId(), createdAt: stamp, updatedAt: stamp }, clean);
    data.push(item);
    await store.write(entity, data);
    sendJson(res, 201, { ok: true, data: item });
    return;
  }
  if ((req.method === 'PUT' || req.method === 'PATCH') && id) {
    if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'forbidden_origin' }); return; }
    if (!requireJson(req)) { sendJson(res, 415, { ok: false, error: 'json_required' }); return; }
    const body = await readJsonBody(req);
    const data = await store.read(entity, []);
    const idx = data.findIndex(function (x) { return x.id === id; });
    if (idx === -1) { sendJson(res, 404, { ok: false, error: 'not_found' }); return; }
    const merged = Object.assign({}, data[idx], body);
    const clean = validators[entity](merged);
    const item = Object.assign({}, clean, {
      id: data[idx].id,
      createdAt: data[idx].createdAt,
      updatedAt: nowIso()
    });
    data[idx] = item;
    await store.write(entity, data);
    sendJson(res, 200, { ok: true, data: item });
    return;
  }
  if (req.method === 'DELETE' && id) {
    if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'forbidden_origin' }); return; }
    const data = await store.read(entity, []);
    const idx = data.findIndex(function (x) { return x.id === id; });
    if (idx === -1) { sendJson(res, 404, { ok: false, error: 'not_found' }); return; }
    const removed = data.splice(idx, 1)[0];
    await store.write(entity, data);
    sendJson(res, 200, { ok: true, data: removed });
    return;
  }
  sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function handleExport(req, res) {
  const out = {
    meta: {
      exportedAt: nowIso(),
      version: pkg.version,
      kind: 'time-organizer-backup'
    }
  };
  const keys = Object.keys(ENTITY_DEFAULTS);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    out[k] = await store.read(k, ENTITY_DEFAULTS[k]);
  }
  sendJson(res, 200, out);
}

async function handleImport(req, res) {
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'forbidden_origin' }); return; }
  if (!requireJson(req)) { sendJson(res, 415, { ok: false, error: 'json_required' }); return; }
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { ok: false, error: 'invalid_import', message: 'Body must be a JSON object' });
    return;
  }
  {
    const KNOWN_KEYS = ['settings', 'categories', 'blocks', 'tasks', 'habits', 'templates'];
    let hasAny = false;
    for (let i = 0; i < KNOWN_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(body, KNOWN_KEYS[i])) { hasAny = true; break; }
    }
    if (!hasAny) {
      sendJson(res, 400, { ok: false, error: 'empty_import', message: 'Body contains none of: ' + KNOWN_KEYS.join(', ') });
      return;
    }
  }

  // Validate everything first — fail cleanly before touching disk
  const writes = {};
  try {
    if (body.settings && typeof body.settings === 'object') {
      writes.settings = validators.settings(body.settings);
    } else {
      writes.settings = ENTITY_DEFAULTS.settings;
    }
    for (const entity of ARRAY_ENTITIES) {
      const source = Array.isArray(body[entity]) ? body[entity] : [];
      const cleaned = [];
      for (let i = 0; i < source.length; i++) {
        const item = source[i];
        const c = validators[entity](item);
        if (item && typeof item.id === 'string' && ID_OK.test(item.id)) c.id = item.id;
        else c.id = newId();
        c.createdAt = (item && typeof item.createdAt === 'string') ? item.createdAt : nowIso();
        c.updatedAt = (item && typeof item.updatedAt === 'string') ? item.updatedAt : nowIso();
        cleaned.push(c);
      }
      writes[entity] = cleaned;
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      sendJson(res, 400, { ok: false, error: 'invalid_import', message: e.message, field: e.field });
    } else {
      sendJson(res, 400, { ok: false, error: 'invalid_import', message: e && e.message ? e.message : 'Unknown error' });
    }
    return;
  }

  const written = [];
  for (const k of Object.keys(writes)) {
    await store.write(k, writes[k]);
    written.push(k);
  }
  log('IMPORT: wrote', written.join(', '));
  sendJson(res, 200, { ok: true, imported: written });
}

async function handleApi(req, res) {
  const url = req.url.split('?')[0];

  if (url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      name: pkg.name,
      version: pkg.version,
      time: nowIso(),
      uptime: Math.round(process.uptime()),
      entities: Object.keys(ENTITY_DEFAULTS)
    });
    return;
  }

  if (url === '/api/export' && req.method === 'GET') {
    await handleExport(req, res);
    return;
  }

  if (url === '/api/import' && req.method === 'POST') {
    await handleImport(req, res);
    return;
  }

  if (url.startsWith('/api/store/') && req.method === 'GET') {
    const entity = url.slice('/api/store/'.length);
    if (!Object.prototype.hasOwnProperty.call(ENTITY_DEFAULTS, entity)) {
      sendJson(res, 404, { ok: false, error: 'unknown_entity', entity: entity });
      return;
    }
    const data = await store.read(entity, ENTITY_DEFAULTS[entity]);
    sendJson(res, 200, { ok: true, entity: entity, data: data });
    return;
  }

  if (url.startsWith('/api/backups/') && req.method === 'GET') {
    const entity = url.slice('/api/backups/'.length);
    if (!Object.prototype.hasOwnProperty.call(ENTITY_DEFAULTS, entity)) {
      sendJson(res, 404, { ok: false, error: 'unknown_entity', entity: entity });
      return;
    }
    const files = await store.listBackups(entity);
    sendJson(res, 200, { ok: true, entity: entity, files: files });
    return;
  }

  if (url === '/api/settings') {
    await handleSettings(req, res);
    return;
  }

  const m = url.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
  if (m && ARRAY_ENTITIES.has(m[1])) {
    await handleArrayEntity(req, res, m[1], m[2]);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'not_found', message: 'Unknown API route' });
}

async function requestListener(req, res) {
  setCommonHeaders(res);
  const started = Date.now();
  res.on('finish', function () {
    log(req.method, req.url, '->', res.statusCode, '(' + (Date.now() - started) + 'ms)');
  });

  try {
    if (req.url.startsWith('/api/')) {
      await handleApi(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method not allowed');
      return;
    }
    await serveStatic(req, res);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendJson(res, 400, { ok: false, error: 'validation_error', message: err.message, field: err.field });
      return;
    }
    if (err && err.status && err.code) {
      sendJson(res, err.status, { ok: false, error: err.code, message: err.message });
      return;
    }
    log('ERROR', err && err.stack ? err.stack : String(err));
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'server_error' });
    else res.end();
  }
}

function openBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    log('Could not open browser automatically. Open ' + url + ' manually.');
  }
}

(async function main() {
  await store.init(ENTITY_DEFAULTS);
  log('Store ready:', Object.keys(ENTITY_DEFAULTS).length, 'entities in', DATA_DIR);

  const server = http.createServer(requestListener);

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
      console.error('');
      console.error('  Port ' + PORT + ' is already in use.');
      console.error('  Close the other Time Organizer window, then try again.');
      console.error('');
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(PORT, HOST, function () {
    const url = 'http://' + HOST + ':' + PORT;
    console.log('');
    console.log('  Time Organizer');
    console.log('  ------------------------------');
    console.log('  Running at  ' + url);
    console.log('  Data in     ' + DATA_DIR);
    console.log('  Press Ctrl+C to stop.');
    console.log('');
    openBrowser(url);
  });

  function shutdown() {
    log('Shutting down...');
    server.close(function () { process.exit(0); });
    setTimeout(function () { process.exit(0); }, 2000).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
