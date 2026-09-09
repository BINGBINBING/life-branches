import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewSummaries, summaryHasSupport } from './summary-review.mjs';

function fixture() {
  const quote = '我下班以后每天练习2小时，做了一个项目';
  return {
    result: { paths: [{ cases: [{ sourceId: 'S1', action: { text: quote, quote } }] }] },
    raw: { paths: [{ cases: [{ sourceId: 'S1', action: { text: '下班后持续练习并完成项目', quote } }] }] },
  };
}

test('reviewed summaries stay separate from immutable original quotes', async () => {
  const { result, raw } = fixture();
  const original = result.paths[0].cases[0].action.quote;
  let calls = 0;
  const review = await reviewSummaries(result, raw, [], async () => {
    calls++;
    return { value: { reviews: [{ id: 'S1:action', supported: true }] } };
  });
  assert.equal(calls, 1);
  assert.equal(review.calls, 1);
  assert.equal(result.paths[0].cases[0].action.text, '下班后持续练习并完成项目');
  assert.equal(result.paths[0].cases[0].action.quote, original);
});

test('failed, malformed, ambiguous and negative reviews retain the original excerpt', async () => {
  for (const ask of [
    async () => { throw new Error('timeout'); },
    async () => ({ value: {} }),
    async () => ({ value: { reviews: [{ id: 'S1:action', supported: false }] } }),
    async () => ({ value: { reviews: [{ id: 'S1:action', supported: true }, { id: 'S1:action', supported: false }] } }),
  ]) {
    const { result, raw } = fixture();
    await reviewSummaries(result, raw, [], ask);
    const fact = result.paths[0].cases[0].action;
    assert.equal(fact.text, fact.quote);
  }
  assert.equal(summaryHasSupport('每天8小时', '每天2小时'), false);
  assert.equal(summaryHasSupport('练习因此保证就业', '每天练习'), false);
});

test('practice and risk summaries share the same bounded review call', async () => {
  const insight = { sourceId: 'S1', type: 'risk', quote: '准备期间中断收入，积蓄很快用完', text: '准备期间中断收入，积蓄很快用完' };
  const result = { paths: [], insights: [insight] };
  const review = await reviewSummaries(result, { insights: [{ ...insight, text: '准备过程存在收入中断和积蓄消耗风险' }] }, [], async () => ({ value: { reviews: [{ id: 'insight:0', supported: true }] } }));
  assert.equal(review.calls, 1);
  assert.equal(insight.text, '准备过程存在收入中断和积蓄消耗风险');
  assert.equal(insight.title, '风险归纳');
  assert.equal(insight.quote, '准备期间中断收入，积蓄很快用完');
});

test('unsupported hard facts cannot reach the reviewer even when it would approve', async () => {
  for (const [summary, quote] of [
    ['每天学习2小时', '每周学习2小时'],
    ['本科毕业后做项目', '电子信息专业做项目'],
    ['已成功入职', '我完成了一个项目'],
    ['已就业', '我还没就业'],
    ['转专业获批', '申请转专业后毕业'],
  ]) assert.equal(summaryHasSupport(summary, quote), false, summary);
  const { result, raw } = fixture();
  raw.paths[0].cases[0].action.text = '已成功入职';
  let calls = 0;
  const review = await reviewSummaries(result, raw, [], async () => { calls++; return { value: { reviews: [{ id: 'S1:action', supported: true }] } }; });
  assert.equal(calls, 0);
  assert.equal(review.status, 'no_candidates');
});

test('equal numbers with different units do not establish summary support', () => {
  for (const [summary, quote] of [
    ['投入2年', '每天投入2小时'],
    ['准备6周', '准备6个月'],
    ['成本3万元', '投入3小时'],
    ['完成4学分', '完成4个项目'],
  ]) assert.equal(summaryHasSupport(summary, quote), false);
  assert.equal(summaryHasSupport('准备6个月', '我准备了6个月'), true);
  assert.equal(summaryHasSupport('每天练习2小时', '我每天练习2 小时'), true);
});

test('malformed collections are skipped without losing valid summary candidates', async () => {
  for (const invalid of [null, 'wrong', 42, {}]) {
    const { result, raw } = fixture();
    raw.paths.unshift(invalid, { cases: invalid });
    raw.paths.at(-1).cases.unshift(invalid);
    raw.insights = invalid;
    const review = await reviewSummaries(result, raw, [], async () => ({ value: { reviews: [null, { id: 'S1:action', supported: true }] } }));
    assert.equal(review.status, 'reviewed');
    assert.equal(result.paths[0].cases[0].action.verification, 'model-reviewed');
    const empty = await reviewSummaries(fixture().result, { paths: invalid, insights: invalid }, [], async () => { throw new Error('must not call'); });
    assert.equal(empty.calls, 0);
  }
});
