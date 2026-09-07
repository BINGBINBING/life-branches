import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyCareerMove,
  groupCasesByPath,
  sourceMatchesDecisionPath,
} from './path-policy.mjs';

test('explicitly conflicting academic routes are excluded', () => {
  assert.equal(
    sourceMatchesDecisionPath(
      { title: '辅修计算机经验', snippets: [] },
      'campus_transfer',
    ),
    false,
  );
  assert.equal(
    sourceMatchesDecisionPath(
      { title: '大学转专业经验', snippets: [] },
      'campus_transfer',
    ),
    true,
  );
});

test('each academic route accepts itself and rejects the other explicit routes', () => {
  const fixtures = {
    campus_transfer: '我申请校内转专业并参加考核',
    cross_major_graduate: '我跨专业考研报考计算机研究生',
    minor: '我选择辅修计算机并完成课程',
    second_bachelor: '我申请第二学士学位学习软件工程',
  };
  for (const [selected, title] of Object.entries(fixtures)) {
    assert.equal(sourceMatchesDecisionPath({ title, snippets: [] }, selected), true);
    for (const [other, otherTitle] of Object.entries(fixtures)) {
      if (other !== selected)
        assert.equal(
          sourceMatchesDecisionPath({ title: otherTitle, snippets: [] }, selected),
          false,
        );
    }
  }
});

test('career move separates industry and function changes', () => {
  const base = {
    current_industry: '零售',
    target_industry: '软件',
    current_job_function: '运营',
  };
  assert.equal(
    classifyCareerMove({
      conditionAnswers: { ...base, target_job_function: '运营' },
    }).id,
    'cross_industry_same_function',
  );
  assert.equal(
    classifyCareerMove({
      conditionAnswers: {
        current_industry: '软件',
        target_industry: '软件',
        current_job_function: '运营',
        target_job_function: '开发',
      },
    }).id,
    'same_industry_role_change',
  );
  assert.equal(
    classifyCareerMove({
      conditionAnswers: { ...base, target_job_function: '开发' },
    }).id,
    'cross_industry_role_change',
  );
  assert.equal(
    classifyCareerMove({
      conditionAnswers: {
        current_industry: '互联网公司',
        target_industry: '软件行业',
        current_job_function: '内容运营',
        target_job_function: '增长运营',
      },
    }).id,
    'same_role',
  );
});

test('career cases use stable local action paths', () => {
  const cases = [
    { sourceId: 'S1', action: { quote: '我直接投递了二十份简历' } },
    { sourceId: 'S2', action: { quote: '我参加公司内部竞聘完成内部转岗' } },
    { sourceId: 'S3', action: { quote: '我先从初级助理岗位做起' } },
    { sourceId: 'S4', action: { quote: '我下班后在职学习前端' } },
    { sourceId: 'S5', action: { quote: '我裸辞参加培训' } },
    { sourceId: 'S6', action: { quote: '我先做了一个项目实践验证方向' } },
  ];
  const sources = new Map(
    cases.map((item) => [item.sourceId, { title: '', snippets: [] }]),
  );
  assert.deepEqual(
    groupCasesByPath(
      cases,
      { decisionScope: 'career_transition' },
      sources,
    ).map((path) => path.id),
    [
      'direct_application',
      'internal_transfer',
      'adjacent_role',
      'employed_preparation',
      'fulltime_preparation',
      'project_trial',
    ],
  );
});
