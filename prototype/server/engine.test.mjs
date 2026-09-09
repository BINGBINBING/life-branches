import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaryIndex } from './condition-dictionary.mjs';
import {
  aggregate,
  analyze,
  parseModel,
  validateAnalysis,
  validProfile,
  researchQuestions,
} from './engine.mjs';

const profile = validProfile({ question: '在职转行开发', time: '每天两小时' });

test('a title alone cannot validate an action citation', () => {
  const result = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1',
    action: { text: '已经找到工作', quote: '已经找到工作' },
  }] }] }, [{ id: 'S1', title: '已经找到工作', snippets: ['想请教大家如何开始准备'] }], profile);
  assert.equal(result.paths.length, 0);
  assert.equal(result.rejectionReasons.missingActionCitation, 1);
});

test('missing basics generate questions without fabricated evidence', () => {
  const input = { decisionPath: 'campus_transfer', conditionAnswers: { institution_name: '尚未核实' } };
  const questions = researchQuestions([], input);
  assert.deepEqual(questions.map((q) => q.conditionId), ['institution_name', 'current_major', 'target_major']);
  assert.ok(questions.every((q) => q.origin === 'basic' && !q.quote && !q.sourceId));
  const evidence = { conditionId: 'daily_time', question: '每天多久？', quote: '每天两小时', sourceId: 'S1', options: [] };
  const combined = researchQuestions([evidence], input);
  assert.equal(combined.at(-1).origin, 'evidence');
  assert.equal(combined.at(-1).sourceId, 'S1');
  assert.equal(researchQuestions([], { ...input, skipped: questions.map((q) => q.question) }).length, 0);
  assert.equal(researchQuestions([], {
    ...input, conditionAnswers: { institution_name: '示例大学', current_major: '机械', target_major: '中文' },
  }).length, 0);
});

