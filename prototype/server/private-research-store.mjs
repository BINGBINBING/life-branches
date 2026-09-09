import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dictionaryIndex } from './condition-dictionary.mjs';

export function createPrivateResearchStore(file = join(process.cwd(), '.local', 'private-research.sqlite')) {
  let db;
  function database() {
    if (!db) {
      mkdirSync(dirname(file), { recursive: true });
      db = new DatabaseSync(file);
      db.exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS research (id TEXT PRIMARY KEY, owner TEXT NOT NULL, savedAt INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS research_owner ON research(owner);');
    }
    db.prepare('DELETE FROM research WHERE savedAt < ?').run(Date.now() - 30 * 86400000);
    return db;
  }
  function summary(row) {
    const job = JSON.parse(row.payload);
    const profile = job.profile;
    return { id: row.id, savedAt: row.savedAt, question: profile.question, scope: profile.decisionScope || '',
      pathCount: job.result.paths.length, caseCount: job.result.paths.reduce((n, path) => n + path.cases.length, 0),
      conditionCount: Object.keys(profile.conditionAnswers || {}).length,
      conditions: Object.entries(profile.conditionAnswers || {}).map(([id, value]) => ({ id, label: dictionaryIndex.get(id)?.label || id, value })),
    };
  }
  return {
    async list(owner) { return database().prepare('SELECT * FROM research WHERE owner=? ORDER BY savedAt DESC').all(owner).map(summary); },
    async get(id, owner) {
      const row = database().prepare('SELECT * FROM research WHERE id=? AND owner=?').get(id, owner);
      return row ? { id: row.id, savedAt: row.savedAt, job: JSON.parse(row.payload) } : null;
    },
    async save(job, owner) {
      if (!owner || job?.status !== 'done' || !job.result) throw new Error('探索完成后才能保存。');
      const store = database();
      const row = { id: randomUUID(), savedAt: Date.now(), payload: JSON.stringify(job) };
      store.exec('BEGIN IMMEDIATE');
      try {
        const total = store.prepare('SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) AS bytes FROM research WHERE owner=?').get(owner).bytes;
        if (total + Buffer.byteLength(row.payload) > 8 * 1024 * 1024) throw new Error('研究版本空间已满，请先删除旧版本。');
        store.prepare('INSERT INTO research VALUES(?,?,?,?)').run(row.id, owner, row.savedAt, row.payload);
        store.prepare('DELETE FROM research WHERE owner=? AND id NOT IN (SELECT id FROM research WHERE owner=? ORDER BY savedAt DESC, rowid DESC LIMIT 60)').run(owner, owner);
        store.exec('COMMIT');
        return summary(row);
      } catch (error) { store.exec('ROLLBACK'); throw error; }
    },
    async remove(id, owner) { return database().prepare('DELETE FROM research WHERE id=? AND owner=?').run(id, owner).changes > 0; },
    close() { db?.close(); db = undefined; },
  };
}
