import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIntakePlan,
  createLocalIntakePlan,
  normalizeIntake,
} from './intake.mjs';

test('pre-search intake stays inside the supported decision scopes', () => {
  assert.equal(normalizeIntake('想出国读硕士').supported, false);
  assert.equal(
    normalizeIntake('想从工科转到设计专业').scope,
    'major_transition',
  );
  assert.equal(
    normalizeIntake('本科计算机，想跨专业考心理学研究生').path,
    'cross_major_graduate',
  );
});

test('pre-search intake accepts a detailed description up to 2000 characters', async () => {
  const question = `想转行做开发。${'补充背景。'.repeat(500)}`.slice(0, 2000);
  const plan = await createIntakePlan(question, {
    ask: async () => ({
      scope: 'career_transition',
      path: 'career_change',
      sector: 'software',
      fieldIds: ['target_job_function'],
    }),
  });
  assert.equal(plan.supported, true);
  await assert.rejects(() =>
    createIntakePlan(`${question}超`, { ask: async () => ({}) }),
  );
});

test('AI may select dictionary ids but cannot invent form fields', async () => {
  const plan = await createIntakePlan('非科班，在职，想转行做开发', {
    ask: async () => ({
      value: {
        scope: 'career_transition',
        path: 'career_change',
        sector: 'software',
        fieldIds: [
          'coding_debugging',
          'invented_condition',
          'target_job_function',
        ],
      },
      metadata: { provider: 'mock' },
    }),
  });
  assert.equal(plan.supported, true);
  assert.equal(plan.generatedBy, 'mock');
  assert.ok(plan.fields.some((field) => field.id === 'coding_debugging'));
  assert.ok(plan.fields.some((field) => field.id === 'daily_time'));
  assert.ok(plan.fields.some((field) => field.id === 'relevant_tenure'));
  assert.ok(!plan.fields.some((field) => field.id === 'invented_condition'));
  assert.ok(plan.fields.length >= 4 && plan.fields.length <= 6);
});

test('local intake fallback keeps the pre-search form usable when AI fails', async () => {
  const plan = await createIntakePlan(
    '我从机械专业转到计算机专业，每天能投入两小时',
    {
      ask: async () => {
        throw new Error('provider unavailable');
      },
    },
  );
  assert.equal(plan.supported, true);
  assert.equal(plan.scope, 'major_transition');
  assert.equal(plan.path, 'campus_transfer');
  assert.equal(plan.generatedBy, 'local-fallback');
  assert.ok(plan.fields.length >= 4);
  assert.equal(
    plan.fields.find((field) => field.id === 'current_major')?.initialValue,
    '机械',
  );
});

test('selected fields are filtered by route and sector', () => {
  const plan = normalizeIntake('想转行做开发', {
    scope: 'career_transition',
    path: 'career_change',
    sector: 'software',
    fieldIds: ['software_collaboration', 'sales_payment_terms'],
  });
  assert.ok(plan.fields.some((field) => field.id === 'software_collaboration'));
  assert.ok(!plan.fields.some((field) => field.id === 'sales_payment_terms'));
});

test('intake fields carry dictionary choice labels to the frontend', () => {
  const plan = normalizeIntake('我想转行做开发', {
    scope: 'career_transition',
    path: 'career_change',
    sector: 'software',
    fieldIds: ['income_continuity'],
  });
  const field = plan.fields.find((item) => item.id === 'income_continuity');
  assert.equal(field.answerType, 'single_choice');
  assert.ok(field.options.some((option) => option.label === '需要保持稳定收入'));
});

test('decision route correction rebuilds the field catalogue locally', () => {
  const graduate = createLocalIntakePlan(
    '本科计算机，正在考虑之后的专业选择',
    'cross_major_graduate',
  );
  assert.equal(graduate.scope, 'major_transition');
  assert.equal(graduate.path, 'cross_major_graduate');
  assert.equal(graduate.generatedBy, 'local-route-change');
  assert.ok(
    graduate.fields.some(
      (field) => field.id === 'graduate_admission_eligibility',
    ),
  );
  const career = createLocalIntakePlan(
    '本科计算机，想做软件开发',
    'career_change',
  );
  assert.equal(career.scope, 'career_transition');
  assert.equal(career.path, 'career_change');
  assert.ok(career.fields.some((field) => field.id === 'target_job_function'));
  assert.throws(() => createLocalIntakePlan('我想做选择', 'invented'));
  assert.throws(() =>
    createLocalIntakePlan(`我想转专业${'x'.repeat(2000)}`, 'campus_transfer'),
  );
});

