// 轻量 JSONL 存储：用户反馈与用量记录。
// 本实现落盘到 prototype/.local/（已被 .gitignore 忽略）。
// 上云后替换为同接口的 KV/数据库实现即可，调用方无需改动。
import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSearchCache } from './search-cache.mjs';
import { failureCategory } from './telemetry.mjs';

const DATA_DIR = join(process.cwd(), '.local');
const searchCache = createSearchCache();
const errorCategories = new Set(['quota_or_rate_limit', 'provider_failure', 'validation_failure', 'unknown_failure']);
const safeError = (error) => error == null ? null : errorCategories.has(error) ? error : failureCategory({ message: String(error) });

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
    error: safeError(record.error),
    at: Date.now(),
  });
}

export async function listUsage() {
  const rows = await readLines('usage.jsonl');
  const containsLegacyQuestions = rows.some((row) =>
    Object.hasOwn(row, 'question') || (row.error != null && !errorCategories.has(row.error)),
  );
  const sanitized = rows.map(({ question: _question, ...row }) => ({ ...row, error: safeError(row.error) }));
  if (containsLegacyQuestions) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      join(DATA_DIR, 'usage.jsonl'),
      sanitized.map((row) => JSON.stringify(row)).join('\n') +
        (sanitized.length ? '\n' : ''),
      'utf8',
    );
  }
  return sanitized;
}

// ---- 持久搜索缓存：跨进程/重启复用知乎搜索结果（省额度） ----
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

/** 读持久搜索缓存；key 未命中或已过期返回 null。 */
export async function getCachedSearch(key) {
  const cached = searchCache.get(key);
  if (cached) return cached;
  const rows = await readLines('search-cache.jsonl');
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row || row.key !== key) continue;
    if (Date.now() - (row.at || 0) > SEARCH_TTL_MS) return null;
    searchCache.put(key, { at: row.at, data: row.data });
    return searchCache.get(key);
  }
  return null;
}

/** 新缓存只保存来源字段及查询摘要键；旧 JSONL 仅用于兼容读取。 */
export async function putCachedSearch(key, entry) {
  searchCache.put(key, entry);
}
