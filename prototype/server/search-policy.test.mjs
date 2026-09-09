import test from 'node:test';
import assert from 'node:assert/strict';
import { searchStopReason } from './search-policy.mjs';

test('search requires two stalled rounds and never exceeds the maximum', () => {
  assert.equal(searchStopReason([5, 5]), '');
  assert.match(searchStopReason([5, 5, 5]), /连续两轮/);
  assert.match(searchStopReason([0, 0, 0]), /不代表信息/);
  assert.equal(searchStopReason([5, 5, 8]), '');
  assert.equal(searchStopReason([5, 8, 8, 9]), '');
  assert.match(searchStopReason([5, 8, 10, 12, 15]), /上限/);
});
