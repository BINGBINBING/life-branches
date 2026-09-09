import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyCareerMove,
  isReverseCareerCase,
  groupCasesByPath,
  sourceMatchesDecisionPath,
} from './path-policy.mjs';

test('reverse career direction is checked near the selected action, not another story', () => {
  const profile = { decisionScope: 'career_transition', conditionAnswers: { current_job_function: '运营', target_job_function: '软件开发' } };
  const action = '我开始学习产品运营知识';
  assert.equal(isReverseCareerCase({ snippets: [`从程序员到产品运营\n${action}`] }, action, profile), true);
  assert.equal(isReverseCareerCase({ snippets: [`从运营转向软件开发\n我完成了开发项目`] }, '我完成了开发项目', profile), false);
  assert.equal(isReverseCareerCase({ snippets: [`### 案例一：从程序员到产品运营\n${action}\n### 案例二：从运营到开发\n我完成了开发项目`] }, '我完成了开发项目', profile), false);
  assert.equal(isReverseCareerCase({ title: '从程序员到运营', snippets: [action] }, action, profile), false);
  assert.equal(isReverseCareerCase({ snippets: [action] }, action, profile), false);
  assert.equal(isReverseCareerCase({ snippets: [`我不是从程序员到产品运营\n${action}`] }, action, profile), false);
});

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

test('one academic decision route can contain multiple evidence-based action branches', () => {
  const cases = [
    { sourceId: 'S1', action: { quote: '我补修了三门先修课程' } },
    { sourceId: 'S2', action: { quote: '我参加了转专业面试' } },
    { sourceId: 'S3', action: { quote: '我做了一个决定' } },
  ];
  const paths = groupCasesByPath(cases, { decisionScope: 'major_transition', decisionPath: 'campus_transfer' }, new Map());
  assert.deepEqual(paths.map((p) => p.actionBranch), ['prerequisite_study', 'assessment_preparation', 'action_unknown']);
  assert.ok(paths.every((p) => p.decisionRoute === 'campus_transfer'));
  assert.equal(paths.flatMap((p) => p.cases).length, 3);
});

test('academic action catalogue covers eligibility, adaptation and fallback without intent-only grouping', () => {
  const quotes = ['我查阅了转专业资格政策', '我转入后调整了选课安排', '我改为辅修中文', '我计划准备转专业面试', '我没有准备面试'];
  const paths = groupCasesByPath(quotes.map((quote, i) => ({ sourceId: `S${i}`, action: { quote } })),
    { decisionScope: 'major_transition', decisionPath: 'campus_transfer' }, new Map());
  assert.deepEqual(paths.map((p) => p.id), ['eligibility_preparation', 'post_transfer_adaptation', 'alternative_plan', 'action_unknown']);
  assert.equal(paths.at(-1).cases.length, 2);
});

test('a multi-action case appears once and retains secondary evidence tags', () => {
  const item = { sourceId: 'S1', action: { quote: '我补修了基础课程。参加了转专业面试。提交了申请材料。' } };
  const paths = groupCasesByPath([item], { decisionScope: 'major_transition', decisionPath: 'campus_transfer' });
  assert.equal(paths.length, 1);
  assert.equal(paths[0].cases.length, 1);
  assert.equal(paths[0].cases[0].actionTags.length, 3);
  assert.ok(paths[0].cases[0].actionTags.every((tag) => tag.quote === item.action.quote));
  assert.equal(item.actionTags, undefined);
});
