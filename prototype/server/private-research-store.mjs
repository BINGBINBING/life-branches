import { DatabaseSync } from 'node:sqlite';
import { chmodSync, closeSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dictionaryIndex } from './condition-dictionary.mjs';

export function createPrivateResearchStore(file = join(process.cwd(), '.local', 'private-research.sqlite')) {
  let db;
  function database() {
    if (!db) {
      mkdirSync(dirname(file), { recursive: true });
      db = new DatabaseSync(file);
      chmodSync(file, 0o600);
      db.exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS research (id TEXT PRIMARY KEY, owner TEXT NOT NULL, savedAt INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS research_owner ON research(owner);');
      db.exec('CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, owner TEXT NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS feedback_owner ON feedback(owner);');
    }
    db.prepare('DELETE FROM research WHERE savedAt < ?').run(Date.now() - 30 * 86400000);
    db.prepare('DELETE FROM feedback WHERE at < ?').run(Date.now() - 30 * 86400000);
    return db;
  }
  function summary(row) {
    const job = JSON.parse(row.payload);
    const profile = job.profile;
    return { id: row.id, savedAt: row.savedAt, question: profile.question, scope: profile.decisionScope || '',
      pathCount: job.result.paths.length, caseCount: job.result.paths.reduce((n, path) => n + path.cases.length, 0),
      conditionCount: Object.keys(profile.conditionAnswers || {}).length,
      conditions: [
        profile.background && { id: 'background', label: '背景', value: profile.background },
        profile.time && { id: 'time', label: '投入', value: profile.time },
        profile.goal && { id: 'goal', label: '目标与限制', value: profile.goal },
        ...Object.entries(profile.conditionAnswers || {}).map(([id, value]) => ({ id, label: dictionaryIndex.get(id)?.label || id, value })),
      ].filter(Boolean),
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
    async addFeedback(record, owner) {
      if (!owner) throw new Error('反馈会话无效。');
      const store = database();
      const at = Date.now();
      store.exec('BEGIN IMMEDIATE');
      try {
        store.prepare('INSERT INTO feedback VALUES(?,?,?,?)').run(record.id, owner, at, JSON.stringify({ ...record, at }));
        store.prepare('DELETE FROM feedback WHERE owner=? AND id NOT IN (SELECT id FROM feedback WHERE owner=? ORDER BY at DESC,rowid DESC LIMIT 100)').run(owner, owner);
        store.exec('COMMIT');
      } catch (error) { store.exec('ROLLBACK'); throw error; }
    },
    async listAllFeedback() {
      return database().prepare('SELECT payload FROM feedback ORDER BY at ASC,rowid ASC').all().map((row) => JSON.parse(row.payload));
    },
    async removeFeedback(owner) {
      return database().prepare('DELETE FROM feedback WHERE owner=?').run(owner).changes;
    },
    async backup(destination) {
      const store = database();
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      closeSync(openSync(destination, 'wx', 0o600));
      try {
        store.prepare('VACUUM INTO ?').run(destination);
      } catch (error) {
        unlinkSync(destination);
        throw error;
      }
    },
    close() { db?.close(); db = undefined; },
  };
}