test('target sector wins over the current job named earlier in the question', () => {
  const plan = normalizeIntake('从运营转行做前端开发', {
    scope: 'career_transition',
    sector: 'operations',
    fieldIds: ['software_collaboration', 'operations_metrics'],
  });
  assert.equal(plan.sector, 'software');
  assert.ok(plan.fields.some((field) => field.id === 'software_collaboration'));
  assert.ok(!plan.fields.some((field) => field.id === 'operations_metrics'));
});

test('academic year is prefilled without inventing a semester', () => {
  const plan = normalizeIntake('我现在大一，想校内转专业', {
    scope: 'major_transition',
    path: 'campus_transfer',
  });
  const fields = new Map(plan.fields.map((field) => [field.id, field]));
  assert.equal(fields.get('current_stage').initialValue, '大一');
  assert.equal(fields.get('current_term')?.initialValue || '', '');
});

test('initial description only prefills locally validated values', () => {
  const plan = normalizeIntake(
    '我现在从机械专业转到计算机专业，每天可以投入2小时，绩点3.6',
    { scope: 'major_transition', path: 'campus_transfer', fieldIds: [] },
  );
  const fields = new Map(plan.fields.map((field) => [field.id, field]));
  assert.equal(fields.get('current_major').initialValue, '机械');
  assert.equal(fields.get('target_major').initialValue, '计算机');
  assert.equal(fields.get('gpa_value').initialValue, '3.6');
  assert.equal(fields.get('daily_time').initialValue, '2小时/天');
  assert.equal(fields.get('daily_time').initialQuote, '每天可以投入2小时');
  assert.match(
    fields.get('current_major').initialQuote,
    /机械专业转到计算机专业/,
  );
});

test('current education is not inferred from a target job requirement', () => {
  const ambiguous = normalizeIntake('我想转行，目标岗位要求本科学历', {
    scope: 'career_transition',
    sector: 'software',
    fieldIds: ['current_education'],
  });
  assert.equal(
    ambiguous.fields.find((field) => field.id === 'current_education')
      ?.initialValue,
    undefined,
  );
  const explicit = normalizeIntake('我是大专学历，想转行做开发', {
    scope: 'career_transition',
    sector: 'software',
    fieldIds: [],
  });
  assert.equal(
    explicit.fields.find((field) => field.id === 'current_education')
      ?.initialValue,
    '大专',
  );
});

test('AI extraction prefills only dictionary conditions with exact user quotes', async () => {
  const question =
    '我本科毕业，在运营岗工作三年，想转行做产品经理，每天能投入2小时';
  const plan = await createIntakePlan(question, {
    ask: async () => ({
      value: {
        scope: 'career_transition',
        path: 'career_change',
        sector: 'operations',
        fieldIds: ['current_education', 'current_job_function', 'daily_time'],
        extracted: [
          {
            conditionId: 'current_education',
            value: '本科',
            quote: '我本科毕业',
          },
          {
            conditionId: 'current_job_function',
            value: '运营',
            quote: '在运营岗工作三年',
          },
          {
            conditionId: 'invented_condition',
            value: '虚构值',
            quote: '想转行做产品经理',
          },
          {
            conditionId: 'daily_time',
            value: '8小时/天',
            quote: '原文里不存在的片段',
          },
          {
            conditionId: 'weekly_hours',
            value: '14小时/周',
            quote: '每天能投入2小时',
          },
          {
            conditionId: 'weekly_hours',
            value: '2小时',
            quote: '每天能投入2小时',
          },
        ],
      },
      metadata: { provider: 'mock' },
    }),
  });
  const fields = new Map(plan.fields.map((field) => [field.id, field]));
  assert.equal(fields.get('current_education')?.initialValue, '本科');
  assert.equal(fields.get('current_job_function')?.initialValue, '运营');
  assert.equal(fields.get('daily_time')?.initialValue, '2小时/天');
  assert.equal(fields.get('weekly_hours')?.initialValue, undefined);
  assert.ok(!fields.has('invented_condition'));
});

