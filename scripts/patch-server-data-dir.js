// One-shot patch: make server.js honour a TIME_ORGANIZER_DATA env var.
const fs = require('node:fs');
const path = require('node:path');

const p = path.join(process.env.USERPROFILE, 'time-organizer', 'server.js');
let text = fs.readFileSync(p, 'utf8');

const OLD = "const DATA_DIR = path.join(ROOT, 'data');";
const NEW = "const DATA_DIR = process.env.TIME_ORGANIZER_DATA || path.join(ROOT, 'data');";

if (text.indexOf(NEW) !== -1) {
  console.log('ALREADY PATCHED: DATA_DIR already honours TIME_ORGANIZER_DATA');
  process.exit(0);
}
if (text.indexOf(OLD) === -1) {
  console.error('FATAL: anchor not found in server.js');
  process.exit(1);
}
text = text.replace(OLD, NEW);
fs.writeFileSync(p, text, 'utf8');
console.log('OK: server.js DATA_DIR now honours TIME_ORGANIZER_DATA');
