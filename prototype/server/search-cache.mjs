import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ttl = 86400000;
const fields = ['Url', 'Title', 'ContentText', 'AuthorName', 'AuthorBadgeText', 'EditTime'];

export function createSearchCache(file = join(process.cwd(), '.local', 'search-cache.sqlite')) {
  let db;
  const keyOf = (query) => createHash('sha256').update(query).digest('hex');
  function database(now) {
    if (!db) {
      mkdirSync(dirname(file), { recursive: true });
      db = new DatabaseSync(file);
      chmodSync(file, 0o600);
      db.exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL);');
    }
    db.prepare('DELETE FROM cache WHERE at < ?').run(now - ttl);
    return db;
  }
  return {
    get(query, now = Date.now()) {
      const row = database(now).prepare('SELECT at,payload FROM cache WHERE key=?').get(keyOf(query));
      return row ? { at: row.at, data: JSON.parse(row.payload) } : null;
    },
    put(query, entry, now = Date.now()) {
      if (!Number.isFinite(entry.at) || entry.at < now - ttl || entry.at > now) return;
      const items = entry.data?.Data?.Items;
      if (!Array.isArray(items)) return;
      const data = { Data: { Items: items.filter((item) => item && typeof item === 'object').map((item) =>
        Object.fromEntries(fields.filter((field) => typeof item[field] === 'string' || typeof item[field] === 'number').map((field) => [field, item[field]]))) } };
      const payload = JSON.stringify(data);
      if (Buffer.byteLength(payload) > 2 * 1024 * 1024) return;
      const store = database(now);
      store.exec('BEGIN IMMEDIATE');
      try {
        store.prepare('INSERT INTO cache VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET at=excluded.at,payload=excluded.payload WHERE excluded.at >= cache.at').run(keyOf(query), entry.at, payload);
        store.exec('DELETE FROM cache WHERE key NOT IN (SELECT key FROM cache ORDER BY at DESC,rowid DESC LIMIT 1000)');
        store.exec('DELETE FROM cache WHERE key IN (SELECT key FROM (SELECT key,SUM(length(CAST(payload AS BLOB))) OVER (ORDER BY at DESC,rowid DESC) AS bytes FROM cache) WHERE bytes > 67108864)');
        store.exec('COMMIT');
      } catch (error) { store.exec('ROLLBACK'); throw error; }
    },
    close() { db?.close(); db = undefined; },
  };
}
