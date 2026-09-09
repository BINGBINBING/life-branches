import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export function createUsageGate({ file = join(process.cwd(), '.local', 'budget.sqlite'), searchLimit = 50, modelLimit = 100, minuteLimit = 6 } = {}) {
  let db;
  return {
    reserve(client, cost, now = Date.now()) {
      if (!db) {
        mkdirSync(dirname(file), { recursive: true });
        db = new DatabaseSync(file);
        db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, searches INTEGER NOT NULL, models INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS client_budget (client TEXT NOT NULL, day TEXT NOT NULL, searches INTEGER NOT NULL, models INTEGER NOT NULL, PRIMARY KEY(client, day)); CREATE TABLE IF NOT EXISTS rate (client TEXT NOT NULL, minute INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(client, minute));');
      }
      const day = new Date(now).toISOString().slice(0, 10);
      const minute = Math.floor(now / 60000);
      const key = createHash('sha256').update(client || 'unknown').digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const used = db.prepare('SELECT * FROM budget WHERE day=?').get(day) || { searches: 0, models: 0 };
        const rate = db.prepare('SELECT count FROM rate WHERE client=? AND minute=?').get(key, minute)?.count || 0;
        const clientUsed = db.prepare('SELECT * FROM client_budget WHERE client=? AND day=?').get(key, day) || { searches: 0, models: 0 };
        if (rate >= minuteLimit) throw new Error('请求过于频繁，请一分钟后再试。');
        if (clientUsed.searches + cost.searches > 10 || clientUsed.models + cost.models > 20)
          throw new Error('当前连接今日调用预算已用完，请明天再试。');
        if (used.searches + cost.searches > searchLimit || used.models + cost.models > modelLimit)
          throw new Error('今日外部调用预算已达到上限；仍可查看已有结果。');
        db.prepare('INSERT INTO budget VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET searches=excluded.searches, models=excluded.models').run(day, used.searches + cost.searches, used.models + cost.models);
        db.prepare('INSERT INTO client_budget VALUES(?,?,?,?) ON CONFLICT(client,day) DO UPDATE SET searches=excluded.searches, models=excluded.models').run(key, day, clientUsed.searches + cost.searches, clientUsed.models + cost.models);
        db.prepare('INSERT INTO rate VALUES(?,?,?) ON CONFLICT(client,minute) DO UPDATE SET count=excluded.count').run(key, minute, rate + 1);
        db.prepare('DELETE FROM rate WHERE minute < ?').run(minute - 2);
        db.prepare('DELETE FROM budget WHERE day < ?').run(new Date(now - 7 * 86400000).toISOString().slice(0, 10));
        db.prepare('DELETE FROM client_budget WHERE day < ?').run(day);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() { db?.close(); db = undefined; },
  };
}
