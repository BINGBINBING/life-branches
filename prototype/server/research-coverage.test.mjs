import assert from 'node:assert/strict';
import test from 'node:test';
import { researchCoverage } from './research-coverage.mjs';

test('coverage describes observed gaps without inventing alternatives or rates', () => {
  const coverage = researchCoverage([{ id: 'S1' }, { id: 'S2', duplicateOf: 'S1' }], [{ cases: [{ sourceId: 'S1', result: 'success' }] }]);
  assert.equal(coverage.sourceCount, 2);
  assert.equal(coverage.duplicateCount, 1);
  assert.equal(coverage.acceptedCount, 1);
  assert.equal(coverage.pathCount, 1);
  assert.ok(coverage.gaps.some((text) => text.includes('受挫')));
  assert.ok(!coverage.gaps.some((text) => text.includes('正向')));
  assert.equal(researchCoverage([], []).acceptedCount, 0);
});
