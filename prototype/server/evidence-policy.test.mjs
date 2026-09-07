import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyHours, compareTime, timeQuestion } from './evidence-policy.mjs';
import {
  validateAnalysis,
  validProfile,
  analyze,
  rematchAnalysis,
} from './engine.mjs';

const source = {
  id: 'S1',
  title: '经历',
  snippets: ['我每天学习八小时，完成了练习项目。'],
  badge: '专业认证',
};
const profile = validProfile({ question: '转行开发', time: '每天两小时' });
const raw = {
  paths: [
    {
      name: '自学',
      cases: [
        {
          sourceId: 'S1',
          kind: 'promotion',
          action: { text: '已经成功入行', quote: '完成了练习项目' },
          outcome: { text: '已经成功入行', quote: '完成了练习项目' },
          result: 'success',
          comparison: {
            text: '专业相同所以有基础',
            status: 'similar',
            quote: '我每天学习八小时',
            userQuote: '每天两小时',
          },
          missing: ['没有编程基础'],
        },
      ],
    },
  ],
  insights: [
    {
      sourceId: 'S1',
      type: 'practice',
      title: '保证就业',
      text: '保证就业',
      quote: '完成了练习项目',
    },
  ],
};

test('A02/A03 only explicit comparable daily durations are used', () => {
  assert.equal(compareTime(source, profile).status, 'different');
  assert.equal(
    compareTime(source, { ...profile, time: '每天八小时' }).status,
    'similar',
  );
  for (const time of [
    '',
    '在校大学生',
    '电子信息专业',
    '每天两到八小时',
    '希望每天八小时',
    '每天八小时左右',
    '不是每天八小时',
  ]) {
    assert.equal(
      compareTime(source, { ...profile, time }).status,
      'unknown',
      time,
    );
  }
  assert.equal(
    compareTime({ ...source, snippets: ['作者在校学习。'] }, profile).status,
    'unknown',
  );
});
test('ambiguous, impossible and conflicting values are not exact capacity', () => {
  for (const text of [
    '每天25小时',
    '每天0小时',
    '每天两小时。每天八小时',
    '如果每天八小时',
    '他每天八小时',
    '建议每天八小时',
  ])
    assert.equal(dailyHours(text), null, text);
  assert.equal(dailyHours('我每天学习2.5小时').value, 2.5);
});
test('question and goal are not evidence of user capacity', () => {
  assert.equal(
    compareTime(source, {
      ...profile,
      time: '',
      goal: '每天八小时',
      question: '每天八小时能转行吗',
    }).status,
    'unknown',
  );
});
test('A04/A05 true quote does not license an invented summary or employment label', () => {
  const result = validateAnalysis(raw, [source], profile);
  const item = result.paths[0].cases[0];
  assert.equal(item.outcome.text, '完成了练习项目');
  assert.equal(item.action.sourceId, 'S1');
  assert.equal(item.result, 'unknown');
  assert.equal(result.insights[0].text, '完成了练习项目');
  assert.deepEqual(item.missing, []);
});
test('A07 badge and model promotion label do not cause exclusion', () => {
  const item = validateAnalysis(raw, [source], profile).paths[0].cases[0];
  assert.equal(item.kind, 'unknown');
  assert.equal(item.classification.status, 'unverified');
});
test('follow-ups are grounded and suppressed for known, ambiguous or skipped time', () => {
  assert.ok(timeQuestion(source, { ...profile, time: '' }));
  assert.equal(timeQuestion(source, profile), null);
  assert.equal(timeQuestion(source, { ...profile, time: '不确定' }), null);
  assert.equal(
    timeQuestion(source, {
      ...profile,
      time: '',
      skipped: ['每天可用多少时间？'],
    }),
    null,
  );
  assert.equal(
    timeQuestion(source, {
      ...profile,
      time: '',
      answers: { '学习时长？': '还没确定' },
    }),
    null,
  );
});
test('A08 no valid action prevents insights and questions', () => {
  const invalid = structuredClone(raw);
  invalid.paths[0].cases[0].action.quote = '原文并没有这一句话';
  const result = validateAnalysis(invalid, [source], profile);
  assert.deepEqual(result.paths, []);
  assert.deepEqual(result.insights, []);
  assert.deepEqual(result.questions, []);
});
test('A10 empty sources make zero calls, failure makes one call without retry', async () => {
  let calls = 0;
  const options = {
    ask: async () => {
      calls++;
      throw new Error('timeout');
    },
  };
  await analyze([], profile, () => {}, options);
  assert.equal(calls, 0);
  await assert.rejects(
    analyze([source], profile, () => {}, options),
    /timeout/,
  );
  assert.equal(calls, 1);
});
test('A09/A10 reuses sources and rematches locally without changing accepted cases', async () => {
  let calls = 0;
  const options = {
    ask: async () => {
      calls++;
      return { value: raw, metadata: { provider: 'test' } };
    },
  };
  const two = await analyze([source], profile, () => {}, options);
  const eight = rematchAnalysis(two, [source], {
    ...profile,
    time: '每天八小时',
  });
  assert.equal(calls, 1);
  assert.equal(two.paths[0].cases[0].comparison.status, 'different');
  assert.equal(eight.paths[0].cases[0].comparison.status, 'similar');
  assert.equal(eight.analysis.calls, 0);
  assert.equal(eight.paths[0].cases.length, two.paths[0].cases.length);
  assert.equal(eight.analysis.budget.retries, 0);
  assert.equal(eight.ruleVersion, 'evidence-3');
});
