import test from 'node:test';
import assert from 'node:assert/strict';
import { markDuplicateSources } from './source-duplicates.mjs';

test('long repeated stories are marked without losing either source link', () => {
  const text = '我每天工作之后花2小时练习，先完成一个项目，再整理作品和申请记录。'.repeat(6);
  const source = { id: 'S1', title: '转行记录', author: '作者甲', url: 'https://zhihu.com/1', snippets: [text] };
  const items = markDuplicateSources([source, { ...source, id: 'S2', url: 'https://zhihu.com/2', snippets: [text.replaceAll('，', '， ')] }]);
  assert.equal(items.length, 2);
  assert.equal(items[1].duplicateOf, 'S1');
  assert.equal(items[1].url, 'https://zhihu.com/2');
  assert.equal(source.duplicateOf, undefined);
  for (const changed of [text.replace('2小时', '8小时'), text.replace('完成', '未完成')]) {
    assert.equal(markDuplicateSources([source, { ...source, id: 'S2', snippets: [changed] }])[1].duplicateOf, undefined);
  }
  assert.equal(markDuplicateSources([{ ...source, snippets: ['我学习编程'] }, { ...source, id: 'S2', snippets: ['我学习编程'] }])[1].duplicateOf, undefined);
});
