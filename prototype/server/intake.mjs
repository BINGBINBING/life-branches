import { candidateConditions, conditions } from './condition-dictionary.mjs';
import { deepseekJSON } from './deepseek.mjs';
import { requiredConditionIds } from './research-readiness.mjs';
import {
  parseSourceCondition,
  parseUserCondition,
} from './condition-comparison.mjs';

const scopes = ['major_transition', 'career_transition', 'unsupported'];
const majorPaths = [
  'campus_transfer',
  'cross_major_graduate',
  'minor',
  'second_bachelor',
];
const decisionPaths = [...majorPaths, 'career_change'];
const typedPrefillIds = new Set([
  'daily_time',
  'weekly_hours',
  'current_stage',
  'current_term',
  'gpa_value',
  'rank_percentile',
  'rank_position',
]);

function personalClause(text) {
  return !/朋友|同学|同事|案例|博主|作者|别人|他(?:是|在|每天|每周)|她(?:是|在|每天|每周)|要求|假如|假设|如果|比如|例如/.test(text);
}

function personalQuote(question, quote) {
  const contexts = question.split(/[，。；！？\n]/).filter((clause) => clause.includes(quote));
  return contexts.length ? contexts.every(personalClause) : personalClause(question);
}

function currentOrTargetMeaning(question, quote, id) {
  const clauses = question.split(/[，。；！？\n]/).filter((clause) => clause.includes(quote));
  const context = clauses.length ? clauses.join('；') : quote;
  if (id.startsWith('current_') && /过去|以前|曾经|曾在|之前|原来|不是|并非|不再|没做|(?:想|希望|计划|准备).{0,8}(?:成为|从事|做|读)/.test(context)) return false;
  if (id.startsWith('target_') && /不想|不考虑|不打算|排除|不做|拒绝/.test(context)) return false;
  return true;
}

function hasFieldMeaning(id, value, quote) {
  if (/^(?:未知|不清楚|不知道|待确认|尚未核实)$/.test(value)) return false;
  if (id === 'current_job_function' || id === 'target_job_function') {
    if (/^(?:在职|离职|待业|失业|就业|未就业|应届生|学生|全职|兼职)$/.test(value))
      return false;
  }
  if (id === 'current_education') {
    // A desired degree or someone else's requirement is not the user's education.
    if (/要求|需要|目标|想|计划|准备|希望|朋友|同学|他|她/.test(quote)) return false;
    if (!/^(?:我|本人|目前学历|现在学历|学历)/.test(quote)) return false;
    const parsed = parseUserCondition(id, value);
    const source = parseSourceCondition(id, quote);
    return !!parsed && !!source && parsed.normalized === source.normalized;
  }
  if (typedPrefillIds.has(id)) {
    const source = parseSourceCondition(id, quote);
    const parsed = parseUserCondition(id, value);
    return !!source && !!parsed && source.normalized === parsed.normalized;
  }
  return true;
}
const sectors = [
  'industrial',
  'design',
  'accounting',
  'sales',
  'education',
  'software',
  'operations',
  'other',
];

const priorities = {
  career_transition: [
    'current_education',
    'current_job_function',
    'target_industry',
    'target_job_function',
    'job_region',
    'job_posting_text',
    'daily_time',
    'income_gap_months',
    'trial_completed',
  ],
  campus_transfer: [
    'institution_name',
    'current_major',
    'target_major',
    'policy_link',
    'current_stage',
    'current_term',
    'policy_year',
    'application_deadline',
  ],
  cross_major_graduate: [
    'current_major',
    'target_major',
    'graduate_admission_eligibility',
    'graduate_exam_subjects',
    'research_exposure',
    'daily_time',
  ],
  minor: [
    'institution_name',
    'current_major',
    'target_major',
    'minor_application_eligibility',
    'minor_course_schedule',
    'weekly_hours',
  ],
  second_bachelor: [
    'institution_name',
    'current_major',
    'target_major',
    'second_degree_eligibility',
    'parallel_exam_conflict',
    'weekly_hours',
  ],
};

