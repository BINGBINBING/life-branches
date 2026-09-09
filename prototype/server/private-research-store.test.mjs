import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPrivateResearchStore } from './private-research-store.mjs';

test('private research persists across connections without cross-owner access', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'private-research-'));
  const file = join(directory, 'research.sqlite');
  const a = createPrivateResearchStore(file), b = createPrivateResearchStore(file);
  const job = { status: 'done', profile: { question: '虚构转行问题', conditionAnswers: { daily_time: '2小时' } }, result: { paths: [] }, conditionHistory: [{ version: 1 }] };
  try {
    const [first, second] = await Promise.all([a.save(job, 'owner-a'), b.save(job, 'owner-b')]);
    assert.equal((await a.list('owner-a')).length, 1);
    assert.equal(await b.get(first.id, 'owner-b'), null);
    assert.equal(await b.remove(first.id, 'owner-b'), false);
    assert.deepEqual((await b.get(first.id, 'owner-a')).job.conditionHistory, job.conditionHistory);
    assert.equal(await a.remove(first.id, 'owner-a'), true);
    assert.equal(await b.get(first.id, 'owner-a'), null);
    assert.ok(await a.get(second.id, 'owner-b'));
  } finally { a.close(); b.close(); rmSync(directory, { recursive: true, force: true }); }
});
