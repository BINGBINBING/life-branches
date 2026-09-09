const majorRoutes = {
  campus_transfer: { label: '校内转专业', pattern: /转专业|转入|转出|跨学院/ },
  cross_major_graduate: {
    label: '跨专业读研',
    pattern: /跨考|跨专业.{0,8}(?:考研|读研|研究生)/,
  },
  minor: { label: '辅修', pattern: /辅修/ },
  second_bachelor: { label: '第二学士学位', pattern: /二学位|第二学士/ },
};

const careerPaths = [
  {
    id: 'internal_transfer',
    label: '内部转岗',
    pattern: /内部转岗|内部竞聘|公司内部.{0,6}转|(?:申请|参加)轮岗/,
  },
  {
    id: 'fulltime_preparation',
    label: '脱产准备',
    pattern: /裸辞|脱产|辞职后|离职后/,
  },
  {
    id: 'employed_preparation',
    label: '在职准备',
    pattern: /在职|边工作边|下班后|业余时间/,
  },
  {
    id: 'adjacent_role',
    label: '相邻岗位过渡',
    pattern: /相邻岗位|过渡岗位|先(?:做|从).{0,8}(?:助理|初级)|先从(?:助理|初级)/,
  },
  {
    id: 'project_trial',
    label: '小项目验证',
    pattern: /作品集|做了?.{0,8}项目|项目实践|副业验证/,
  },
  {
    id: 'direct_application',
    label: '直接投递',
    pattern: /直接投递|海投|投递.{0,8}简历|开始求职/,
  },
];

const majorActions = [
  { id: 'eligibility_preparation', label: '成绩与资格核对', pattern: /(?:核对|查阅|咨询|提高|重修).{0,12}(?:资格|政策|绩点|成绩|排名)/ },
  { id: 'prerequisite_study', label: '先修补齐', pattern: /(?:修读|补修|自学|旁听|学完|完成).{0,12}(?:课程|先修|基础|学分)/ },
  { id: 'assessment_preparation', label: '考核准备', pattern: /(?:准备|练习|参加|复习).{0,12}(?:面试|笔试|考核|考试)/ },
  { id: 'application_materials', label: '申请材料准备', pattern: /(?:整理|提交|撰写|准备).{0,12}(?:材料|申请书|个人陈述|作品集)/ },
  { id: 'post_transfer_adaptation', label: '转入后适应', pattern: /(?:转入后|转专业后).{0,16}(?:补课|调整|适应|跟上|选课)/ },
  { id: 'alternative_plan', label: '调整替代方案', pattern: /(?:改为|改选|转而|重新选择).{0,12}(?:辅修|考研|原专业|第二学士|二学位)/ },
];

function matchingActions(catalogue, quote) {
  const sentences = String(quote || '').split(/[。！？；\n]/).filter((sentence) =>
    !/尚未|没有|没能|未曾|不打算|计划|打算|建议|应该|可以考虑/.test(sentence));
  return catalogue.filter((candidate) => sentences.some((sentence) => candidate.pattern.test(sentence)));
}

function sourceText(source, action = '') {
  return [source?.title, ...(source?.snippets || []), action]
    .filter(Boolean)
    .join('\n');
}

const industryAliases = [
  ['software', /软件|互联网|IT|信息技术|科技/iu],
  ['retail', /零售|商超|门店/],
  ['finance', /金融|银行|证券|保险/],
  ['education', /教育|学校|培训/],
  ['manufacturing', /制造|工厂|工业/],
  ['healthcare', /医疗|医药|健康/],
];
const functionAliases = [
  ['engineering', /开发|程序|前端|后端|工程师|编程/],
  ['operations', /运营|增长|投放|内容运营/],
  ['sales', /销售|商务|客户经理/],
  ['design', /设计|UI|UX|交互/iu],
  ['finance', /会计|财务|审计/],
  ['product', /产品经理|产品运营/],
  ['teaching', /教师|老师|讲师|教学/],
];

function canonical(value, aliases) {
  const text = String(value || '').trim();
  return aliases.find(([, pattern]) => pattern.test(text))?.[0] || text;
}

