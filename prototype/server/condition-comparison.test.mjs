import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPARABLE_CONDITIONS,
  compareConditionEvidence,
  questionsFromComparisons,
} from './condition-comparison.mjs';

const validQuote = (source, quote) =>
  source.snippets.some((text) => text.includes(quote)) ? quote : '';

test('each decision scope exposes numeric and categorical conditions', () => {
  assert.equal(COMPARABLE_CONDITIONS.major_transition.length, 9);
  assert.equal(COMPARABLE_CONDITIONS.career_transition.length, 10);
});

test('career boolean conditions produce grounded comparisons and questions', () => {
  const source = {
    snippets: ['我选择裸辞学习，后来做了一个可展示项目。'],
  };
  const result = compareConditionEvidence(
    source,
    [],
    {
      decisionScope: 'career_transition',
      conditionAnswers: { income_continuity: '是' },
      skipped: [],
    },
    validQuote,
  );
  assert.deepEqual(
    result.map((item) => [item.conditionId, item.status]),
    [
      ['portfolio_or_work_sample', 'unknown'],
      ['income_continuity', 'different'],
    ],
  );
  const questions = questionsFromComparisons(
    [{ cases: [{ sourceId: 'S1', conditionComparisons: result }] }],
    { conditionAnswers: { income_continuity: '是' }, skipped: [] },
  );
  assert.equal(questions[0].conditionId, 'portfolio_or_work_sample');
  assert.deepEqual(questions[0].options, ['是', '否', '尚未核实']);
});

test('major policy and deadline require explicit source wording', () => {
  const source = {
    snippets: [
      '我已经核对学校官网通知，学校允许跨学院转专业，申请截止2026年9月20日。',
    ],
  };
  const result = compareConditionEvidence(
    source,
    [],
    {
      decisionScope: 'major_transition',
      conditionAnswers: {
        policy_verified: '是',
        transfer_restriction: '不允许',
        application_deadline: '2026-09-20',
      },
    },
    validQuote,
  );
  assert.deepEqual(
    result.map((item) => [item.conditionId, item.status]),
    [
      ['application_deadline', 'similar'],
      ['transfer_restriction', 'different'],
      ['policy_verified', 'similar'],
    ],
  );
});

test('major conditions compare exact values and preserve source quotes', () => {
  const source = {
    snippets: ['我当时是第4学期，绩点3.7，没有挂科，转入后待补12学分。'],
  };
  const profile = {
    decisionScope: 'major_transition',
    conditionAnswers: {
      current_term: '第4学期',
      gpa_value: '3.2',
      failed_course_count: '0门',
      makeup_credits: '8学分',
    },
  };
  const result = compareConditionEvidence(
    source,
    [
      { conditionId: 'current_term', quote: '我当时是第4学期' },
      { conditionId: 'gpa_value', quote: '绩点3.7' },
      { conditionId: 'failed_course_count', quote: '没有挂科' },
      { conditionId: 'makeup_credits', quote: '转入后待补12学分' },
    ],
    profile,
    validQuote,
  );
  assert.deepEqual(
    result.map((item) => item.status),
    ['similar', 'different', 'similar', 'different'],
  );
  assert.equal(result[1].quote, '绩点3.7');
  assert.equal(result[1].userQuote, '3.2');
});

test('local discovery works when the model omits condition evidence', () => {
  const source = {
    title: '转行经历',
    snippets: ['我每天学习2小时，前后投递40份简历。'],
  };
  const result = compareConditionEvidence(
    source,
    [],
    {
      decisionScope: 'career_transition',
      conditionAnswers: { daily_time: '每天2小时' },
    },
    validQuote,
  );
  assert.deepEqual(
    result.map((item) => [item.conditionId, item.status]),
    [
      ['daily_time', 'similar'],
      ['application_count', 'unknown'],
    ],
  );
});

test('career comparison marks missing user values unknown', () => {
  const source = {
    snippets: ['我有3年开发经验，投递50份简历，获得4次面试。'],
  };
  const result = compareConditionEvidence(
    source,
    [
      { conditionId: 'relevant_tenure', quote: '我有3年开发经验' },
      { conditionId: 'application_count', quote: '投递50份简历' },
      { conditionId: 'interview_count', quote: '获得4次面试' },
      { conditionId: 'invented_condition', quote: '投递50份简历' },
      { conditionId: 'application_count', quote: '投递500份简历' },
    ],
    {
      decisionScope: 'career_transition',
      conditionAnswers: { relevant_tenure: '1年', application_count: '50份' },
    },
    validQuote,
  );
  assert.deepEqual(
    result.map((item) => [item.conditionId, item.status]),
    [
      ['relevant_tenure', 'different'],
      ['application_count', 'similar'],
      ['interview_count', 'unknown'],
    ],
  );
  const questions = questionsFromComparisons(
    [{ cases: [{ sourceId: 'S1', conditionComparisons: result }] }],
    {
      conditionAnswers: { relevant_tenure: '1年', application_count: '50份' },
      skipped: [],
    },
  );
  assert.equal(questions.length, 1);
  assert.equal(questions[0].conditionId, 'interview_count');
  assert.equal(questions[0].quote, '获得4次面试');
});

