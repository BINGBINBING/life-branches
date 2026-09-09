import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUsageGate } from './usage-gate.mjs';

test('durable budget is shared across instances, fails closed and rolls over daily', () => {
  const directory = mkdtempSync(join(tmpdir(), 'branch-budget-'));
  const options = { file: join(directory, 'budget.sqlite'), searchLimit: 5, modelLimit: 2, minuteLimit: 2 };
  const a = createUsageGate(options), b = createUsageGate(options);
  const now = Date.UTC(2026, 8, 9);
  try {
    a.reserve('client-a', { searches: 5, models: 2 }, now);
    assert.throws(() => b.reserve('client-b', { searches: 1, models: 0 }, now), /预算/);
    b.reserve('client-a', { searches: 0, models: 0 }, now);
    assert.throws(() => a.reserve('client-a', { searches: 0, models: 0 }, now), /频繁/);
    a.close();
    const restarted = createUsageGate(options);
    try {
      assert.throws(() => restarted.reserve('client-c', { searches: 1, models: 0 }, now), /预算/);
      restarted.reserve('client-c', { searches: 5, models: 2 }, now + 86400000);
    } finally { restarted.close(); }
  } finally { a.close(); b.close(); rmSync(directory, { recursive: true, force: true }); }
});
