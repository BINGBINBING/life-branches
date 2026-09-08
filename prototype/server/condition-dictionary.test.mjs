import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeConditions,
  CONDITION_ANSWER_TYPES,
  conditions,
  discoverySources,
  dictionaryIndex,
  candidateConditions,
} from './condition-dictionary.mjs';

test('condition dictionary has stable unique ids and evidence references', () => {
  assert.equal(dictionaryIndex.size, conditions.length);
  const sources = new Set(discoverySources.map((item) => item.id));
  for (const item of conditions) {
    assert.match(item.id, /^[a-z_]+$/);
    assert.ok(item.scope.length > 0);
    assert.ok(item.label && item.question);
    assert.ok(item.evidence.every((id) => sources.has(id)));
    assert.equal(
      item.policy.source_required,
      item.policy.context_only ? false : true,
    );
  }
});

test('expansion does not activate new runtime questions', () => {
  assert.deepEqual(
    activeConditions('career_transition').map((x) => x.id),
    ['daily_time'],
  );
  assert.deepEqual(
    activeConditions('major_transition').map((x) => x.id),
    ['daily_time'],
  );
});

test('route and sector selection keeps unrelated questions out', () => {
  assert.deepEqual(candidateConditions(), []);
  const campus = candidateConditions({
    scope: 'major_transition',
    path: 'campus_transfer',
  });
  assert.ok(campus.some((c) => c.id === 'makeup_credits'));
  assert.ok(!campus.some((c) => c.id === 'second_degree_eligibility'));
  const second = candidateConditions({
    scope: 'major_transition',
    path: 'second_bachelor',
  });
  assert.ok(second.some((c) => c.id === 'second_degree_teaching_mode'));
  assert.ok(!second.some((c) => c.id === 'outgoing_permission'));
  const design = candidateConditions({
    scope: 'career_transition',
    sector: 'design',
  });
  assert.ok(design.some((c) => c.id === 'design_process'));
  assert.ok(!design.some((c) => c.id === 'accounting_vouchers'));
  assert.ok(design.every((c) => c.nodeType === 'atomic'));
});

test('dictionary exposes explicit multi-select and amount field types', () => {
  assert.equal(dictionaryIndex.get('employment_type').policy.answer_type, 'multi_select');
  assert.equal(dictionaryIndex.get('assessment_format').policy.answer_type, 'multi_select');
  assert.equal(dictionaryIndex.get('training_cost_ceiling').policy.answer_type, 'amount');
});

test('every dictionary answer type belongs to the frontend control contract', () => {
  const supported = new Set(CONDITION_ANSWER_TYPES);
  for (const item of conditions)
    assert.ok(
      supported.has(item.policy.answer_type || 'text'),
      `${item.id}: ${item.policy.answer_type}`,
    );
  assert.ok(!conditions.some((item) => item.policy.answer_type === 'multi_choice'));
});

test('the intake catalogue covers every required control type', () => {
  const types = new Set(
    conditions
      .filter((item) => item.nodeType === 'atomic')
      .map((item) => item.policy.answer_type),
  );
  for (const type of [
    'single_choice',
    'multi_select',
    'date',
    'integer',
    'duration',
    'amount',
    'url',
  ])
    assert.ok(types.has(type), type);
});

test('discovered conditions have specific source-supported quotes; legacy links are not promoted', () => {
  const byId = new Map(discoverySources.map((s) => [s.id, s]));
  for (const item of conditions) {
    if (item.parentId) assert.ok(dictionaryIndex.has(item.parentId), item.id);
    if (item.origin === 'zhihu_discovered') {
      assert.ok(item.evidenceLinks.length);
      for (const link of item.evidenceLinks) {
        const source = byId.get(link.sourceId);
        assert.equal(source.quote, link.quote);
        assert.ok(source.supports.includes(item.id));
      }
    }
    if (item.origin === 'legacy_candidate') assert.deepEqual(item.evidence, []);
  }
});
