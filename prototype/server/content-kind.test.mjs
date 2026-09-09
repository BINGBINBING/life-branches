import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyContent } from './content-kind.mjs';

test('content kinds describe textual signals without asserting verified identity', () => {
  assert.equal(classifyContent('我完成了项目').kind, 'self');
  assert.equal(classifyContent('我朋友完成了项目').kind, 'retold');
  assert.equal(classifyContent('建议你完成项目').kind, 'advice');
  assert.equal(classifyContent('完成了项目').kind, 'unknown');
  assert.match(classifyContent('我完成项目').reason, /不代表真实性/);
});

test('promotion classification uses explicit conversion text rather than author status', () => {
  const classified = classifyContent('我学习了编程', ['我学习了编程。添加微信报名咨询。']);
  assert.equal(classified.kind, 'promotion');
  assert.equal(classified.promotionQuote, '添加微信报名咨询');
  assert.equal(classifyContent('我学习了编程', ['我是认证教师']).kind, 'self');
  assert.equal(classifyContent('我学习了编程', ['不要添加微信报名咨询']).kind, 'self');
});