test('AI cannot write an explicit weekly duration into the daily field', async () => {
  const plan = await createIntakePlan('我想转行，每周能投入14小时', {
    ask: async () => ({
      value: {
        scope: 'career_transition',
        path: 'career_change',
        fieldIds: ['daily_time', 'weekly_hours'],
        extracted: [
          {
            conditionId: 'daily_time',
            value: '14小时',
            quote: '每周能投入14小时',
          },
          {
            conditionId: 'weekly_hours',
            value: '14小时',
            quote: '每周能投入14小时',
          },
        ],
      },
      metadata: { provider: 'mock' },
    }),
  });
  const fields = new Map(plan.fields.map((field) => [field.id, field]));
  assert.equal(fields.get('daily_time')?.initialValue, undefined);
  assert.equal(fields.get('weekly_hours')?.initialValue, '14小时/周');
});

test('validated known conditions do not consume the six-question allowance', () => {
  const facts = [
    ['current_education', '本科'],
    ['current_job_function', '运营'],
    ['target_industry', '软件'],
    ['target_job_function', '前端'],
    ['job_region', '上海'],
    ['relevant_tenure', '3年'],
    ['portfolio_or_work_sample', '已有作品'],
    ['entry_level_acceptance', '接受'],
  ];
  const question = `我是${facts.map(([, value]) => value).join('，')}，想转行`;
  const plan = normalizeIntake(question, {
    scope: 'career_transition',
    path: 'career_change',
    sector: 'software',
    extracted: facts.map(([conditionId, value]) => ({
      conditionId,
      value,
      quote: conditionId === 'current_education' ? `我是${value}` : value,
    })),
  });
  const known = plan.fields.filter((field) => field.initialValue);
  const unanswered = plan.fields.filter((field) => !field.initialValue);
  assert.equal(known.length, facts.length);
  assert.ok(unanswered.length <= 6);
  assert.ok(plan.fields.length > 6);
});

test('verbatim AI candidates still need the meaning of the destination field', () => {
  const cases = [
    ['我在职，想转行做开发', 'current_job_function', '在职', '我在职'],
    ['我想转行，目标岗位要求本科', 'current_education', '本科', '目标岗位要求本科'],
    ['我计划读本科，想转行', 'current_education', '本科', '我计划读本科'],
    ['我朋友是本科，想转行', 'current_education', '本科', '我朋友是本科'],
    ['我大一，想校内转专业', 'current_term', '大一', '我大一'],
    ['我想校内转专业，绩点排名前15%', 'gpa_value', '15', '绩点排名前15%'],
    ['我想转行，当前岗位未知', 'current_job_function', '未知', '当前岗位未知'],
  ];
  for (const [question, conditionId, value, quote] of cases) {
    const plan = normalizeIntake(question, {
      fieldIds: [conditionId],
      extracted: [{ conditionId, value, quote }],
    });
    assert.equal(plan.fields.find((field) => field.id === conditionId)?.initialValue,
      undefined, `${conditionId}: ${question}`);
  }
});

test('explicit personal education and separate academic facts remain prefilled', () => {
  const question = '我本科毕业，想校内转专业，现在第2学期，GPA3.6';
  const plan = normalizeIntake(question, {
    extracted: [
      { conditionId: 'current_term', value: '2学期', quote: '现在第2学期' },
      { conditionId: 'gpa_value', value: '3.6', quote: 'GPA3.6' },
    ],
  });
  assert.equal(plan.fields.find((field) => field.id === 'current_term')?.initialValue, '2学期');
  assert.equal(plan.fields.find((field) => field.id === 'gpa_value')?.initialValue, '3.6');
  const career = normalizeIntake('我本科毕业，想转行做开发', {
    extracted: [{ conditionId: 'current_education', value: '本科', quote: '我本科毕业' }],
  });
  assert.equal(career.fields.find((field) => field.id === 'current_education')?.initialValue, '本科');
});

test('rejected AI candidates do not hide a valid fact after position twelve', () => {
  const plan = normalizeIntake('我在职，本科毕业，想转行做开发', {
    extracted: [
      ...Array.from({ length: 12 }, () => ({
        conditionId: 'current_job_function', value: '在职', quote: '我在职',
      })),
      { conditionId: 'target_job_function', value: '开发', quote: '想转行做开发' },
    ],
  });
  assert.equal(plan.fields.find((field) => field.id === 'target_job_function')?.initialValue, '开发');
});