export function sourceMatchesDecisionPath(source, decisionPath) {
  const selected = majorRoutes[decisionPath];
  if (!selected) return true;
  const text = sourceText(source);
  if (selected.pattern.test(text)) return true;
  return !Object.entries(majorRoutes).some(
    ([id, route]) => id !== decisionPath && route.pattern.test(text),
  );
}

export function isReverseCareerCase(source, actionQuote, profile) {
  if (profile.decisionScope !== 'career_transition' || !actionQuote) return false;
  const current = canonical(profile.conditionAnswers?.current_job_function, functionAliases);
  const target = canonical(profile.conditionAnswers?.target_job_function, functionAliases);
  if (!current || !target || current === target) return false;
  for (const snippet of source.snippets || []) {
    const position = snippet.indexOf(actionQuote);
    if (position < 0) continue;
    // Stay near this action and inside its Markdown case section, not other stories.
    const headings = [...snippet.matchAll(/^#{1,6}\s.+$/gm)];
    const previous = headings.filter((match) => match.index <= position).at(-1)?.index ?? 0;
    const next = headings.find((match) => match.index > position)?.index ?? snippet.length;
    const context = snippet.slice(Math.max(previous, position - 500), Math.min(next, position + actionQuote.length + 180));
    const transitions = [...context.matchAll(/从([^，。；：:\n]{1,24}?)(?:转岗到|转行到|转行做|转向|转为|到)([^，。；：:\n（）]{1,24})/g)]
      .filter((match) => !/不|没|如果|假设|建议/.test(context.slice(Math.max(0, match.index - 12), match.index)));
    const directions = transitions.map((match) => [canonical(match[1], functionAliases), canonical(match[2], functionAliases)]);
    if (directions.some(([from, to]) => from === current && to === target)) continue;
    if (directions.some(([from, to]) => from === target && to === current)) return true;
  }
  return false;
}

export function classifyCareerMove(profile) {
  const answers = profile.conditionAnswers || {};
  const currentIndustry = answers.current_industry?.trim();
  const targetIndustry = answers.target_industry?.trim();
  const currentFunction = answers.current_job_function?.trim();
  const targetFunction = answers.target_job_function?.trim();
  if (
    !currentIndustry ||
    !targetIndustry ||
    !currentFunction ||
    !targetFunction
  )
    return { id: 'unknown', label: '行业与职能变化待确认' };
  const industryChanged =
    canonical(currentIndustry, industryAliases) !==
    canonical(targetIndustry, industryAliases);
  const functionChanged =
    canonical(currentFunction, functionAliases) !==
    canonical(targetFunction, functionAliases);
  if (!industryChanged && functionChanged)
    return { id: 'same_industry_role_change', label: '同行业转岗' };
  if (industryChanged && !functionChanged)
    return { id: 'cross_industry_same_function', label: '跨行业同职能' };
  if (industryChanged && functionChanged)
    return { id: 'cross_industry_role_change', label: '行业与职能同时变化' };
  return { id: 'same_role', label: '行业与职能均未变化' };
}

export function groupCasesByPath(cases, profile) {
  const groups = new Map();
  for (const item of cases) {
    const matches = matchingActions(profile.decisionScope === 'major_transition' ? majorActions : careerPaths, item.action?.quote);
    let path;
    if (profile.decisionScope === 'major_transition') {
      path = matches[0] || {
        id: 'action_unknown', label: '行动方式待确认',
      };
    } else {
      path = matches[0] || {
        id: 'preparation_mode_unknown',
        label: '准备方式待确认',
      };
    }
    if (!groups.has(path.id))
      groups.set(path.id, { id: path.id, name: path.label,
        decisionRoute: profile.decisionPath || '', actionBranch: path.id, cases: [] });
    groups.get(path.id).cases.push({ ...item,
      actionTags: matches.map(({ id, label }) => ({ id, label, quote: item.action.quote })),
    });
  }
  return [...groups.values()].slice(0, 7);
}

export function decisionPathTerm(profile) {
  if (profile.decisionScope === 'major_transition')
    return (majorRoutes[profile.decisionPath] || majorRoutes.campus_transfer)
      .label;
  const terms = {
    same_industry_role_change: '同行业转岗',
    cross_industry_same_function: '跨行业 同岗位 转行',
    cross_industry_role_change: '转行 转岗',
    same_role: '换工作',
    unknown: '转行 转岗',
  };
  return terms[classifyCareerMove(profile).id];
}
