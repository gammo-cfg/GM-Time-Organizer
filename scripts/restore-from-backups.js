// One-shot restore: copy the newest backup of each entity back into data/.
// Safe, minimal, no writes to backups.

const fsp = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(process.env.USERPROFILE, 'time-organizer', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ENTITIES = ['settings', 'categories', 'blocks', 'tasks', 'habits', 'templates'];

(async function () {
  console.log('Restoring newest backup for each entity...');
  console.log('Source: ' + BACKUP_DIR);
  console.log('Target: ' + DATA_DIR);
  console.log('');
  let restored = 0;
  let skipped = 0;
  const entries = await fsp.readdir(BACKUP_DIR);
  for (const entity of ENTITIES) {
    const backups = entries
      .filter(function (f) { return f.startsWith(entity + '.') && f.endsWith('.json'); })
      .sort()
      .reverse();
    if (backups.length === 0) {
      console.log('  SKIP  ' + entity + '  (no backups found)');
      skipped++;
      continue;
    }
    const chosen = backups[0];
    const src = path.join(BACKUP_DIR, chosen);
    const dst = path.join(DATA_DIR, entity + '.json');
    await fsp.copyFile(src, dst);
    console.log('  OK    ' + entity + '  <- ' + chosen);
    restored++;
  }
  console.log('');
  console.log('Restored: ' + restored);
  console.log('Skipped: ' + skipped);
})().catch(function (e) {
  console.error('RESTORE FAILED', e && e.stack ? e.stack : String(e));
  process.exit(1);
});
