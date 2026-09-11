import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
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
    await a.addFeedback({ id: 'f-a', comment: '会话A反馈' }, 'owner-a');
    await b.addFeedback({ id: 'f-b', comment: '会话B反馈' }, 'owner-b');
    assert.equal(await a.removeFeedback('owner-a'), 1);
    assert.deepEqual((await b.listAllFeedback()).map((item) => item.id), ['f-b']);
    assert.equal(await a.removeFeedback('owner-a'), 0);
  } finally { a.close(); b.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('private research backup restores retained records and refuses overwrite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'research-backup-'));
  const file = join(directory, 'research.sqlite');
  const backup = join(directory, 'backup.sqlite');
  const store = createPrivateResearchStore(file);
  let restored;
  try {
    const job = { status: 'done', profile: { question: '虚构问题', background: '测试背景', time: '每天2小时', goal: '测试目标' }, result: { paths: [] } };
    const first = await store.save(job, 'owner');
    const expired = await store.save(job, 'owner');
    const db = new DatabaseSync(file);
    db.prepare('UPDATE research SET savedAt=? WHERE id=?').run(Date.now() - 31 * 86400000, expired.id);
    db.close();
    await store.backup(backup);
    // Windows 没有 POSIX 权限位，statSync().mode 恒为 0o666，chmod 0o600 不会生效，
    // 因此只在支持权限位的平台上断言。Windows 上的访问控制依赖目录 ACL，不在本用例覆盖范围。
    if (process.platform !== 'win32') {
      assert.equal(statSync(file).mode & 0o777, 0o600);
      assert.equal(statSync(backup).mode & 0o777, 0o600);
    }
    await assert.rejects(store.backup(backup), { code: 'EEXIST' });
    await store.remove(first.id, 'owner');
    restored = createPrivateResearchStore(backup);
    assert.deepEqual((await restored.get(first.id, 'owner')).job, job);
    assert.equal(await restored.get(first.id, 'other-owner'), null);
    assert.equal(await restored.get(expired.id, 'owner'), null);
    assert.deepEqual((await restored.list('owner'))[0].conditions.map((item) => item.id), ['background', 'time', 'goal']);
    for (let i = 0; i < 61; i++) await restored.save(job, 'owner');
    assert.equal((await restored.list('owner')).length, 60);
    assert.equal(await restored.get(first.id, 'owner'), null);
  } finally {
    store.close(); restored?.close(); rmSync(directory, { recursive: true, force: true });
  }
});
