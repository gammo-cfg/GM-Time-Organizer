'use strict';

/**
 * Generic file-backed JSON store.
 *
 * Guarantees:
 *  - Atomic writes (write .tmp, then rename)
 *  - Rotating backups (last N per entity) written before each save
 *  - Serialized writes per entity (write queue)
 *  - Strict entity-name validation (no path traversal possible)
 *  - mtime-based read cache (invalidated if file changed on disk)
 */

const fsp = require('node:fs/promises');
const path = require('node:path');

const MAX_BACKUPS = 30;
const ENTITY_RE = /^[a-z][a-z0-9_-]{0,63}$/i;

class Store {
  constructor(dataDir, backupDir) {
    this.dataDir = dataDir;
    this.backupDir = backupDir;
    this.writeQueues = new Map();
    this.cache = new Map();
  }

  async init(defaults) {
    await fsp.mkdir(this.dataDir, { recursive: true });
    await fsp.mkdir(this.backupDir, { recursive: true });
    const entities = defaults || {};
    for (const name of Object.keys(entities)) {
      if (!ENTITY_RE.test(name)) {
        throw new Error('Invalid entity name in defaults: ' + name);
      }
      const file = this._file(name);
      let exists = true;
      try {
        await fsp.access(file);
      } catch {
        exists = false;
      }
      if (!exists) {
        await this._writeImpl(name, entities[name]);
      }
    }
  }

  async read(entity, fallback) {
    const file = this._file(entity);
    const cached = this.cache.get(entity);
    if (cached) {
      try {
        const stat = await fsp.stat(file);
        if (Math.abs(stat.mtimeMs - cached.mtime) < 1) {
          return cached.data;
        }
      } catch {
        // fall through to disk read
      }
    }
    try {
      const text = await fsp.readFile(file, 'utf8');
      const data = JSON.parse(text);
      const stat = await fsp.stat(file);
      this.cache.set(entity, { data, mtime: stat.mtimeMs });
      return data;
    } catch (err) {
      if (err.code === 'ENOENT') {
        const value = fallback !== undefined ? fallback : null;
        if (value !== null) {
          await this.write(entity, value);
        }
        return value;
      }
      throw err;
    }
  }

  async write(entity, data) {
    const previous = this.writeQueues.get(entity) || Promise.resolve();
    const next = previous.catch(function () {}).then(() => this._writeImpl(entity, data));
    this.writeQueues.set(entity, next.catch(function () {}));
    return next;
  }

  async _writeImpl(entity, data) {
    const file = this._file(entity);
    const tmp = file + '.tmp';
    const text = JSON.stringify(data, null, 2) + '\n';

    let exists = true;
    try {
      await fsp.access(file);
    } catch {
      exists = false;
    }
    if (exists) {
      await this._backup(entity);
    }

    await fsp.writeFile(tmp, text, 'utf8');
    await fsp.rename(tmp, file);

    const stat = await fsp.stat(file);
    this.cache.set(entity, { data, mtime: stat.mtimeMs });
  }

  async _backup(entity) {
    const file = this._file(entity);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, entity + '.' + stamp + '.json');
    try {
      await fsp.copyFile(file, backupPath);
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    const all = (await fsp.readdir(this.backupDir))
      .filter((f) => f.startsWith(entity + '.'))
      .sort()
      .reverse();
    const stale = all.slice(MAX_BACKUPS);
    for (const old of stale) {
      await fsp.unlink(path.join(this.backupDir, old)).catch(function () {});
    }
  }

  async listBackups(entity) {
    this._file(entity);
    const all = (await fsp.readdir(this.backupDir))
      .filter((f) => f.startsWith(entity + '.'))
      .sort()
      .reverse();
    return all;
  }

  _file(entity) {
    if (!ENTITY_RE.test(entity)) {
      throw new Error('Invalid entity name: ' + entity);
    }
    return path.join(this.dataDir, entity + '.json');
  }
}

module.exports = { Store, MAX_BACKUPS, ENTITY_RE };
