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
