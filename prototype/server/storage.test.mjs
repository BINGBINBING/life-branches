import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('usage storage drops new and legacy question text', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'life-branches-storage-'));
  const dataDir = join(cwd, '.local');
  const moduleUrl = new URL('./storage.mjs', import.meta.url).href;
  try {
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(dataDir, { recursive: true }),
    );
    await writeFile(
      join(dataDir, 'usage.jsonl'),
      `${JSON.stringify({ kind: 'explore', question: '私人问题', error: '错误中夹带私人描述', at: 1 })}\n`,
      'utf8',
    );
    const script = `
      const storage = await import(${JSON.stringify(moduleUrl)});
      await storage.addUsage({ ok: false, question: '不应保存', error: 'DeepSeek 错误中夹带私人描述' });
      const rows = await storage.listUsage();
      if (rows.some((row) => Object.hasOwn(row, 'question'))) process.exit(2);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const stored = await readFile(join(dataDir, 'usage.jsonl'), 'utf8');
    assert.doesNotMatch(stored, /私人问题|不应保存|"question"|私人描述/);
    assert.match(stored, /unknown_failure/);
    assert.match(stored, /provider_failure/);
  } finally {
    await rm(resolve(cwd), { recursive: true, force: true });
  }
});

test('an unavailable cache is treated as a miss rather than a search failure', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'cache-unavailable-'));
  const { mkdir } = await import('node:fs/promises');
  try {
    await mkdir(join(cwd, '.local', 'search-cache.sqlite'), { recursive: true });
    const moduleUrl = new URL('./storage.mjs', import.meta.url).href;
    const script = `const storage = await import(${JSON.stringify(moduleUrl)}); if (await storage.getCachedSearch('虚构问题') !== null) process.exit(2);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
