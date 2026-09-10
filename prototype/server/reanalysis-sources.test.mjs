import test from 'node:test';
import assert from 'node:assert/strict';
import { reanalysisSources } from './reanalysis-sources.mjs';

test('restored sources reject invalid hosts and duplicated identifiers', () => {
  const source = { id: 'S1', url: 'https://www.zhihu.com/question/1', snippets: ['原始片段'] };
  assert.throws(() => reanalysisSources([]));
  assert.throws(() => reanalysisSources([source, source]));
  assert.throws(() => reanalysisSources([{ ...source, url: 'https://zhihu.com.evil.test/' }]));
  assert.throws(() => reanalysisSources([{ ...source, snippets: [null] }]));
  assert.equal(reanalysisSources([{ ...source, apiKey: 'private' }])[0].apiKey, undefined);
});