const comparisonAnchors = {
  career_transition: ['daily_time', 'relevant_tenure', 'current_education'],
  campus_transfer: ['current_stage', 'current_term', 'gpa_value'],
  cross_major_graduate: ['daily_time', 'weekly_hours'],
  minor: ['daily_time', 'weekly_hours'],
  second_bachelor: ['daily_time', 'weekly_hours'],
};

function catalogue() {
  return conditions
    .filter((item) => item.nodeType === 'atomic')
    .map((item) => ({
      id: item.id,
      scope: item.scope,
      paths: item.paths,
      sectors: item.sectors,
      label: item.label,
    }));
}

function inferredScope(question) {
  if (/(?:转入|转成)[^，。；！？\n]{1,12}专业/.test(question))
    return 'major_transition';
  if (
    /\u8f6c\u4e13\u4e1a|\u8de8\u4e13\u4e1a|\u8de8\u8003|\u8f85\u4fee|\u4e8c\u5b66\u4f4d|\u7b2c\u4e8c\u5b66\u58eb|\u8f6c\u5230.{0,12}\u4e13\u4e1a/.test(
      question,
    )
  )
    return 'major_transition';
  if (
    /\u8f6c\u884c|\u8f6c\u5c97|\u6362\u884c\u4e1a|\u6362\u5de5\u4f5c|\u8de8\u884c|\u8f6c(?:\u505a|\u53bb|\u5230)?(?:\u5f00\u53d1|\u7a0b\u5e8f\u5458|\u524d\u7aef|\u540e\u7aef|\u8bbe\u8ba1|\u4f1a\u8ba1|\u9500\u552e|\u6559\u5e08|\u8fd0\u8425|\u4ea7\u54c1)/.test(
      question,
    )
  )
    return 'career_transition';
  return 'unsupported';
}

function inferredPath(question, scope) {
  if (scope === 'career_transition') return 'career_change';
  if (
    /\u8de8\u8003|\u8003\u7814|\u8de8\u4e13\u4e1a.{0,8}(?:\u8bfb\u7814|\u7814\u7a76\u751f)/.test(
      question,
    )
  )
    return 'cross_major_graduate';
  if (/\u8f85\u4fee/.test(question)) return 'minor';
  if (/\u4e8c\u5b66\u4f4d|\u7b2c\u4e8c\u5b66\u58eb/.test(question))
    return 'second_bachelor';
  return 'campus_transfer';
}

function inferredSector(question) {
  const matches = [
    [
      'industrial',
      /\u5de5\u4e1a|\u81ea\u52a8\u5316|PLC|\u673a\u68b0|\u7535\u6c14/i,
    ],
    ['design', /\u8bbe\u8ba1|UI|UX|\u4ea4\u4e92/i],
    ['accounting', /\u4f1a\u8ba1|\u8d22\u52a1|\u5ba1\u8ba1/],
    ['sales', /\u9500\u552e|\u5546\u52a1|\u5ba2\u6237/],
    ['education', /\u6559\u80b2|\u6559\u5e08|\u57f9\u8bad|\u8bb2\u5e08/],
    [
      'software',
      /\u5f00\u53d1|\u7f16\u7a0b|\u7a0b\u5e8f|\u8f6f\u4ef6|\u524d\u7aef|\u540e\u7aef|\u7b97\u6cd5|IT/i,
    ],
    ['operations', /\u8fd0\u8425|\u6295\u653e|\u5185\u5bb9|\u589e\u957f/],
  ];
  const target = question
    .split(
      /\u8f6c\u884c(?:\u505a|\u5230|\u53bb)?|\u8f6c\u5c97(?:\u505a|\u5230|\u53bb)?|\u60f3\u505a|\u6210\u4e3a/,
    )
    .at(-1);
  return (
    matches.find(([, pattern]) => pattern.test(target))?.[0] ||
    matches.find(([, pattern]) => pattern.test(question))?.[0] ||
    'other'
  );
}

