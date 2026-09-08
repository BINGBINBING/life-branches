import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntakePlan, normalizeIntake } from './intake.mjs';

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
    '我本科毕业，在运营岗工作三年，想转行做产品经理，每天能投入两小时';
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
            quote: '每天能投入两小时',
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
