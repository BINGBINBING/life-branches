import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIntake } from './intake.mjs';
import { dictionaryIndex } from './condition-dictionary.mjs';
import { searchQueries } from './engine.mjs';

const cases = JSON.parse(
  await readFile(new URL('./evaluation-cases.json', import.meta.url), 'utf8'),
);

test('evaluation set has 20 cases per direction and all risk scenarios', () => {
  assert.equal(new Set(cases.map((item) => item.id)).size, 40);
  for (const direction of ['major_transition', 'career_transition']) {
    const selected = cases.filter((item) => item.direction === direction);
    assert.equal(selected.length, 20);
    assert.deepEqual(
      new Set(selected.map((item) => item.scenario)),
      new Set([
        'sufficient',
        'insufficient',
        'condition_conflict',
        'single_sided',
        'promotion',
        'unknown_result',
      ]),
    );
  }
});

test('all evaluation questions produce bounded, controlled intake and search plans', () => {
  for (const item of cases) {
    const plan = normalizeIntake(item.question);
    assert.equal(plan.supported, true, item.id);
    assert.equal(plan.scope, item.direction, item.id);
    assert.equal(plan.path, item.expectedPath, item.id);
    if (item.expectedSector) assert.equal(plan.sector, item.expectedSector, item.id);
    assert.ok(plan.fields.length >= 4, item.id);
    assert.ok(
      plan.fields.filter((field) => !field.initialValue).length <= 6,
      item.id,
    );
    assert.ok(plan.fields.every((field) => dictionaryIndex.has(field.id)), item.id);
    const queries = searchQueries({
      question: item.question,
      decisionScope: plan.scope,
      decisionPath: plan.path,
      decisionSector: plan.sector,
      conditionAnswers: {},
    });
    assert.equal(queries.length, 5, item.id);
    assert.equal(new Set(queries).size, 5, item.id);
    assert.ok(queries.every((query) => query.trim().length > 0), item.id);
    assert.ok(queries.every((query) => query.length < 500), item.id);
  }
});
