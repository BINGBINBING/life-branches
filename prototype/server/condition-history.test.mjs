import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionHistory } from './condition-history.mjs';

test('history distinguishes initialization, evidence followup and manual correction', () => {
  const profile = { conditionAnswers: { daily_time: '2小时' }, answers: {} };
  const first = conditionHistory(null, profile, 100);
  const previous = { profile, createdAt: 100, conditionHistory: first,
    result: { questions: [{ conditionId: 'daily_time', question: '每天多久？', sourceId: 'S1', quote: '每天8小时', origin: 'evidence' }] },
  };
  const updated = { conditionAnswers: { daily_time: '8小时' }, answers: { '每天多久？': '8小时' } };
  const second = conditionHistory(previous, updated, 200);
  assert.equal(second.length, 2);
  assert.equal(second[1].changes[0].origin, 'evidence');
  assert.equal(second[1].changes[0].before, '2小时');
  assert.equal(second[1].changes[0].after, '8小时');
  assert.equal(second[1].changes[0].sourceId, 'S1');
  assert.equal(first.length, 1);
  assert.equal(second[0].values.daily_time, '2小时');
  const manual = conditionHistory(previous, { conditionAnswers: { daily_time: '' } }, 300);
  assert.equal(manual[1].changes[0].origin, 'edit');
  assert.equal(manual[1].changes[0].after, '');
  assert.equal(conditionHistory(previous, profile, 400).length, 1);
});

test('legacy records get an honest baseline and basic followups keep no citation', () => {
  const previous = { profile: { conditionAnswers: {} }, createdAt: 100,
    result: { questions: [{ conditionId: 'institution_name', question: '学校？', origin: 'basic' }] },
  };
  const versions = conditionHistory(previous, { conditionAnswers: { institution_name: '示例大学' }, answers: { '学校？': '示例大学' } }, 200);
  assert.equal(versions[0].kind, 'legacy');
  assert.equal(versions[1].changes[0].origin, 'basic');
  assert.equal(versions[1].changes[0].quote, '');
});
