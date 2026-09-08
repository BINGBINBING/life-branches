function clauses(text) {
  return String(text || '')
    .split(/[。；！!？?\n]/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 5 && value.length <= 500);
}

function numberAnswer(value) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

const rules = [
  {
    id: 'application_deadline',
    label: '申请截止日期',
    group: 'eligibility',
    match:
      /(?:截止|截至|申请时间)[^，]{0,16}?(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})日?/,
    official: (match) =>
      `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`,
    assess: (official, _answer, now) => {
      const deadline = new Date(`${official}T23:59:59+08:00`).getTime();
      if (!Number.isFinite(deadline)) return 'unknown';
      return now.getTime() <= deadline ? 'satisfied' : 'not_satisfied';
    },
  },
  {
    id: 'application_window',
    label: '申请时间窗口',
    group: 'eligibility',
    match:
      /[^，]{0,24}(?:第三学期开学后第一周|开学后第一周)[^，]{0,30}(?:申请|提出|提交)[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'gpa_value',
    label: '绩点门槛',
    group: 'eligibility',
    match: /(?:绩点|GPA)[^，]{0,12}?(?:不低于|达到|至少|≥)\s*(\d+(?:\.\d+)?)/i,
    official: (match) => `不低于 ${match[1]}`,
    assess: (official, answer) => {
      const required = numberAnswer(official);
      const user = numberAnswer(answer);
      if (required == null || user == null) return 'unknown';
      return user >= required ? 'satisfied' : 'not_satisfied';
    },
  },
  {
    id: 'failed_course_count',
    label: '挂科限制',
    group: 'eligibility',
    match: /(?:不得有|无|没有)[^，]{0,6}(?:挂科|不及格课程)/,
    official: () => '不得有挂科或不及格课程',
    assess: (_official, answer) => {
      const user = numberAnswer(answer);
      if (user == null) return 'unknown';
      return user === 0 ? 'satisfied' : 'not_satisfied';
    },
  },
  {
    id: 'incoming_quota',
    label: '接收名额',
    group: 'eligibility',
    match: /(?:接收|拟录取|名额|计划)[^，]{0,12}?(\d+)\s*人/,
    official: (match) => `${match[1]} 人`,
  },
  {
    id: 'assessment_subjects',
    label: '考核方式',
    group: 'eligibility',
    match: /[^，]{0,20}(?:笔试|面试|材料审核)[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'outgoing_permission',
    label: '转出资格',
    group: 'eligibility',
    match:
      /[^，]{0,20}(?:原专业|转出学院|所在学院)[^，]{0,24}(?:同意|审核|不得转出|限制)[^，]{0,12}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'incoming_permission',
    label: '转入资格',
    group: 'eligibility',
    match:
      /[^，]{0,20}(?:转入学院|接收学院|拟转入专业)[^，]{0,24}(?:同意|审核|接收|不得)[^，]{0,12}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'makeup_credits',
    label: '补修学分',
    group: 'cost',
    match: /(?:补修|补足|补学)[^，]{0,10}?(\d+(?:\.\d+)?)\s*学分/,
    official: (match) => `${match[1]} 学分`,
  },
  {
    id: 'makeup_requirement',
    label: '补修要求',
    group: 'cost',
    match: /[^，]{0,30}(?:没有学习过|未修读)[^，]{0,24}必须补修[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'tuition_standard',
    label: '转入后学费口径',
    group: 'cost',
    match: /[^，]{0,28}按转入专业学费标准缴纳学费[^，]{0,12}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'graduation_delay',
    label: '学制或毕业时间影响',
    group: 'cost',
    match: /[^，]{0,20}(?:延长学制|延期毕业|降级)[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'extra_tuition',
    label: '额外学费',
    group: 'cost',
    match: /[^，]{0,20}(?:额外学费|补交学费|按学分收费)[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'course_conflicts',
    label: '课程冲突',
    group: 'cost',
    match: /[^，]{0,20}(?:课程冲突|补修课程冲突|上课时间冲突)[^，]{0,20}/,
    official: (match) => match[0].trim(),
  },
  {
    id: 'recommendation_eligibility',
    label: '推免资格影响',
    group: 'cost',
    match: /[^，]{0,20}(?:推免|推荐免试)[^，]{0,20}(?:资格|影响|限制)[^，]{0,12}/,
    official: (match) => match[0].trim(),
  },
];

export function buildOfficialAssessment(officialSources, profile, options = {}) {
  const now = options.now || new Date();
  const checks = [];
  const seen = new Set();
  for (const source of officialSources || []) {
    for (const quote of clauses(source.text)) {
      for (const rule of rules) {
        if (seen.has(rule.id)) continue;
        const match = quote.match(rule.match);
        if (!match) continue;
        const officialValue = rule.official(match);
        const userValue = profile.conditionAnswers?.[rule.id] || '';
        checks.push({
          id: rule.id,
          label: rule.label,
          group: rule.group,
          status: rule.assess
            ? rule.assess(officialValue, userValue, now)
            : 'confirmed',
          officialValue,
          userValue,
          quote,
          sourceId: source.id,
        });
        seen.add(rule.id);
      }
    }
  }
  const hasOfficialRules = Boolean(officialSources?.length);
  const hasEligibilityRules = checks.some(
    (item) => item.group === 'eligibility',
  );
  return {
    eligibilityStatus:
      hasOfficialRules && hasEligibilityRules
        ? 'official_rules_found'
        : 'unknown',
    eligibilityMessage: !hasOfficialRules
      ? '资格未知：未提供或未成功读取目标学校官方规则，知乎个人经验不代替资格判断。'
      : hasEligibilityRules
        ? '已读取官方材料并分离核对其中可识别的资格条件。'
        : '资格未知：已读取的官方材料中未识别出可用的资格规则。',
    basis: 'official_only',
    checks,
    estimates: [],
    missing: rules
      .filter((rule) => !seen.has(rule.id))
      .map((rule) => ({ id: rule.id, label: rule.label, group: rule.group })),
  };
}