test('career education is compared only when both sides state a level', () => {
  const source = {
    id: 'S1',
    title: '转行经历',
    snippets: ['目标岗位要求本科，我是大专学历，后来补充了项目经历。'],
  };
  const quote = source.snippets[0];
  const comparisons = compareConditionEvidence(
    source,
    [{ conditionId: 'current_education', quote }],
    {
      decisionScope: 'career_transition',
      conditionAnswers: { current_education: '本科' },
    },
    (_source, value) => value,
  );
  assert.equal(comparisons[0].caseValue, '本科');
  assert.equal(comparisons[0].userValue, '本科');
  assert.equal(comparisons[0].status, 'similar');
});

test('answered and skipped condition questions are not repeated', () => {
  const paths = [
    {
      cases: [
        {
          sourceId: 'S1',
          conditionComparisons: [
            {
              conditionId: 'interview_count',
              needsUserInput: true,
              quote: '获得4次面试',
            },
          ],
        },
      ],
    },
  ];
  assert.equal(
    questionsFromComparisons(paths, {
      conditionAnswers: { interview_count: '2次' },
      skipped: [],
    }).length,
    0,
  );
  assert.equal(
    questionsFromComparisons(paths, {
      conditionAnswers: {},
      skipped: ['这些投递获得了多少次面试邀约？'],
    }).length,
    0,
  );
});

test('dynamic questions cover the six high-value acceptance categories', () => {
  const categories = [
    ['portfolio_or_work_sample', '作者做了一个可展示作品'],
    ['income_continuity', '作者选择裸辞后脱产准备'],
    ['current_education', '目标岗位要求本科'],
    ['gpa_value', '申请要求绩点不低于3.5'],
    ['application_deadline', '申请截止2026年9月20日'],
    ['makeup_credits', '转入后需要补修12学分'],
  ];
  for (const [conditionId, quote] of categories) {
    const questions = questionsFromComparisons(
      [
        {
          cases: [
            {
              sourceId: 'S1',
              conditionComparisons: [
                { conditionId, needsUserInput: true, quote },
              ],
            },
          ],
        },
      ],
      { conditionAnswers: {}, skipped: [] },
    );
    assert.equal(questions.length, 1, conditionId);
    assert.equal(questions[0].conditionId, conditionId);
    assert.equal(questions[0].quote, quote);
  }
});

test('each core direction can produce at least six grounded field comparisons', () => {
  const fixtures = [
    {
      scope: 'major_transition',
      source: {
        title: '校内转专业经历',
        snippets: [
          '我当时是第4学期，绩点3.7，没有挂科，转入后待补12学分。',
          '申请截止2026年9月20日，学校允许跨学院转专业，我已经核对学校官网通知。',
        ],
      },
      answers: {
        current_term: '第4学期',
        gpa_value: '3.2',
        failed_course_count: '0门',
        makeup_credits: '8学分',
        application_deadline: '2026-09-20',
        transfer_restriction: '允许',
        policy_verified: '是',
      },
    },
    {
      scope: 'career_transition',
      source: {
        title: '转行开发经历',
        snippets: [
          '我每天学习8小时，有本科学历，有3年开发经验，投递50份简历。',
          '获得4次面试，我选择裸辞学习，后来做了一个可展示项目。',
        ],
      },
      answers: {
        daily_time: '每天2小时',
        current_education: '大专',
        relevant_tenure: '1年',
        application_count: '20份',
        interview_count: '2次',
        income_continuity: '是',
        portfolio_or_work_sample: '否',
      },
    },
  ];
  for (const fixture of fixtures) {
    const comparisons = compareConditionEvidence(
      fixture.source,
      [],
      {
        decisionScope: fixture.scope,
        conditionAnswers: fixture.answers,
      },
      (source, quote) =>
        source.snippets.some((text) => text.includes(quote)) ? quote : '',
    );
    assert.ok(comparisons.length >= 6, fixture.scope);
    assert.ok(comparisons.every((item) => item.quote && item.userQuote));
    assert.ok(comparisons.some((item) => item.status === 'different'));
  }
});
