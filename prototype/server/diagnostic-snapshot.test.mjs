import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeDiagnosticSnapshot, saveDiagnosticSnapshot } from './diagnostic-snapshot.mjs';

test('diagnostic snapshots only retain bounded UI metadata', () => {
  const result = normalizeDiagnosticSnapshot({ researchId: 'job-123', secret: 'private', profile: { text: 'private' }, scroll: { x: Infinity, y: -1 }, details: [{ open: true, quote: 'private', caseId: 'case-1' }], filter: 'success', visibleCaseIds: ['case-1', '../private'] });
  assert.equal(result.researchId, 'job-123');
  assert.equal(result.details[0].open, true);
  assert.deepEqual(result.scroll, { x: 0, y: 0 });
  assert.deepEqual(result.visibleCaseIds, ['case-1']);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.equal(normalizeDiagnosticSnapshot({ details: Array(3000).fill(null) }).details.length, 2000);
});

test('diagnostic snapshot replaces latest locally with private file permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'diagnostics-'));
  try {
    await saveDiagnosticSnapshot({ researchId: 'first' }, directory);
    await saveDiagnosticSnapshot({ researchId: 'second' }, directory);
    assert.equal(JSON.parse(await readFile(join(directory, 'latest.json'), 'utf8')).researchId, 'second');
    assert.deepEqual(await readdir(directory), ['latest.json']);
    assert.equal((await stat(join(directory, 'latest.json'))).mode & 0o777, 0o600);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
