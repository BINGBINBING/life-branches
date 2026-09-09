import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSearchCache } from './search-cache.mjs';

test('search cache omits queries and metadata, preserves sources and expires across connections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'search-cache-'));
  const file = join(directory, 'cache.sqlite');
  const a = createSearchCache(file), b = createSearchCache(file);
  const now = Date.now();
  const item = { Url: 'https://www.zhihu.com/question/1/answer/2', Title: '经验', ContentText: '我完成了项目', AuthorName: '匿名', EditTime: 123 };
  try {
    a.put('私人查询词', { at: now, data: { Query: '私人查询词', Secret: '不应保留', Data: { Items: [{ ...item, RequestText: '不应保留' }] } } }, now);
    assert.deepEqual(b.get('私人查询词', now).data, { Data: { Items: [item] } });
    assert.equal(b.get('另一个问题', now), null);
    b.put('私人查询词', { at: now - 1, data: { Data: { Items: [] } } }, now);
    assert.equal(a.get('私人查询词', now).data.Data.Items.length, 1);
    a.close(); b.close();
    assert.doesNotMatch(readFileSync(file).toString('utf8'), /私人查询词|不应保留/);
    assert.equal(b.get('私人查询词', now + 86400001), null);
    assert.doesNotMatch(readFileSync(file).toString('utf8'), /我完成了项目/);
  } finally { a.close(); b.close(); rmSync(directory, { recursive: true, force: true }); }
});
