import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTelemetry, failureCategory } from './telemetry.mjs';

test('telemetry stores operational fields but drops user content and keys', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'life-branches-metrics-'));
  const file = join(directory, 'metrics.jsonl');
  try {
    const telemetry = createTelemetry(file);
    await telemetry.record({
      requestId: 'r1',
      event: 'completed',
      elapsedMs: 42,
      searchCalls: 2,
      queryLayer: 'expanded_gap',
      citationPassRate: 0.75,
      question: 'private question',
      apiKey: 'secret',
    });
    const raw = await readFile(file, 'utf8');
    assert.doesNotMatch(raw, /private question|secret|apiKey/);
    assert.match(raw, /expanded_gap/);
    assert.equal((await telemetry.summary()).searchCalls, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('failure categories are stable and do not expose messages', () => {
  assert.equal(failureCategory(new Error('知乎额度不足')), 'quota_or_rate_limit');
  assert.equal(failureCategory(new Error('DeepSeek 请求超时')), 'provider_failure');
  assert.equal(failureCategory(new Error('分析格式不完整')), 'validation_failure');
});