function safeCode(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function extractedPrefills(question, raw, candidates) {
  const allowed = new Set(candidates.map((item) => item.id));
  const values = new Map();
  const conflicts = new Set();
  const extracted = Array.isArray(raw.extracted) ? raw.extracted : [];
  for (const item of extracted) {
    const id = typeof item?.conditionId === 'string' ? item.conditionId : '';
    const value = typeof item?.value === 'string' ? item.value.trim() : '';
    const quote = typeof item?.quote === 'string' ? item.quote.trim() : '';
    if (
      !allowed.has(id) ||
      !value ||
      value.length > 400 ||
      !quote ||
      quote.length > 240 ||
      !question.includes(quote) ||
      !quote.toLowerCase().includes(value.toLowerCase())
    )
      continue;
    if ((typedPrefillIds.has(id) || id.startsWith('current_')) && !personalQuote(question, quote)) continue;
    if (!currentOrTargetMeaning(question, quote, id)) continue;
    if (!hasFieldMeaning(id, value, quote)) continue;
    if (conflicts.has(id)) continue;
    if (values.has(id) && values.get(id).initialValue !== value) {
      values.delete(id);
      conflicts.add(id);
      continue;
    }
    values.set(id, { initialValue: value, initialQuote: quote });
  }
  return { values, conflicts };
}

function prefill(question, id) {
  const candidates = question.split(/[，。；！？\n]/).filter(personalClause)
    .filter((clause) => currentOrTargetMeaning(question, clause, id))
    .map((clause) => prefillClause(clause, id)).filter((item) => item.initialValue);
  const values = new Set(candidates.map((item) => item.initialValue));
  return values.size === 1 ? candidates[0] : {};
}

function prefillClause(question, id) {
  if (id === 'gpa_value') {
    const match = question.match(/(?:绩点|GPA)\s*(\d+(?:\.\d+)?)/i);
    if (match && parseSourceCondition(id, question))
      return { initialValue: match[1], initialQuote: match[0] };
    return {};
  }
  if (id === 'daily_time') {
    const quote = question.match(
      /(?:每天|每日)[^，。]{0,12}?(?:\d+(?:\.\d+)?|[一二两三四五六七八九十])\s*(?:个)?小时/,
    )?.[0];
    const parsed = quote && parseUserCondition(id, quote);
    return parsed ? { initialValue: parsed.display, initialQuote: quote } : {};
  }
  if (id === 'weekly_hours') {
    const quote = question.match(
      /(?:每周|一周)[^，。]{0,12}?(?:\d+(?:\.\d+)?|[一二两三四五六七八九十])\s*(?:个)?小时/,
    )?.[0];
    const parsed = quote && parseUserCondition(id, quote);
    return parsed ? { initialValue: parsed.display, initialQuote: quote } : {};
  }
  if (id === 'current_stage') {
    const quote = question.match(/(?:目前|现在)?大[一二两三四五六七八]/)?.[0];
    const parsed = quote && parseUserCondition(id, quote);
    return parsed ? { initialValue: parsed.display, initialQuote: quote } : {};
  }
  if (id === 'current_term') {
    const quote = question.match(
      /(?:目前|现在)?第\s*(?:\d+|[一二两三四五六七八九十])\s*(?:个)?学期/,
    )?.[0];
    const parsed = quote && parseUserCondition(id, quote);
    return parsed ? { initialValue: parsed.display, initialQuote: quote } : {};
  }
  if (id === 'current_education') {
    const quote = question.match(
      /(?:我(?:目前|现在)?是|本人|目前学历(?:是|为)?|学历(?:是|为)?)[^，。]{0,6}(?:博士|硕士|研究生|本科|学士|大专|专科|高中|中专)/,
    )?.[0];
    const parsed =
      quote && hasFieldMeaning(id, quote, quote) && parseUserCondition(id, quote);
    return parsed ? { initialValue: parsed.display, initialQuote: quote } : {};
  }
  if (
    id === 'income_continuity' &&
    /不能中断收入|必须保持.{0,4}收入/.test(question)
  )
    return { initialValue: '是', initialQuote: question };
  const major = question.match(
    /从([^，。]{1,16})专业.{0,8}(?:转到|转入|转成)([^，。]{1,16})专业/,
  );
  if (major && id === 'current_major')
    return { initialValue: major[1], initialQuote: major[0] };
  if (major && id === 'target_major')
    return { initialValue: major[2], initialQuote: major[0] };
  return {};
}

export function normalizeIntake(question, raw = {}) {
  const localScope = inferredScope(question);
  const scope = safeCode(raw.scope, scopes, localScope);
  if (scope === 'unsupported') {
    return {
      supported: false,
      scope,
      path: '',
      sector: 'other',
      fields: [],
      message:
        '\u5f53\u524d\u7248\u672c\u53ea\u652f\u6301“\u8f6c\u4e13\u4e1a”\u548c“\u8f6c\u884c / \u8f6c\u5c97”\u4e2d\u7684\u4e00\u4e2a\u5177\u4f53\u9009\u62e9\u3002',
    };
  }

  const path =
    scope === 'career_transition'
      ? 'career_change'
      : safeCode(raw.path, majorPaths, inferredPath(question, scope));
  const sector =
    scope === 'career_transition'
      ? inferredSector(question) !== 'other'
        ? inferredSector(question)
        : safeCode(raw.sector, sectors, 'other')
      : 'other';
  const candidates = candidateConditions({ scope, path, sector });
  const byId = new Map(candidates.map((item) => [item.id, item]));
  const requested = Array.isArray(raw.fieldIds) ? raw.fieldIds : [];
  const { values: extracted, conflicts } = extractedPrefills(question, raw, candidates);
  const fallback = priorities[path] || priorities[scope] || [];
  const anchors = comparisonAnchors[path] || comparisonAnchors[scope] || [];
  const prefilled = candidates
    .filter((item) => Object.keys(prefill(question, item.id)).length > 0)
    .map((item) => item.id);
  const explicitIds = new Set([...prefilled, ...extracted.keys(), ...conflicts]);
  const selected = [];
  let unansweredCount = 0;
  for (const id of [
    ...prefilled,
    ...extracted.keys(),
    ...conflicts,
    ...requiredConditionIds(path),
    ...anchors,
    ...requested,
    ...fallback,
  ]) {
    const item = byId.get(id);
    if (!item || selected.some((field) => field.id === id)) continue;
    if (item.policy.voluntary_only && !requested.includes(id)) continue;
    const field = {
      id: item.id,
      label: item.label,
      question: item.question,
      answerType: item.policy.answer_type || 'text',
      options: item.policy.options || [],
      group: item.group,
      ...extracted.get(item.id),
      ...prefill(question, item.id),
      ...(conflicts.has(item.id) ? { initialValue: undefined, initialQuote: undefined } : {}),
    };
    const hasInitialValue = Boolean(field.initialValue);
    if (!hasInitialValue && !explicitIds.has(id) && unansweredCount >= 6)
      continue;
    selected.push(field);
    if (!hasInitialValue) unansweredCount++;
  }

  return {
    supported: true,
    scope,
    path,
    sector,
    fields: selected,
    message:
      '\u5df2\u8bc6\u522b\u7684\u6761\u4ef6\u4f1a\u5168\u90e8\u4fdd\u7559\uff1b\u518d\u8865\u9f50\u6700\u591a 6 \u4e2a\u4f1a\u5f71\u54cd\u68c0\u7d22\u548c\u5bf9\u7167\u7684\u6761\u4ef6\u3002',
  };
}

export function createLocalIntakePlan(question, decisionPath) {
  if (
    typeof question !== 'string' ||
    question.trim().length < 2 ||
    question.length > 2000
  )
    throw new Error('请填写 2–2000 字的一个具体选择。');
  if (!decisionPaths.includes(decisionPath))
    throw new Error('选择类型无效。');
  const scope =
    decisionPath === 'career_change'
      ? 'career_transition'
      : 'major_transition';
  return {
    ...normalizeIntake(question.trim(), {
      scope,
      path: decisionPath,
      sector: inferredSector(question),
    }),
    generatedBy: 'local-route-change',
  };
}

export async function createIntakePlan(question, options = {}) {
  if (
    typeof question !== 'string' ||
    question.trim().length < 2 ||
    question.length > 2000
  )
    throw new Error(
      '\u8bf7\u586b\u5199 2–2000 \u5b57\u7684\u4e00\u4e2a\u5177\u4f53\u9009\u62e9\u3002',
    );
  const prompt = `\u4f60\u5728\u4e3a“\u8f6c\u4e13\u4e1a / \u8f6c\u884c”\u7ecf\u9a8c\u68c0\u7d22\u751f\u6210\u641c\u7d22\u524d\u6761\u4ef6\u8868\u5355\u3002
\u7528\u6237\u539f\u8bdd\uff1a${JSON.stringify(question.trim())}
\u4ec5\u8fd4\u56de JSON\uff1a{"scope":"major_transition|career_transition|unsupported","path":"campus_transfer|cross_major_graduate|minor|second_bachelor|career_change","sector":"industrial|design|accounting|sales|education|software|operations|other","fieldIds":["\u6761\u4ef6ID"],"extracted":[{"conditionId":"\u6761\u4ef6ID","value":"\u7528\u4e8e\u8868\u5355\u7684\u7b80\u77ed\u503c","quote":"\u7528\u6237\u539f\u8bdd\u4e2d\u7684\u8fde\u7eed\u7247\u6bb5"}]}
\u89c4\u5219\uff1a
1. \u5f53\u524d\u4ec5\u652f\u6301\u8f6c\u4e13\u4e1a\u548c\u8f6c\u884c / \u8f6c\u5c97\uff0c\u5176\u4ed6\u4e3b\u9898\u6807\u8bb0 unsupported\u3002
2. \u9009 4–6 \u4e2a\u6700\u5f71\u54cd\u9996\u8f6e\u68c0\u7d22\u4e0e\u7ecf\u9a8c\u53ef\u6bd4\u6027\u7684\u5b57\u6bb5\u3002
3. \u53ea\u80fd\u9009\u76ee\u5f55\u4e2d\u7684 id\uff0c\u4e0d\u751f\u6210\u95ee\u9898\u6587\u6848\uff0c\u4e0d\u63a8\u65ad\u7528\u6237\u672a\u8bf4\u7684\u6761\u4ef6\u3002
4. extracted \u53ea\u653e\u7528\u6237\u5df2\u660e\u786e\u8bf4\u51fa\u7684\u503c\uff1bquote \u5fc5\u987b\u662f\u7528\u6237\u539f\u8bdd\u4e2d\u5b8c\u5168\u4e00\u81f4\u7684\u8fde\u7eed\u7247\u6bb5\u3002\u6ca1\u8bf4\u7684\u6761\u4ef6\u4e0d\u586b\u3002
\u6761\u4ef6\u76ee\u5f55\uff1a${JSON.stringify(catalogue())}`;
  const ask = options.ask || ((value) => deepseekJSON(value));
  try {
    const result = await ask(prompt);
    const raw = result?.value || result;
    return {
      ...normalizeIntake(question.trim(), raw),
      generatedBy: result?.metadata?.provider || 'test',
    };
  } catch {
    return {
      ...normalizeIntake(question.trim()),
      generatedBy: 'local-fallback',
    };
  }
}
