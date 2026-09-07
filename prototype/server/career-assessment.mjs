const skillTerms = [
  'JavaScript',
  'TypeScript',
  'React',
  'Vue',
  'Python',
  'Java',
  'SQL',
  'Excel',
  'Figma',
  'Photoshop',
  '数据分析',
  '项目管理',
];

const educationRank = {
  高中: 1,
  中专: 1,
  大专: 2,
  专科: 2,
  本科: 3,
  学士: 3,
  硕士: 4,
  研究生: 4,
  博士: 5,
};

function requirement(id, label, matches, userValue = '', sampleCount = matches.length) {
  const frequencies = new Map();
  for (const item of matches)
    frequencies.set(item.value, (frequencies.get(item.value) || 0) + 1);
  return {
    id,
    label,
    value: [...frequencies.entries()]
      .map(([value, count]) => `${value}（${count}/${sampleCount}条）`)
      .join('；'),
    quote: matches[0].quote,
    userValue,
    status: userValue ? 'compare' : 'unknown',
  };
}

function splitSamples(text) {
  return String(text || '')
    .split(/\n\s*(?:---+|===+)\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function educationStatus(matches, userValue) {
  const user = Object.entries(educationRank).find(([key]) =>
    String(userValue).includes(key),
  )?.[1];
  const required = matches
    .map((item) => educationRank[item.level])
    .filter(Boolean);
  if (!user || !required.length) return 'unknown';
  const met = required.filter((level) => user >= level).length;
  return met === required.length ? 'met' : met === 0 ? 'gap' : 'mixed';
}

function tenureStatus(matches, userValue) {
  const user = Number(String(userValue).match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(user)) return 'unknown';
  const met = matches.filter((item) => user >= item.years).length;
  return met === matches.length ? 'met' : met === 0 ? 'gap' : 'mixed';
}

function hasSkill(text, skill) {
  if (skill === 'Java') return /(?:^|[^A-Za-z])Java(?:$|[^A-Za-z])/i.test(text);
  return new RegExp(skill, 'i').test(text);
}

export function buildJobRequirementAssessment(profile) {
  const answers = profile.conditionAnswers || {};
  const samples = splitSamples(answers.job_posting_text);
  if (!samples.length)
    return { sampleCount: 0, requirements: [], missing: ['招聘要求原文'] };
  const found = {
    education: [],
    tenure: [],
    portfolio: [],
    skills: [],
    license: [],
  };
  for (const text of samples) {
    const education = text.match(
      /(?:本科|专科|大专|硕士|研究生|博士)(?:及以上|以上)?/,
    );
    if (education)
      found.education.push({
        value: education[0],
        level: education[0].replace(/及?以上/, ''),
        quote: education[0],
      });
    const tenure = text.match(
      /(\d+(?:\.\d+)?)\s*年(?:以上)?[^，。]{0,8}(?:经验|工作经历)/,
    );
    if (tenure)
      found.tenure.push({
        value: tenure[0],
        years: Number(tenure[1]),
        quote: tenure[0],
      });
    const portfolio = text.match(
      /[^，。]{0,16}(?:作品集|项目经验|作品链接)[^，。]{0,16}/,
    );
    if (portfolio)
      found.portfolio.push({ value: '明确要求', quote: portfolio[0] });
    for (const skill of skillTerms.filter((term) => hasSkill(text, term)))
      found.skills.push({ value: skill, quote: skill });
    const license = text.match(
      /[^，。]{0,12}(?:资格证|执业证|教师资格证|CPA|软考)[^，。]{0,12}/i,
    );
    if (license) found.license.push({ value: license[0], quote: license[0] });
  }
  const requirements = [];
  if (found.education.length) {
    const item = requirement(
      'education',
      '学历',
      found.education,
      answers.current_education,
      samples.length,
    );
    item.status = educationStatus(found.education, answers.current_education);
    requirements.push(item);
  }
  if (found.tenure.length) {
    const item = requirement(
      'tenure',
      '相关经验',
      found.tenure,
      answers.relevant_tenure,
      samples.length,
    );
    item.status = tenureStatus(found.tenure, answers.relevant_tenure);
    requirements.push(item);
  }
  if (found.portfolio.length) {
    const item = requirement(
      'portfolio',
      '作品或项目',
      found.portfolio,
      answers.portfolio_or_work_sample,
      samples.length,
    );
    item.status = /是|有|已有|完成/.test(
      answers.portfolio_or_work_sample || '',
    )
      ? 'met'
      : /否|没有|暂无|还没/.test(answers.portfolio_or_work_sample || '')
        ? 'gap'
        : 'unknown';
    requirements.push(item);
  }
  if (found.skills.length) {
    const userValue = [answers.transferable_tools, answers.domain_knowledge]
      .filter(Boolean)
      .join('、');
    const item = requirement(
      'skills',
      '技能',
      found.skills,
      userValue,
      samples.length,
    );
    const unique = [...new Set(found.skills.map((entry) => entry.value))];
    const matched = unique.filter((skill) =>
      hasSkill(userValue, skill),
    ).length;
    item.status = !userValue
      ? 'unknown'
      : matched === unique.length
        ? 'met'
        : matched === 0
          ? 'gap'
          : 'mixed';
    requirements.push(item);
  }
  if (found.license.length) {
    const item = requirement(
      'license',
      '证照',
      found.license,
      answers.certificate_held,
      samples.length,
    );
    item.status = !answers.certificate_held
      ? 'unknown'
      : found.license.some((entry) =>
            answers.certificate_held.includes(entry.value.trim()),
          )
        ? 'met'
        : 'gap';
    requirements.push(item);
  }
  return {
    sampleCount: samples.length,
    role: answers.target_job_function || '',
    region: answers.job_region || '',
    publishedAt: answers.job_requirement_date || '',
    requirements,
    missing: [
      !answers.target_job_function && '目标岗位',
      !answers.job_region && '岗位地区',
      !answers.job_requirement_date && '发布日期',
      !answers.current_education && found.education.length && '用户当前学历',
    ].filter(Boolean),
  };
}

export function attachCareerCosts(paths, profile) {
  if (profile.decisionScope !== 'career_transition') return paths;
  const answers = profile.conditionAnswers || {};
  return paths.map((path) => {
    const known = [];
    const conflicts = [];
    if (answers.daily_time) known.push(`可投入时间：${answers.daily_time}`);
    if (answers.income_gap_months)
      known.push(`可承受收入空窗：${answers.income_gap_months}`);
    if (answers.training_cost_ceiling)
      known.push(`培训费用上限：${answers.training_cost_ceiling}`);
    if (answers.salary_floor_amount)
      known.push(`固定薪资下限：${answers.salary_floor_amount}`);
    if (
      path.id === 'fulltime_preparation' &&
      /^(?:是|需要|必须)$/.test(answers.income_continuity || '')
    )
      conflicts.push('该路径需要中断收入，但你要求保持稳定收入。');
    if (
      path.id === 'direct_application' &&
      /^(?:否|没有|暂无|还没)$/.test(answers.portfolio_or_work_sample || '')
    )
      conflicts.push(
        '直接投递路径中的岗位如要求作品或项目，你目前尚无可展示材料。',
      );
    if (
      path.id === 'adjacent_role' &&
      /^(?:否|不接受|不能)$/.test(answers.entry_level_acceptance || '')
    )
      conflicts.push(
        '相邻岗位过渡通常从初级或助理岗位开始，但你目前不接受该级别。',
      );
    return {
      ...path,
      costAssessment: {
        known,
        conflicts,
        missing: [
          !answers.income_gap_months && '可承受收入空窗',
          !answers.salary_floor_amount && '固定薪资下限',
          !answers.training_cost_ceiling && '培训费用上限',
        ].filter(Boolean),
      },
    };
  });
}
