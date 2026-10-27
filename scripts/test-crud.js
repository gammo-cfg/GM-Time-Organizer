'use strict';

/**
 * End-to-end CRUD self-test.
 * Run while the server is up:  node scripts/test-crud.js
 * Prints one PASS/FAIL line per assertion and a final RESULT line.
 * Exits with code 1 if anything failed.
 */

const BASE = 'http://127.0.0.1:4777';

let passed = 0;
let failed = 0;
const failures = [];

function pass(name) {
  passed++;
  console.log('PASS  ' + name);
}
function fail(name, details) {
  failed++;
  failures.push({ name: name, details: details });
  console.log('FAIL  ' + name + '  ' + (details ? JSON.stringify(details) : ''));
}

async function req(method, path, body, headers) {
  const opts = { method: method, headers: Object.assign({}, headers || {}) };
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
  }
  const r = await fetch(BASE + path, opts);
  let json = null;
  try { json = await r.json(); } catch (e) { json = null; }
  return { status: r.status, json: json };
}

(async function run() {
  let r;

  r = await req('POST', '/api/categories', { name: 'Work', color: '#5B6B8C' });
  if (r.status !== 201 || !r.json || !r.json.data || !r.json.data.id) return fail('create category', r);
  pass('create category');
  const catId = r.json.data.id;

  r = await req('GET', '/api/categories');
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.data) || r.json.data.length !== 1) return fail('list categories', r);
  pass('list categories');

  r = await req('GET', '/api/categories/' + catId);
  if (r.status !== 200 || !r.json || !r.json.data || r.json.data.name !== 'Work') return fail('get one', r);
  pass('get one');

  r = await req('PUT', '/api/categories/' + catId, { name: 'Work (updated)', color: '#6E8B6B' });
  if (r.status !== 200 || !r.json || !r.json.data || r.json.data.name !== 'Work (updated)') return fail('update', r);
  pass('update');

  r = await req('POST', '/api/categories', { name: '', color: 'notacolor' });
  if (r.status !== 400 || !r.json || r.json.error !== 'validation_error') return fail('reject invalid payload', r);
  pass('reject invalid payload');

  r = await req('POST', '/api/categories', { name: 'X', color: '#000000' }, { Origin: 'http://evil.example' });
  if (r.status !== 403) return fail('forbidden origin', r);
  pass('forbidden origin');

  r = await req('POST', '/api/categories', 'name=X&color=%23000000', { 'Content-Type': 'application/x-www-form-urlencoded' });
  if (r.status !== 415) return fail('json required', r);
  pass('json required');

  r = await req('DELETE', '/api/categories/' + catId);
  if (r.status !== 200) return fail('delete', r);
  pass('delete');

  r = await req('GET', '/api/categories');
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.data) || r.json.data.length !== 0) return fail('confirm empty', r);
  pass('confirm empty');

  r = await req('DELETE', '/api/categories/nonexistent');
  if (r.status !== 404) return fail('delete missing -> 404', r);
  pass('delete missing -> 404');

  r = await req('PATCH', '/api/settings', { theme: 'light' });
  if (r.status !== 200 || !r.json || !r.json.data || r.json.data.theme !== 'light') return fail('settings patch', r);
  pass('settings patch');

  r = await req('PATCH', '/api/settings', { theme: 'neon' });
  if (r.status !== 400) return fail('settings reject invalid', r);
  pass('settings reject invalid');

  r = await req('POST', '/api/blocks', {
    title: 'Bad block',
    start: '10:00',
    end: '09:00',
    recurrence: { type: 'daily' }
  });
  if (r.status !== 400) return fail('blocks reject bad time', r);
  pass('blocks reject bad time');

  r = await req('POST', '/api/blocks', {
    title: 'Focus',
    start: '08:00',
    end: '09:30',
    recurrence: { type: 'weekly', weekdays: [1, 3], interval: 1, startDate: '2026-10-01', endDate: '2026-12-31' }
  });
  if (r.status !== 201 || !r.json || !r.json.data || !r.json.data.id) return fail('blocks create', r);
  pass('blocks create');
  const blockId = r.json.data.id;

  await req('DELETE', '/api/blocks/' + blockId);

  await req('PATCH', '/api/settings', { theme: 'dark' });

  console.log('');
  console.log('Passed: ' + passed);
  console.log('Failed: ' + failed);
  if (failed > 0) {
    console.log('RESULT: FAILED');
    for (let i = 0; i < failures.length; i++) {
      console.log('  - ' + failures[i].name + ' :: ' + JSON.stringify(failures[i].details));
    }
    process.exit(1);
  } else {
    console.log('RESULT: ALL PASS');
    process.exit(0);
  }
})().catch(function (e) {
  console.error('RUNNER ERROR', e && e.stack ? e.stack : String(e));
  process.exit(1);
});
