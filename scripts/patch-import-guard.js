// Surgical patch: insert an "at least one known key" guard into handleImport().

const fs = require('node:fs');
const path = require('node:path');

const p = path.join(process.env.USERPROFILE, 'time-organizer', 'server.js');
let text = fs.readFileSync(p, 'utf8');

const anchor = "    sendJson(res, 400, { ok: false, error: 'invalid_import', message: 'Body must be a JSON object' });\n    return;\n  }";

const occurrences = text.split(anchor).length - 1;
if (occurrences === 0) {
  console.error('FATAL: anchor not found in server.js');
  process.exit(1);
}
if (occurrences > 1) {
  console.error('FATAL: anchor found ' + occurrences + ' times — refusing to patch');
  process.exit(1);
}
if (text.indexOf('empty_import') !== -1) {
  console.log('ALREADY PATCHED: empty_import guard already present, nothing to do.');
  process.exit(0);
}

const guard = [
  anchor,
  '  {',
  "    const KNOWN_KEYS = ['settings', 'categories', 'blocks', 'tasks', 'habits', 'templates'];",
  '    let hasAny = false;',
  '    for (let i = 0; i < KNOWN_KEYS.length; i++) {',
  '      if (Object.prototype.hasOwnProperty.call(body, KNOWN_KEYS[i])) { hasAny = true; break; }',
  '    }',
  '    if (!hasAny) {',
  "      sendJson(res, 400, { ok: false, error: 'empty_import', message: 'Body contains none of: ' + KNOWN_KEYS.join(', ') });",
  '      return;',
  '    }',
  '  }'
].join('\n');

text = text.split(anchor).join(guard);
fs.writeFileSync(p, text, 'utf8');
console.log('OK: empty_import guard inserted into handleImport()');
