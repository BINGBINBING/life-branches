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
  rematchAnalysis,
} from './engine.mjs';

const profile = validProfile({ question: '在职转行开发', time: '每天两小时' });

test('a title alone cannot validate an action citation', () => {
  const result = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1',
    action: { text: '已经找到工作', quote: '已经找到工作' },
  }] }] }, [{ id: 'S1', title: '已经找到工作', snippets: ['想请教大家如何开始准备'] }], profile);
  assert.equal(result.paths.length, 0);
  assert.equal(result.rejectionReasons.missingActionCitation, 1);
  assert.deepEqual(result.sourceDispositions, [{ sourceId: 'S1', accepted: false, reason: '行动引文未通过片段校验' }]);
});

test('null model entries do not discard valid cases', () => {
  const source = { id: 'S1', title: '经历', snippets: ['我完成了学习项目'] };
  const result = validateAnalysis({ paths: [null, { cases: [null, { sourceId: 'S1', action: { text: source.snippets[0], quote: source.snippets[0] } }] }], insights: [null] }, [source], profile);
  assert.equal(result.paths[0].cases.length, 1);
  assert.equal(result.rejectionReasons.invalidInsightCitation, 1);
});

test('unselected sources keep an explicit unknown reason rather than invented rejection', () => {
  const result = validateAnalysis({ paths: [] }, [{ id: 'S1', title: '经历', snippets: ['我做了项目'] }], profile);
  assert.equal(result.sourceDispositions[0].accepted, false);
  assert.match(result.sourceDispositions[0].reason, /未入选详细分析/);
  assert.match(result.sourceDispositions[0].reason, /尚未核实/);
});

test('quoted attitude is not promoted into an observable action', () => {
  const quote = '我做了重要决定，从未后悔';
  const result = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1', action: { text: '做出决定', quote } }] }] },
    [{ id: 'S1', title: '转行经历', snippets: [quote] }], profile);
  assert.equal(result.paths.length, 0);
  assert.equal(result.rejectionReasons.unverifiedAction, 1);
  assert.equal(result.insights.length, 0);
});

test('an attempted written assessment remains a case when its outcome is failure', () => {
  const quote = '我参加了转专业笔试';
  const result = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1', action: { text: quote, quote } }] }] },
    [{ id: 'S1', title: '虚构转专业案例', snippets: [`${quote}，我未通过转专业考核。`] }],
    { ...profile, decisionScope: 'major_transition', decisionPath: 'campus_transfer' });
  assert.equal(result.paths[0].cases[0].result, 'setback');
  assert.equal(result.paths[0].cases[0].stage.id, 'assessment_failed');
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

test('rematching recalculates readiness when required conditions are cleared', () => {
  const previous = validateAnalysis(raw, sources, profile);
  const ready = rematchAnalysis(previous, sources, { ...profile, decisionPath: 'career_change', conditionAnswers: { current_job_function: '运营', target_job_function: '开发' } });
  assert.equal(ready.researchMode, 'personalized');
  const incomplete = rematchAnalysis(ready, sources, { ...profile, decisionPath: 'career_change', conditionAnswers: { current_job_function: '尚未核实' } });
  assert.equal(incomplete.researchMode, 'general');
  assert.ok(incomplete.insights.every((item) => /通用/.test(item.applicability)));
  assert.ok(incomplete.missingRequired.includes('current_job_function'));
});

test('rematching updates source dispositions and removes insights for excluded routes', () => {
  const source = { id: 'S1', title: '校内转专业', snippets: ['我提交了转专业申请材料'] };
  const input = { ...profile, decisionScope: 'major_transition', decisionPath: 'campus_transfer' };
  const previous = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1', action: { text: source.snippets[0], quote: source.snippets[0] } }] }] }, [source], input);
  assert.equal(previous.sourceDispositions[0].accepted, true);
  const changed = rematchAnalysis(previous, [source], { ...input, decisionPath: 'cross_major_graduate' });
  assert.equal(changed.paths.length, 0);
  assert.equal(changed.insights.length, 0);
  assert.deepEqual(changed.sourceDispositions, [{ sourceId: 'S1', accepted: false, reason: '与当前选择路径不符' }]);
});

test('rematching does not retain a milestone from another decision scope', () => {
  const source = { id: 'S1', title: '学习经历', snippets: ['我完成了学习项目', '我最后收到开发岗位录用通知'] };
  const previous = validateAnalysis({ paths: [{ cases: [{ sourceId: 'S1', action: { text: source.snippets[0], quote: source.snippets[0] } }] }] }, [source], { ...profile, decisionScope: 'career_transition' });
  assert.equal(previous.paths[0].cases[0].stage.id, 'offer_received');
  const changed = rematchAnalysis(previous, [source], { ...profile, decisionScope: 'major_transition' });
  assert.equal(changed.paths[0].cases[0].stage, null);
  assert.equal(changed.paths[0].cases[0].result, 'unknown');
  assert.match(changed.paths[0].cases[0].outcomeVerification, /尚未核实/);
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

test('multi-round followup answers and skips survive beyond twelve entries', () => {
  const answers = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`问题${i}`, `答案${i}`]));
  const skipped = Array.from({ length: 18 }, (_, i) => `跳过${i}`);
  const result = validProfile({ question: '转行开发', answers, skipped: [...skipped, skipped[0]] });
  assert.deepEqual(result.answers, answers);
  assert.deepEqual(result.skipped, skipped);
  assert.throws(() => validProfile({ question: '转行开发', answers: { ...answers, invalid: 1 } }));
  assert.throws(() => validProfile({ question: '转行开发', skipped: [...skipped, 1] }));
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
  assert.match(prompt, /title仅用于定位主题，不能作为事实证据/);
  assert.match(prompt, /excerpts是搜索摘要而非全文/);
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
