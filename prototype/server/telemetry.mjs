import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ALLOWED = new Set([
  'requestId',
  'event',
  'stage',
  'queryLayer',
  'status',
  'elapsedMs',
  'provider',
  'model',
  'ruleVersion',
  'searchCalls',
  'cacheHits',
  'sourceCount',
  'acceptedCases',
  'rejected',
  'rejectionReasons',
  'citationPassRate',
]);

export function defaultTelemetryPath(cwd = process.cwd()) {
  return join(cwd, '.local', 'metrics.jsonl');
}

function cleanEvent(input) {
  const event = { at: new Date().toISOString() };
  for (const [key, value] of Object.entries(input || {})) {
    if (!ALLOWED.has(key)) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      (key === 'rejectionReasons' && value && typeof value === 'object')
    )
      event[key] = value;
  }
  return event;
}

export function createTelemetry(file = defaultTelemetryPath()) {
  let queue = Promise.resolve();
  return {
    record(input) {
      const event = cleanEvent(input);
      const next = queue.then(async () => {
        await mkdir(dirname(file), { recursive: true });
        await appendFile(file, `${JSON.stringify(event)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        });
      });
      queue = next.catch(() => {});
      return next;
    },
    async summary() {
      let lines = [];
      try {
        lines = (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      const events = lines.slice(-500).flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
      return {
        eventCount: events.length,
        completed: events.filter((item) => item.event === 'completed').length,
        failed: events.filter((item) => item.event === 'failed').length,
        searchCalls: events.reduce(
          (sum, item) => sum + (Number(item.searchCalls) || 0),
          0,
        ),
        latest: events.slice(-20),
      };
    },
  };
}

export function failureCategory(error) {
  const message = String(error?.message || '');
  if (/额度|QUOTA|请求受限/.test(message)) return 'quota_or_rate_limit';
  if (/DeepSeek|知乎服务|连接|超时/.test(message)) return 'provider_failure';
  if (/格式|引用|分析/.test(message)) return 'validation_failure';
  return 'unknown_failure';
}
