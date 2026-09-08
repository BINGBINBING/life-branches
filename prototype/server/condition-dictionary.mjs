// Stable semantic dimensions for one decision. They are not keyword lists:
// an LLM may propose a code, but policy decides whether it can be asked.
import {
  expandedConditions,
  expansionSources,
} from './condition-expansion.mjs';

export const CONDITION_DICTIONARY_VERSION = '0.2.1';
export const CONDITION_ANSWER_TYPES = [
  'text',
  'boolean',
  'single_choice',
  'multi_select',
  'date',
  'integer',
  'number',
  'duration',
  'amount',
  'range',
  'url',
];

const atomicLegacyIds = new Set([
  'daily_time',
  'policy_verified',
  'transfer_restriction',
  'portfolio_or_work_sample',
  'income_continuity',
  'entry_level_acceptance',
]);

const condition = (id, scope, group, label, question, policy, evidence) => ({
  id,
  scope,
  group,
  label,
  question,
  policy,
  nodeType: atomicLegacyIds.has(id) ? 'atomic' : 'legacy_dimension',
  origin: 'legacy_candidate',
  evidence: [],
  evidenceLinks: [],
  legacyDiscoveryRefs: evidence,
  paths: ['any'],
  sectors: ['any'],
});

const source = (id, title, url, kind, note) => ({
  id,
  title,
  url,
  kind,
  note,
  limitation:
    '来自知乎搜索摘要；仅作为条件发现线索，不是学校政策或结果的普遍证明。',
});

export const discoverySources = [
  ...expansionSources,
  source(
    'MP1',
    '东华理工大学转专业经验帖',
    'https://zhuanlan.zhihu.com/p/700148376',
    '个人经验',
    '提及政策变动、单科门槛、跨大类限制与证书要求。',
  ),
  source(
    'MP2',
    '北邮转专业指南2024版',
    'https://zhuanlan.zhihu.com/p/16322036094',
    '经验指南',
    '提及成绩排名、考核构成、信息来源与面试准备。',
  ),
  source(
    'MP3',
    '大学里想转专业，应该如何评估利弊和自身情况？',
    'https://www.zhihu.com/question/2046910255771168812/answer/2047261655223080242',
    '观点回答',
    '提及培养方案、课程适应、补修和替代路径。',
  ),
  source(
    'MP4',
    '转专业失败两次如何调整？',
    'https://www.zhihu.com/question/2057849327641536196/answer/2059993401462887540',
    '个人观点',
    '提及补修、降级、绩点与推免节奏。',
  ),
  source(
    'CP1',
    '非计算机专业学生怎么走上计算机技术之路？',
    'https://www.zhihu.com/question/21671705/answer/132737688',
    '个人经验',
    '提及兴趣、自学能力与学习路径。',
  ),
  source(
    'CP2',
    '有没有工作了很多年之后，跨领域转型成功的，可以分享一下心路历程么？',
    'https://www.zhihu.com/question/638706900/answer/3356068193',
    '个人经验',
    '提及英语、自学能力、可迁移业务理解和作品展示。',
  ),
  source(
    'CP3',
    '学习方法回顾--为什么我转行那么难',
    'https://zhuanlan.zhihu.com/p/687314413',
    '个人复盘',
    '提及理论、代码/实操、项目经验和面试机会。',
  ),
  source(
    'CP4',
    '裸辞6个月，我又开始找工作了',
    'https://zhuanlan.zhihu.com/p/11884131484',
    '个人记录',
    '提及空窗期、现金流和培训筛选体验。',
  ),
];

// policy: active means the product may ask it now. source_required means a
// dynamic question needs a matching case quote. No condition may be inferred.
const guarded = {
  active: false,
  source_required: true,
  user_unknown: true,
  max_questions: 1,
};
const contextOnly = {
  active: false,
  source_required: false,
  user_unknown: true,
  context_only: true,
};

