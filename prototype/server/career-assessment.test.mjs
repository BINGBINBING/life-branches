import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachCareerCosts,
  buildJobRequirementAssessment,
} from './career-assessment.mjs';

test('job requirements preserve explicit sample metadata and missing fields', () => {
  const result = buildJobRequirementAssessment({
    conditionAnswers: {
      job_posting_text:
        '本科及以上，3年以上开发经验，熟悉TypeScript和React，有项目经验。',
      current_education: '大专',
      relevant_tenure: '1年',
    },
  });
  assert.equal(result.sampleCount, 1);
  assert.deepEqual(
    result.requirements.map((item) => item.id),
    ['education', 'tenure', 'portfolio', 'skills'],
  );
  assert.ok(result.missing.includes('岗位地区'));
  assert.equal(result.requirements[0].status, 'gap');
});

test('multiple job samples are aggregated without inventing metadata', () => {
  const result = buildJobRequirementAssessment({
    conditionAnswers: {
      job_posting_text:
        '本科及以上，2年开发经验，熟悉React。\n---\n大专及以上，1年开发经验，熟悉TypeScript。',
      current_education: '本科',
      relevant_tenure: '1.5年',
      target_job_function: '前端开发',
      job_region: '上海',
      job_requirement_date: '2026-09-01',
      transferable_tools: 'React',
    },
  });
  assert.equal(result.sampleCount, 2);
  assert.equal(result.role, '前端开发');
  assert.equal(result.region, '上海');
  assert.equal(result.requirements.find((item) => item.id === 'education').status, 'met');
  assert.equal(result.requirements.find((item) => item.id === 'tenure').status, 'mixed');
  assert.equal(result.requirements.find((item) => item.id === 'skills').status, 'mixed');
  assert.doesNotMatch(
    result.requirements.find((item) => item.id === 'skills').value,
    /Java（/,
  );
});

test('fulltime path conflicts with a hard income continuity constraint', () => {
  const [path] = attachCareerCosts(
    [{ id: 'fulltime_preparation', name: '脱产准备', cases: [] }],
    {
      decisionScope: 'career_transition',
      conditionAnswers: { income_continuity: '是', daily_time: '2小时' },
    },
  );
  assert.equal(path.costAssessment.conflicts.length, 1);
  assert.ok(path.costAssessment.known.includes('可投入时间：2小时'));
  assert.ok(path.costAssessment.missing.includes('固定薪资下限'));
});

test('path-specific hard constraints are reported separately', () => {
  const paths = attachCareerCosts(
    [
      { id: 'direct_application', name: '直接投递', cases: [] },
      { id: 'adjacent_role', name: '相邻岗位过渡', cases: [] },
    ],
    {
      decisionScope: 'career_transition',
      conditionAnswers: {
        portfolio_or_work_sample: '否',
        entry_level_acceptance: '不接受',
      },
    },
  );
  assert.equal(paths[0].costAssessment.conflicts.length, 1);
  assert.equal(paths[1].costAssessment.conflicts.length, 1);
});

test('all six controlled career paths receive a bounded cost checklist', () => {
  const ids = [
    'direct_application',
    'internal_transfer',
    'adjacent_role',
    'employed_preparation',
    'fulltime_preparation',
    'project_trial',
  ];
  const paths = attachCareerCosts(
    ids.map((id) => ({ id, name: id, cases: [] })),
    {
      decisionScope: 'career_transition',
      conditionAnswers: { daily_time: '2小时' },
    },
  );
  assert.equal(paths.length, 6);
  for (const path of paths) {
    assert.deepEqual(path.costAssessment.known, ['可投入时间：2小时']);
    assert.equal(path.costAssessment.conflicts.length, 0);
    assert.deepEqual(path.costAssessment.missing, [
      '可承受收入空窗',
      '固定薪资下限',
      '培训费用上限',
    ]);
  }
});