test('profile preserves all dictionary answers and validates entries after twelve', () => {
  const conditionAnswers = Object.fromEntries(
    [...dictionaryIndex.values()]
      .filter((item) => item.nodeType === 'atomic')
      .slice(0, 15)
      .map((item) => [item.id, '用户已确认的条件']),
  );
  assert.equal(Object.keys(conditionAnswers).length, 15);
  assert.deepEqual(validProfile({ question: '想转行做开发', conditionAnswers }).conditionAnswers, conditionAnswers);
  assert.throws(() => validProfile({
    question: '想转行做开发', conditionAnswers: { ...conditionAnswers, invented: '非法字段' },
  }), /条件表单内容无效/);
  const lastId = Object.keys(conditionAnswers).at(-1);
  assert.throws(() => validProfile({
    question: '想转行做开发', conditionAnswers: { ...conditionAnswers, [lastId]: 42 },
  }), /条件表单内容无效/);
  for (const malformed of [[], 'invalid', 42]) {
    assert.throws(() => validProfile({ question: '想转行做开发', conditionAnswers: malformed }), /条件表单内容无效/);
  }
});
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
          conditionEvidence: [
            { conditionId: 'daily_time', quote: '每天学习八小时' },
          ],
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
test('source collection can retain more than the old twelve-source ceiling', () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    Url: `https://www.zhihu.com/question/1/answer/${index + 1}`,
    ContentText: `第${index + 1}条有效材料`,
    Title: `经历${index + 1}`,
  }));
  const result = aggregate([{ query: '理科转文科', data: { Data: { Items: items } } }]);
  assert.equal(result.length, 50);
});
test('all retained sources are passed to analysis', async () => {
  const sources = Array.from({ length: 100 }, (_, index) => ({
    id: `S${index + 1}`,
    title: `来源${index + 1}`,
    author: '作者',
    badge: '',
    snippets: [`第${index + 1}条来源摘要`],
  }));
  let prompt = '';
  await analyze(sources, profile, () => {}, {
    ask: async (value) => {
      prompt = value;
      return {
        value: { paths: [], insights: [], questions: [] },
        metadata: { provider: 'test', model: 'test' },
      };
    },
  });
  assert.match(prompt, /"id":"S1"/);
  assert.match(prompt, /"id":"S100"/);
  assert.match(prompt, /详细案例总共最多8个，每条路径最多2个/);
});
test('local validation enforces the detailed case ceiling', () => {
  const manySources = Array.from({ length: 12 }, (_, index) => ({
    id: `S${index + 1}`,
    title: `来源${index + 1}`,
    snippets: [`我完成了第${index + 1}次具体申请行动`],
  }));
  const manyCases = manySources.map((source) => ({
    sourceId: source.id,
    action: { text: source.snippets[0], quote: source.snippets[0] },
  }));
  const result = validateAnalysis(
    { paths: [{ name: '申请', cases: manyCases }], insights: [], questions: [] },
    manySources,
    profile,
  );
  assert.equal(
    result.paths.reduce((total, path) => total + path.cases.length, 0),
    8,
  );
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
  const r = validateAnalysis(raw, sources, {
    ...profile,
    decisionScope: 'career_transition',
  });
  assert.equal(r.paths[0].cases[0].result, 'unknown');
  assert.equal(r.paths[0].cases[0].comparison.status, 'different');
  assert.equal(r.paths[0].cases[0].conditionComparisons[0].status, 'different');
});
test('invented quote cannot establish outcome', () => {
  const input = structuredClone(raw);
  input.paths[0].cases[0].outcome.quote = '年薪一百万';
  const r = validateAnalysis(input, sources, profile);
  assert.equal(r.paths[0].cases[0].outcome, null);
  assert.equal(r.paths[0].cases[0].result, 'unknown');
});
test('validated stage changes only the stage result', () => {
  const input = structuredClone(raw);
  input.paths[0].cases[0].outcomeStage = {
    stageId: 'joined_target_role',
    quote: '后来找到工作',
  };
  const unverified = validateAnalysis(input, sources, {
    ...profile,
    decisionScope: 'career_transition',
  });
  assert.equal(unverified.paths[0].cases[0].result, 'unknown');

  input.paths[0].cases[0].outcomeStage = {
    stageId: 'joined_target_role',
    quote: '我入职前端开发工程师',
  };
  const matchingSources = [
    {
      ...sources[0],
      snippets: [sources[0].snippets[0] + '我入职前端开发工程师。'],
    },
  ];
  const verified = validateAnalysis(input, matchingSources, {
    ...profile,
    decisionScope: 'career_transition',
  });
  assert.equal(verified.paths[0].cases[0].result, 'success');
  assert.equal(verified.paths[0].cases[0].stage.id, 'joined_target_role');
});
test('comparison is recomputed from updated profile, not model userQuote', () => {
  const r = validateAnalysis(
    raw,
    sources,
    validProfile({ question: '在职转行开发', time: '每天八小时' }),
  );
  assert.equal(r.paths[0].cases[0].comparison.status, 'similar');
});
test('case with invented action evidence is removed', () => {
  const input = structuredClone(raw);
  input.paths[0].cases[0].action.quote = '我编写了五十个项目';
  assert.equal(validateAnalysis(input, sources, profile).paths.length, 0);
});
test('case explicitly describing another academic route is removed', () => {
  const academicSource = {
    id: 'S1',
    title: '辅修计算机的经历',
    snippets: ['我申请了计算机辅修并完成课程。'],
  };
  const input = structuredClone(raw);
  input.paths[0].cases[0].action.quote = '我申请了计算机辅修';
  const result = validateAnalysis(input, [academicSource], {
    ...profile,
    decisionScope: 'major_transition',
    decisionPath: 'campus_transfer',
  });
  assert.deepEqual(result.paths, []);
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
  assert.equal(validProfile({ question: 'a'.repeat(2000) }).question.length, 2000);
  assert.throws(() => validProfile({ question: 'a'.repeat(2001) }));
});
