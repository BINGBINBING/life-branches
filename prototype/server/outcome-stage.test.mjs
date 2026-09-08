import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoverOutcomeStage,
  stageCatalogue,
  validateOutcomeStage,
} from './outcome-stage.mjs';

const validQuote = (source, quote) =>
  source.snippets.some((text) => text.includes(quote)) ? quote : '';

test('stage catalogues separate major and career milestones', () => {
  const major = stageCatalogue('major_transition').map((item) => item.id);
  const career = stageCatalogue('career_transition').map((item) => item.id);
  assert.ok(major.includes('transfer_approved'));
  assert.ok(!major.includes('offer_received'));
  assert.ok(career.includes('offer_received'));
});

test('career offer requires a matching stage and continuous source quote', () => {
  const source = {
    snippets: ['三个月后我拿到了前端开发offer，随后入职。'],
  };
  const stage = validateOutcomeStage(
    source,
    { stageId: 'offer_received', quote: '我拿到了前端开发offer' },
    'career_transition',
    validQuote,
  );
  assert.equal(stage.result, 'success');
  assert.equal(stage.label, '获得目标岗位录用');
  assert.equal(
    validateOutcomeStage(
      source,
      { stageId: 'offer_received', quote: '我完成了一个项目' },
      'career_transition',
      validQuote,
    ),
    null,
  );
});

test('major rejection cannot be relabeled as career failure', () => {
  const source = { snippets: ['转专业申请最后未通过。'] };
  assert.equal(
    validateOutcomeStage(
      source,
      { stageId: 'transfer_rejected', quote: '转专业申请最后未通过' },
      'major_transition',
      validQuote,
    ).result,
    'setback',
  );
  assert.equal(
    validateOutcomeStage(
      source,
      { stageId: 'no_offer_after_search', quote: '转专业申请最后未通过' },
      'major_transition',
      validQuote,
    ),
    null,
  );
});

test('local discovery finds the furthest explicit stage without model fields', () => {
  const source = {
    title: '转行记录',
    snippets: ['我先收到了前端开发面试通知，后来拿到前端offer。'],
  };
  const stage = discoverOutcomeStage(source, 'career_transition', validQuote);
  assert.equal(stage.id, 'offer_received');
});

test('intentions and generic advice are not treated as completed stages', () => {
  const source = {
    title: '转行计划',
    snippets: ['我想进入前端开发行业，建议先准备作品集。'],
  };
  assert.equal(
    discoverOutcomeStage(source, 'career_transition', validQuote),
    null,
  );
});

test('downstream graduation or employment cannot prove transfer approval', () => {
  const source = {
    snippets: ['我转专业后毕业成功进入大厂，但没写当年申请结果。'],
  };
  assert.equal(
    validateOutcomeStage(
      source,
      {
        stageId: 'transfer_approved',
        quote: '我转专业后毕业成功进入大厂',
      },
      'major_transition',
      validQuote,
    ),
    null,
  );
  assert.equal(discoverOutcomeStage(source, 'major_transition', validQuote), null);
});

test('each stage requires its own event wording', () => {
  const major = { snippets: ['我通过了某公司面试。'] };
  assert.equal(
    validateOutcomeStage(
      major,
      { stageId: 'assessment_passed', quote: '我通过了某公司面试' },
      'major_transition',
      validQuote,
    ),
    null,
  );
  const career = { snippets: ['我进入前端开发课程学习。'] };
  assert.equal(
    validateOutcomeStage(
      career,
      { stageId: 'joined_target_role', quote: '我进入前端开发课程学习' },
      'career_transition',
      validQuote,
    ),
    null,
  );
});

test('explicit approval wording still proves only the approval stage', () => {
  const source = { snippets: ['我的转专业申请最终获批。'] };
  const stage = validateOutcomeStage(
    source,
    { stageId: 'transfer_approved', quote: '我的转专业申请最终获批' },
    'major_transition',
    validQuote,
  );
  assert.equal(stage.id, 'transfer_approved');
  assert.equal(stage.quote, '我的转专业申请最终获批');
});
