import test from 'node:test';
import assert from 'node:assert/strict';
import { searchStopReason, verifiedCoverageReached, SEARCH_ROUNDS } from './search-policy.mjs';
import { SEARCH_CALL_LIMIT } from './engine.mjs';

test('each budgeted search round has a distinct purpose and metric layer', () => {
  assert.equal(SEARCH_ROUNDS.length, SEARCH_CALL_LIMIT);
  assert.equal(new Set(SEARCH_ROUNDS.map((round) => round.layer)).size, SEARCH_CALL_LIMIT);
  assert.deepEqual(SEARCH_ROUNDS.map((round) => round.purpose), ['具体转换方向，不混入学校或行业限制', '根据首轮缺口补充', '独立检索学校条件或行业招聘背景', '限制与成本', '后续回顾']);
});

test('search requires two stalled rounds and never exceeds the maximum', () => {
  assert.equal(searchStopReason([5, 5]), '');
  assert.match(searchStopReason([5, 5, 5]), /连续两轮/);
  assert.match(searchStopReason([0, 0, 0]), /不代表信息/);
  assert.equal(searchStopReason([5, 5, 8]), '');
  assert.equal(searchStopReason([5, 8, 8, 9]), '');
  assert.match(searchStopReason([5, 8, 10, 12, 15]), /上限/);
});

test('coverage stop needs distinct validated cases, both stages and comparable conditions', () => {
  const profile = { decisionPath: 'career_change', conditionAnswers: { current_job_function: '运营', target_job_function: '开发' } };
  const cases = Array.from({ length: 4 }, (_, i) => ({ sourceId: `S${i}`, action: { quote: '已实施行动' }, stage: { quote: '阶段原句', result: i % 2 ? 'setback' : 'success' }, conditionComparisons: [{ status: 'different' }] }));
  const result = { paths: [{ cases: cases.slice(0, 2) }, { cases: cases.slice(2) }] };
  assert.equal(verifiedCoverageReached(result, profile), true);
  assert.equal(verifiedCoverageReached(result, { ...profile, conditionAnswers: {} }), false);
  assert.equal(verifiedCoverageReached({ paths: [{ cases }] }, profile), false);
  for (const transform of [
    (item) => ({ ...item, sourceId: 'S1' }),
    (item) => ({ ...item, stage: { ...item.stage, result: 'success' } }),
    (item) => ({ ...item, conditionComparisons: [{ status: 'unknown' }] }),
    (item) => ({ ...item, stage: null }),
  ]) assert.equal(verifiedCoverageReached({ paths: result.paths.map((path) => ({ cases: path.cases.map(transform) })) }, profile), false);
});
