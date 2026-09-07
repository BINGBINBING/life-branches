import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfficialAssessment } from './official-assessment.mjs';

test('official eligibility is compared only with same-field user values', () => {
  const result = buildOfficialAssessment(
    [
      {
        id: 'O1',
        text: '申请人绩点不低于3.5。申请人不得有挂科。接收名额20人。考核采用笔试和面试。',
      },
    ],
    { conditionAnswers: { gpa_value: '3.2', failed_course_count: '0门' } },
  );
  assert.deepEqual(
    result.checks.map((item) => [item.id, item.status]),
    [
      ['gpa_value', 'not_satisfied'],
      ['failed_course_count', 'satisfied'],
      ['incoming_quota', 'confirmed'],
      ['assessment_subjects', 'confirmed'],
    ],
  );
});

test('cost facts remain confirmed or missing without invented amounts', () => {
  const result = buildOfficialAssessment(
    [{ id: 'O1', text: '转入后需要补修12学分，可能延期毕业。' }],
    { conditionAnswers: {} },
  );
  assert.equal(
    result.checks.find((item) => item.id === 'makeup_credits').officialValue,
    '12 学分',
  );
  assert.ok(result.checks.some((item) => item.id === 'graduation_delay'));
  assert.ok(result.missing.some((item) => item.id === 'extra_tuition'));
  assert.deepEqual(result.estimates, []);
});

test('official transfer permissions and downstream costs stay separate', () => {
  const result = buildOfficialAssessment(
    [
      {
        id: 'O1',
        text: '申请须经所在学院审核同意。拟转入专业负责接收审核。转专业可能影响推免资格。补修课程冲突由学生自行协调。',
      },
    ],
    { conditionAnswers: {} },
  );
  assert.ok(result.checks.some((item) => item.id === 'outgoing_permission'));
  assert.ok(result.checks.some((item) => item.id === 'incoming_permission'));
  assert.ok(result.checks.some((item) => item.id === 'recommendation_eligibility'));
  assert.ok(result.checks.some((item) => item.id === 'course_conflicts'));
});

test('application deadline is assessed against the current date', () => {
  const source = [{ id: 'O1', text: '申请截止2026年9月20日。' }];
  const open = buildOfficialAssessment(source, { conditionAnswers: {} }, {
    now: new Date('2026-09-07T12:00:00+08:00'),
  });
  const closed = buildOfficialAssessment(source, { conditionAnswers: {} }, {
    now: new Date('2026-09-21T00:00:00+08:00'),
  });
  assert.equal(open.checks[0].status, 'satisfied');
  assert.equal(closed.checks[0].status, 'not_satisfied');
  assert.equal(open.checks[0].officialValue, '2026-09-20');
});

test('non-numeric application and study costs remain confirmed facts', () => {
  const result = buildOfficialAssessment(
    [
      {
        id: 'O2',
        text: '第三学期开学后第一周内提出转专业申请。学生从转入的学年起按转入专业学费标准缴纳学费。转入专业没有学习过的课程必须补修。',
      },
    ],
    { conditionAnswers: {} },
  );
  assert.deepEqual(
    Object.fromEntries(result.checks.map((item) => [item.id, item.status])),
    {
      application_window: 'confirmed',
      tuition_standard: 'confirmed',
      makeup_requirement: 'confirmed',
    },
  );
  assert.ok(result.missing.some((item) => item.id === 'makeup_credits'));
  assert.ok(result.missing.some((item) => item.id === 'extra_tuition'));
  assert.deepEqual(result.estimates, []);
});