export const conditions = [
  ...expandedConditions,
  condition(
    'daily_time',
    ['career_transition', 'major_transition'],
    '时间与节奏',
    '稳定投入时间',
    '你每天可以明确投入多少小时？',
    { ...guarded, active: true, answer_type: 'duration' },
    ['MP1', 'CP4'],
  ),
  condition(
    'decision_deadline',
    ['career_transition', 'major_transition'],
    '时间与节奏',
    '决策或申请截止节点',
    '你最晚需要在什么时候完成这一步？',
    guarded,
    ['MP1', 'MP2'],
  ),
  condition(
    'current_stage',
    ['major_transition'],
    '当前学籍',
    '当前学段与年级',
    '你目前处于哪个学段和年级？',
    { ...guarded, answer_type: 'single_choice' },
    ['MP1', 'MP2'],
  ),
  condition(
    'institution_and_program',
    ['major_transition'],
    '当前学籍',
    '学校、现专业与目标专业',
    '你的学校、现专业和目标专业分别是什么？',
    { ...guarded, answer_type: 'text' },
    ['MP1', 'MP2'],
  ),
  condition(
    'policy_verified',
    ['major_transition'],
    '校规与资格',
    '是否已核对本年度校规',
    '你是否已找到本年度的校内转专业通知？',
    { ...guarded, answer_type: 'single_choice' },
    ['MP1', 'MP2'],
  ),
  condition(
    'application_window',
    ['major_transition'],
    '校规与资格',
    '申请窗口与机会次数',
    '你所在学校的申请窗口和可申请次数是什么？',
    contextOnly,
    ['MP1', 'MP2'],
  ),
  condition(
    'gpa_or_rank',
    ['major_transition'],
    '校规与资格',
    '成绩或排名资格',
    '你的当前绩点或排名是否达到目标专业的本校门槛？',
    { ...guarded, answer_type: 'single_choice' },
    ['MP1', 'MP2'],
  ),
  condition(
    'failed_courses',
    ['major_transition'],
    '校规与资格',
    '挂科与学籍限制',
    '目前是否有会影响申请资格的挂科或学籍限制？',
    guarded,
    ['MP1', 'MP2'],
  ),
  condition(
    'subject_requirements',
    ['major_transition'],
    '校规与资格',
    '单科与先修要求',
    '目标专业是否要求特定单科、课程或证明？你目前满足了吗？',
    { ...guarded, answer_type: 'text' },
    ['MP1', 'MP2'],
  ),
  condition(
    'transfer_restriction',
    ['major_transition'],
    '校规与资格',
    '跨学院或学科限制',
    '校规是否允许你从当前专业转入目标专业？',
    { ...guarded, answer_type: 'single_choice' },
    ['MP1', 'MP2'],
  ),
  condition(
    'capacity_and_competition',
    ['major_transition'],
    '校规与资格',
    '接收名额与竞争',
    '你是否已查到本年度接收名额或往年竞争情况？',
    contextOnly,
    ['MP1', 'MP2'],
  ),
  condition(
    'assessment_format',
    ['major_transition'],
    '准备与适应',
    '笔试、面试或材料考核',
    '目标专业需要哪些考核形式？',
    { ...guarded, answer_type: 'multi_select' },
    ['MP1', 'MP2'],
  ),
  condition(
    'target_curriculum_exposure',
    ['major_transition'],
    '准备与适应',
    '对目标课程的实际了解',
    '你是否看过培养方案或接触过目标专业的核心课程？',
    guarded,
    ['MP3'],
  ),
  condition(
    'prerequisite_foundation',
    ['major_transition'],
    '准备与适应',
    '目标专业先修基础',
    '目标专业需要的先修基础中，你已具备哪些？',
    {
      ...guarded,
      answer_type: 'text',
      never_infer_from: ['专业名称', '学历', '年龄'],
    },
    ['MP1', 'MP3'],
  ),
  condition(
    'credit_recognition',
    ['major_transition'],
    '转入后影响',
    '学分认定',
    '转入后哪些已修课程可被认定为有效学分？',
    contextOnly,
    ['MP3', 'MP4'],
  ),
  condition(
    'makeup_course_load',
    ['major_transition'],
    '转入后影响',
    '补修课程负担',
    '转入后预计需要补修哪些课程、多少学分？',
    { ...guarded, answer_type: 'text' },
    ['MP3', 'MP4'],
  ),
  condition(
    'extended_study_acceptance',
    ['major_transition'],
    '转入后影响',
    '延长学制的可接受度',
    '如需延长学制或降级，你能接受吗？',
    guarded,
    ['MP3', 'MP4'],
  ),
  condition(
    'graduate_path_impact',
    ['major_transition'],
    '转入后影响',
    '推免或读研路径影响',
    '转专业会如何影响你计划中的推免、读研或就业节奏？',
    contextOnly,
    ['MP4'],
  ),
  condition(
    'fallback_academic_path',
    ['major_transition'],
    '备选路径',
    '未转成时的替代路径',
    '若本次未能转入，你愿意考虑哪些替代路径？',
    guarded,
    ['MP3'],
  ),

  condition(
    'current_role_context',
    ['career_transition'],
    '职业起点',
    '现行业、岗位与工作年限',
    '你现在所在行业、岗位和工作年限是什么？',
    { ...guarded, answer_type: 'text' },
    ['CP2'],
  ),
  condition(
    'target_role_definition',
    ['career_transition'],
    '职业目标',
    '目标行业与岗位',
    '你希望转入的具体行业和岗位是什么？',
    { ...guarded, answer_type: 'text' },
    ['CP1', 'CP2'],
  ),
  condition(
    'transition_motivation',
    ['career_transition'],
    '职业目标',
    '转行动因',
    '你想离开的主要是当前岗位、当前行业，还是工作方式？',
    guarded,
    ['CP1'],
  ),
  condition(
    'transferable_skills',
    ['career_transition'],
    '职业起点',
    '可迁移技能与经验',
    '你现有经历中哪些能力可直接迁移到目标岗位？',
    { ...guarded, answer_type: 'text' },
    ['CP2'],
  ),
  condition(
    'target_skill_gap',
    ['career_transition'],
    '能力准备',
    '目标岗位技能缺口',
    '与目标岗位要求相比，你认为当前最大的技能缺口是什么？',
    { ...guarded, answer_type: 'text' },
    ['CP2', 'CP3'],
  ),
  condition(
    'portfolio_or_work_sample',
    ['career_transition'],
    '能力准备',
    '可展示作品或案例',
    '你是否已有可展示的项目、作品或相关案例？',
    { ...guarded, answer_type: 'single_choice' },
    ['CP2', 'CP3'],
  ),
  condition(
    'learning_path',
    ['career_transition'],
    '能力准备',
    '学习方式',
    '你计划通过自学、在岗实践、导师带领还是培训来补齐能力？',
    guarded,
    ['CP1', 'CP2'],
  ),
  condition(
    'feedback_access',
    ['career_transition'],
    '能力准备',
    '反馈与指导资源',
    '是否有人或渠道能给你的作品、学习和求职准备提供反馈？',
    guarded,
    ['CP1'],
  ),
  condition(
    'income_continuity',
    ['career_transition'],
    '资源与约束',
    '是否可中断收入',
    '在转行准备期，你是否需要保持稳定收入？',
    { ...guarded, answer_type: 'single_choice' },
    ['CP4'],
  ),
  condition(
    'financial_runway',
    ['career_transition'],
    '资源与约束',
    '可承受的空窗或学习成本',
    '若收入变化，你能承受多长时间的生活与学习成本？',
    { ...guarded, answer_type: 'range', sensitive: true },
    ['CP4'],
  ),
  condition(
    'location_constraint',
    ['career_transition'],
    '资源与约束',
    '地域与搬迁限制',
    '目标岗位的城市或是否可搬迁，有哪些限制？',
    guarded,
    ['CP2'],
  ),
  condition(
    'compensation_floor',
    ['career_transition'],
    '资源与约束',
    '可接受的收入下限',
    '过渡期可接受的最低收入或工作条件是什么？',
    { ...guarded, answer_type: 'text', sensitive: true },
    ['CP4'],
  ),
  condition(
    'job_market_check',
    ['career_transition'],
    '求职验证',
    '目标岗位实际要求',
    '你是否已查看目标岗位的招聘要求并记录共性？',
    { ...guarded, answer_type: 'single_choice' },
    ['CP1'],
  ),
  condition(
    'application_and_interview_evidence',
    ['career_transition'],
    '求职验证',
    '投递与面试反馈',
    '你是否已有投递、面试或行业人士反馈？',
    guarded,
    ['CP3'],
  ),
  condition(
    'entry_level_acceptance',
    ['career_transition'],
    '求职验证',
    '从初级岗位或过渡岗位开始的接受度',
    '你是否接受先从初级或过渡岗位开始？',
    { ...guarded, answer_type: 'single_choice' },
    ['CP4'],
  ),
  condition(
    'fallback_career_path',
    ['career_transition'],
    '备选路径',
    '低风险替代路径',
    '若暂不直接转入目标行业，你愿意考虑哪些能力平移或过渡路径？',
    guarded,
    ['CP1', 'CP2'],
  ),
];

export const dictionaryIndex = new Map(
  conditions.map((item) => [item.id, item]),
);

export function activeConditions(scope) {
  return conditions.filter(
    (item) => item.scope.includes(scope) && item.policy.active,
  );
}

// Scope selection is explicit; unknown scope never returns all questions.
export function candidateConditions({ scope, path, sector } = {}) {
  if (!['major_transition', 'career_transition'].includes(scope)) return [];
  return conditions.filter(
    (item) =>
      item.nodeType === 'atomic' &&
      item.scope.includes(scope) &&
      (item.paths.includes('any') || (path && item.paths.includes(path))) &&
      (item.sectors.includes('any') ||
        (sector && item.sectors.includes(sector))),
  );
}
