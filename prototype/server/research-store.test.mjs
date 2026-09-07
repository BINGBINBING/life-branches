import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createResearchStore } from './research-store.mjs';

function completedJob(question, conditions = {}) {
  return {
    id: 'runtime-job',
    status: 'done',
    profile: {
      question,
      decisionScope: 'career_transition',
      conditionAnswers: conditions,
    },
    result: { paths: [{ id: 'p1', cases: [{ id: 'S1' }] }] },
  };
}

test('research records persist independent condition versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'life-branches-store-'));
  const file = join(directory, 'records.json');
  try {
    const store = createResearchStore(file);
    const first = await store.save(
      completedJob('转行开发', { daily_time: '2小时' }),
    );
    const second = await store.save(
      completedJob('转行开发', { daily_time: '8小时' }),
    );
    const list = await createResearchStore(file).list();
    assert.equal(list.length, 2);
    assert.equal(list[0].conditions[0].label, '稳定投入时间');
    assert.notEqual(first.id, second.id);
    assert.equal((await store.get(first.id)).job.profile.conditionAnswers.daily_time, '2小时');
    assert.equal((await store.get(second.id)).job.profile.conditionAnswers.daily_time, '8小时');
    assert.equal((await store.remove(first.id)), true);
    assert.equal((await store.list()).length, 1);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('unfinished jobs cannot be saved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'life-branches-store-'));
  try {
    const store = createResearchStore(join(directory, 'records.json'));
    await assert.rejects(() => store.save({ status: 'running' }), /完成后/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