test('local and AI prefills reject third-party and requirement context', () => {
  for (const [question, conditionId, value, quote] of [
    ['我想转行，朋友每天学习8小时', 'daily_time', '8小时', '每天学习8小时'],
    ['我想转专业，同学现在大二', 'current_stage', '大二', '大二'],
    ['我想转专业，学校要求GPA3.6', 'gpa_value', '3.6', 'GPA3.6'],
    ['我想转行，同事目前做运营', 'current_job_function', '运营', '运营'],
    ['我想转行，如果每天学习8小时', 'daily_time', '8小时', '每天学习8小时'],
  ]) {
    const plan = normalizeIntake(question, { fieldIds: [conditionId], extracted: [{ conditionId, value, quote }] });
    assert.equal(plan.fields.find((field) => field.id === conditionId)?.initialValue, undefined, question);
  }
  const personal = normalizeIntake('我想转行，朋友每天学习8小时，我每天学习2小时');
  assert.equal(personal.fields.find((field) => field.id === 'daily_time')?.initialValue, '2小时/天');
  const conflicting = normalizeIntake('我想转行，每天学习2小时，每天学习8小时');
  assert.equal(conflicting.fields.find((field) => field.id === 'daily_time')?.initialValue, undefined);
});

test('conflicting extracted values stay unanswered instead of last-value-wins', () => {
  const plan = normalizeIntake('我做运营，也做销售，想转行开发', { extracted: [
    { conditionId: 'current_job_function', value: '运营', quote: '我做运营' },
    { conditionId: 'current_job_function', value: '销售', quote: '也做销售' },
    { conditionId: 'current_job_function', value: '运营', quote: '我做运营' },
  ] });
  assert.equal(plan.fields.find((field) => field.id === 'current_job_function')?.initialValue, undefined);
  for (const [question, conditionId, value, quote] of [
    ['我想转行，过去做运营', 'current_job_function', '运营', '运营'],
    ['我想转行，不考虑销售', 'target_job_function', '销售', '销售'],
    ['我想转专业，以前大一', 'current_stage', '大一', '大一'],
  ]) {
    const result = normalizeIntake(question, { extracted: [{ conditionId, value, quote }], fieldIds: [conditionId] });
    assert.equal(result.fields.find((field) => field.id === conditionId)?.initialValue, undefined, question);
  }
});

test('model suggestions cannot displace core questions before the first search', () => {
  const plan = normalizeIntake('我现在做运营，想转行软件开发。朋友每天学习8小时，我每天只能投入2小时。', {
    scope: 'career_transition', fieldIds: ['weekly_hours', 'transferable_tools', 'coding_debugging', 'job_region', 'trial_completed', 'income_gap_months'],
    extracted: [{ conditionId: 'target_industry', value: '软件开发', quote: '想转行软件开发' }],
  });
  assert.ok(plan.fields.some((field) => field.id === 'current_job_function'));
  assert.ok(plan.fields.some((field) => field.id === 'target_job_function'));
  assert.ok(plan.fields.filter((field) => !field.initialValue).length <= 6);
});

test('local fallback recognizes explicit transfer destinations and current education', () => {
  for (const verb of ['转入', '转成', '转到']) {
    const plan = normalizeIntake(`我想从机械专业${verb}计算机专业`);
    assert.equal(plan.supported, true);
    assert.equal(plan.scope, 'major_transition');
    assert.equal(plan.path, 'campus_transfer');
    assert.equal(plan.fields.find((field) => field.id === 'current_major')?.initialValue, '机械');
    assert.equal(plan.fields.find((field) => field.id === 'target_major')?.initialValue, '计算机');
  }
  const plan = normalizeIntake('我想转行，目标岗位要求本科，我目前是大专学历');
  assert.equal(plan.fields.find((field) => field.id === 'current_education')?.initialValue, '大专');
  for (const question of ['我想转行，朋友目前是大专学历', '我想转行，我计划成为本科毕业生']) {
    assert.equal(normalizeIntake(question).fields.find((field) => field.id === 'current_education')?.initialValue, undefined);
  }
});
