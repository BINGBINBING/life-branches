import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregate,
  parseModel,
  validateAnalysis,
  validProfile,
} from './engine.mjs';

const profile = validProfile({ question: '在职转行开发', time: '每天两小时' });
const sources = [
  {
    id: 'S1',
    title: '我的自学经历',
    snippets: ['我脱产每天学习八小时，独立做了项目，后来找到工作。'],
  },
];
const raw = {
  paths: [
    {
      name: '脱产自学',
      cases: [
        {
          sourceId: 'S1',
          kind: 'self',
          action: { text: '独立做项目', quote: '独立做了项目' },
          outcome: { text: '已就业', quote: '后来找到工作' },
          result: 'success',
          comparison: {
            text: '学习投入不同',
            quote: '我脱产每天学习八小时',
            userQuote: '每天两小时',
            status: 'different',
          },
        },
      ],
    },
  ],
  insights: [],
  questions: [],
};

test('preserves distinct query snippets while deduplicating canonical URLs', () => {
  const make = (text, query) => ({
    query,
    data: {
      Data: {
        Items: [
          {
            Url: `https://zhuanlan.zhihu.com/p/1?q=${query}`,
            ContentText: text,
            Title: '经历',
          },
        ],
      },
    },
  });
  const result = aggregate([make('第一个片段', 'a'), make('第二个片段', 'b')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].snippets.length, 2);
});
test('rejects non-Zhihu source links', () => {
  assert.equal(
    aggregate([
      {
        query: 'q',
        data: {
          Data: {
            Items: [
              { Url: 'https://zhihu.com.evil.test/p/1', ContentText: '材料' },
            ],
          },
        },
      },
    ]).length,
    0,
  );
});
test('valid evidence keeps cases and comparisons', () => {
  const r = validateAnalysis(raw, sources, profile);
  assert.equal(r.paths[0].cases[0].result, 'success');
  assert.equal(r.paths[0].cases[0].comparison.status, 'different');
});
test('invented quote cannot establish outcome', () => {
  const input = structuredClone(raw);
  input.paths[0].cases[0].outcome.quote = '年薪一百万';
  const r = validateAnalysis(input, sources, profile);
  assert.equal(r.paths[0].cases[0].outcome, null);
  assert.equal(r.paths[0].cases[0].result, 'unknown');
});
test('comparison becomes unknown when user evidence does not match updated profile', () => {
  const r = validateAnalysis(
    raw,
    sources,
    validProfile({ question: '在职转行开发', time: '每天八小时' }),
  );
  assert.equal(r.paths[0].cases[0].comparison.status, 'unknown');
});
test('case with invented action evidence is removed', () => {
  const input = structuredClone(raw);
  input.paths[0].cases[0].action.quote = '我编写了五十个项目';
  assert.equal(validateAnalysis(input, sources, profile).paths.length, 0);
});
test('already answered or skipped question is suppressed', () => {
  const input = {
    ...raw,
    questions: [
      { question: '能脱产吗？', sourceId: 'S1', quote: '我脱产每天学习八小时' },
    ],
  };
  assert.equal(
    validateAnalysis(input, sources, { ...profile, skipped: ['能脱产吗？'] })
      .questions.length,
    0,
  );
});
test('malformed model output fails without fabricated fallback', () => {
  assert.throws(() => parseModel('未能分析'));
  assert.deepEqual(parseModel('```json\n{"paths":[]}\n```'), { paths: [] });
});
test('input is bounded', () => {
  assert.throws(() => validProfile({ question: 'a'.repeat(241) }));
});
