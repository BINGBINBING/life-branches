// 轻量 JSONL 存储：用户反馈与用量记录。
// 本实现落盘到 prototype/.local/（已被 .gitignore 忽略）。
// 上云后替换为同接口的 KV/数据库实现即可，调用方无需改动。
import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), '.local');

async function appendLine(file, obj) {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(join(DATA_DIR, file), JSON.stringify(obj) + '\n', 'utf8');
}

async function readLines(file) {
  try {
    const text = await readFile(join(DATA_DIR, file), 'utf8');
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function addFeedback(record) {
  await appendLine('feedback.jsonl', {
    id: record.id,
    rating: record.rating,
    comment: record.comment ?? '',
    question: record.question ?? '',
    jobId: record.jobId ?? null,
    at: Date.now(),
  });
}

export async function listFeedback() {
  return readLines('feedback.jsonl');
}

export async function addUsage(record) {
  await appendLine('usage.jsonl', {
    kind: 'explore',
    ok: record.ok,
    reused: Boolean(record.reused),
    sources: record.sources ?? 0,
    provider: record.provider ?? null,
    model: record.model ?? null,
    usage: record.usage ?? null,
    error: record.error ?? null,
    question: record.question ?? '',
    at: Date.now(),
  });
}

export async function listUsage() {
  return readLines('usage.jsonl');
}

// ---- 持久搜索缓存：跨进程/重启复用知乎搜索结果（省额度） ----
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时
const SEARCH_MAX_LINES = 2000; // 超过后压缩，只保留每个 query 最新一条

async function compactFile(file) {
  const rows = await readLines(file);
  if (rows.length <= SEARCH_MAX_LINES) return;
  const latest = new Map();
  for (const row of rows) {
    if (!row || typeof row.key !== 'string') continue;
    if (Date.now() - (row.at || 0) > SEARCH_TTL_MS) continue; // 丢弃过期
    latest.set(row.key, row);
  }
  await mkdir(DATA_DIR, { recursive: true });
  const keep = [...latest.values()]
    .sort((a, b) => a.at - b.at)
    .slice(-Math.floor(SEARCH_MAX_LINES / 2));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(
    join(DATA_DIR, file),
    keep.map((r) => JSON.stringify(r)).join('\n') + (keep.length ? '\n' : ''),
    'utf8',
  );
}

/** 读持久搜索缓存；key 未命中或已过期返回 null。 */
export async function getCachedSearch(key) {
  const rows = await readLines('search-cache.jsonl');
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row || row.key !== key) continue;
    if (Date.now() - (row.at || 0) > SEARCH_TTL_MS) return null;
    return { at: row.at, data: row.data };
  }
  return null;
}

/** 写入持久搜索缓存（追加；重复 key 以最新一条为准），并顺带做容量压缩。 */
export async function putCachedSearch(key, entry) {
  await appendLine('search-cache.jsonl', {
    key,
    at: entry.at,
    data: entry.data,
  });
  try {
    await compactFile('search-cache.jsonl');
  } catch {
    // 压缩失败不影响写入本身。
  }
}
