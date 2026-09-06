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
