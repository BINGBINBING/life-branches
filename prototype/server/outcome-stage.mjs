export const OUTCOME_STAGES = Object.freeze({
  major_transition: [
    {
      id: 'application_eligible',
      label: '获得申请资格',
      result: 'success',
      pattern:
        /(?:符合|获得|取得).{0,8}(?:转专业)?(?:申请|报名)资格|(?:转专业).{0,8}(?:符合|获得|取得).{0,4}资格/,
    },
    {
      id: 'assessment_passed',
      label: '通过转专业考核',
      result: 'success',
      pattern:
        /(?:通过|过了).{0,6}转专业(?:考核|笔试|面试)|转专业(?:考核|笔试|面试).{0,6}(?:通过|过了)/,
    },
    {
      id: 'transfer_approved',
      label: '转专业获批',
      result: 'success',
      pattern:
        /(?:转专业|转入)(?:申请)?(?:最终|最后|顺利|已经)?(?:获批|成功|通过|公示通过)/,
    },
    {
      id: 'transfer_completed',
      label: '已转入目标专业',
      result: 'success',
      pattern:
        /(?:已经|最后|后来|成功)?.{0,6}(?:转入|转到|转去).{1,16}(?:专业|学院)/,
    },
    {
      id: 'application_ineligible',
      label: '不符合申请资格',
      result: 'setback',
      pattern: /(?:不符合|没有|不具备|失去).{0,8}(?:申请|报名|转专业)资格/,
    },
    {
      id: 'assessment_failed',
      label: '未通过转专业考核',
      result: 'setback',
      pattern: /(?:没过|未通过|失败|被刷).{0,10}(?:转专业)?(?:考核|笔试|面试)/,
    },
    {
      id: 'transfer_rejected',
      label: '转专业未获批',
      result: 'setback',
      pattern: /(?:转专业|转入).{0,10}(?:被拒|未通过|没成功|失败)/,
    },
  ],
  career_transition: [
    {
      id: 'interview_obtained',
      label: '获得目标岗位面试',
      result: 'success',
      pattern:
        /(?:获得|收到|拿到|有了).{0,8}(?:目标|转行|对口)?.{0,8}面试(?:邀请|机会|通知)?/,
    },
    {
      id: 'offer_received',
      label: '获得目标岗位录用',
      result: 'success',
      pattern: /(?:拿到|获得|收到).{0,12}(?:offer|录用通知)/i,
    },
    {
      id: 'joined_target_role',
      label: '已入职目标岗位',
      result: 'success',
      pattern:
        /(?:入职|进入|转到|成为).{1,18}(?:开发|设计|会计|销售|教师|运营|工程师|目标岗位)/,
    },
    {
      id: 'probation_passed',
      label: '通过目标岗位试用期',
      result: 'success',
      pattern: /(?:通过|顺利度过|转正).{0,8}试用期|试用期.{0,8}(?:通过|转正)/,
    },
    {
      id: 'interview_rejected',
      label: '目标岗位面试未通过',
      result: 'setback',
      pattern: /(?:面试|面了).{0,10}(?:没过|未通过|被拒|被刷|失败)/,
    },
    {
      id: 'no_offer_after_search',
      label: '求职后仍未获得录用',
      result: 'setback',
      pattern:
        /(?:投递|找工作|求职|面试).{0,24}(?:没有|没能|未能|没).{0,10}(?:offer|录用|入职|工作)/i,
    },
  ],
});

export function stageCatalogue(scope) {
  return (OUTCOME_STAGES[scope] || []).map(({ id, label, result }) => ({
    id,
    label,
    result,
  }));
}

export function validateOutcomeStage(source, raw, scope, validQuote) {
  if (!raw || typeof raw !== 'object') return null;
  const stage = (OUTCOME_STAGES[scope] || []).find(
    (item) => item.id === raw.stageId,
  );
  if (!stage) return null;
  const quote = validQuote(source, raw.quote);
  const downstreamMajorResult =
    stage.id === 'transfer_approved' &&
    /(?:转专业|转入).{0,12}(?:毕业|就业|入职|大厂|offer).{0,12}(?:成功|通过|获批)/i.test(quote);
  const learningOnly =
    stage.id === 'joined_target_role' &&
    /(?:学习|课程|培训|项目)/.test(quote) &&
    !/(?:入职|任职|工作|岗位|转岗|成为.{0,8}工程师)/.test(quote);
  if (
    !quote ||
    (stage.result === 'success' && /未通过|没通过|没有|没能|未能|不符合|不具备|未获批|未入职|未转入/.test(quote)) ||
    downstreamMajorResult ||
    learningOnly ||
    /(?:想|希望|计划|准备|目标|如何|怎么|如果|为了).{0,12}(?:入职|进入|转入|转到|获得|通过|拿到)/.test(
      quote,
    ) ||
    !/(?:我|本人|自己|最终|最后|后来|已经|成功|未能|没能|被拒|被刷)/.test(
      quote,
    ) ||
    !stage.pattern.test(quote)
  )
    return null;
  return {
    id: stage.id,
    label: stage.label,
    result: stage.result,
    quote,
    scopeNote: stageScopeNote(stage, scope),
  };
}

const stagePriority = [
  'probation_passed',
  'joined_target_role',
  'offer_received',
  'interview_obtained',
  'transfer_completed',
  'transfer_approved',
  'assessment_passed',
  'application_eligible',
  'no_offer_after_search',
  'interview_rejected',
  'transfer_rejected',
  'assessment_failed',
  'application_ineligible',
];

function stageScopeNote(stage, scope) {
  if (stage.result === 'setback')
    return scope === 'major_transition'
      ? '只证明本次申请或考核受挫，不证明其他申请机会或替代路径不可行。'
      : '只证明本次求职阶段受挫，不证明整个转行选择失败。';
  if (scope === 'major_transition') {
    if (stage.id === 'transfer_completed')
      return '只证明已转入目标专业，不证明后续适应、毕业或就业结果。';
    return '只证明已到达该申请阶段，不证明已转入、后续适应、毕业或就业成功。';
  }
  if (stage.id === 'probation_passed')
    return '只证明已通过试用期，不证明长期适配、收入增长或职业发展结果。';
  if (stage.id === 'joined_target_role')
    return '只证明已入职目标岗位，不证明已通过试用期或长期适配。';
  return '只证明已到达该求职阶段，不证明已入职、通过试用期或长期适配。';
}

export function discoverOutcomeStage(source, scope, validQuote) {
  const clauses = [source.title, ...(source.snippets || [])]
    .flatMap((text) => String(text || '').split(/[，。；！!？?\n]/))
    .map((text) => text.trim())
    .filter((text) => text.length >= 5 && text.length <= 700);
  const found = [];
  for (const stage of OUTCOME_STAGES[scope] || []) {
    for (const quote of clauses) {
      if (!stage.pattern.test(quote)) continue;
      const validated = validateOutcomeStage(source, { stageId: stage.id, quote }, scope, validQuote);
      if (validated) found.push({ stage, validated });
    }
  }
  found.sort(
    (a, b) =>
      stagePriority.indexOf(a.stage.id) - stagePriority.indexOf(b.stage.id),
  );
  const match = found[0];
  return match?.validated || null;
}
