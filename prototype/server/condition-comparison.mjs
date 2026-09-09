import { dictionaryIndex } from './condition-dictionary.mjs';
import { dailyHours } from './evidence-policy.mjs';

export const COMPARABLE_CONDITIONS = Object.freeze({
  major_transition: [
    'daily_time',
    'weekly_hours',
    'current_stage',
    'current_term',
    'gpa_value',
    'rank_percentile',
    'rank_position',
    'failed_course_count',
    'makeup_credits',
    'application_deadline',
    'transfer_restriction',
    'policy_verified',
  ],
  career_transition: [
    'daily_time',
    'weekly_hours',
    'relevant_tenure',
    'current_education',
    'application_count',
    'interview_count',
    'income_gap_months',
    'portfolio_or_work_sample',
    'income_continuity',
    'entry_level_acceptance',
  ],
});

const chinese = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};
const number = (value) => chinese[value] ?? Number(value);
const token = '([0-9]+(?:\\.[0-9]+)?|[零一二两三四五六七八九十])';
const conditionUnits = {
  daily_time: 'hour_per_day',
  weekly_hours: 'hour_per_week',
  current_stage: 'academic_year',
  current_term: 'semester',
  gpa_value: 'gpa',
  rank_percentile: 'rank_percent',
  rank_position: 'rank_position',
  failed_course_count: 'course_count',
  makeup_credits: 'credit',
  relevant_tenure: 'year',
  application_count: 'application_count',
  interview_count: 'interview_count',
  income_gap_months: 'month',
  application_deadline: 'date',
};

function exactNumber(text, pattern, unit, options = {}) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  const value = number(match.slice(1).find((part) => part !== undefined));
  if (
    !Number.isFinite(value) ||
    value < (options.min ?? 0) ||
    value > options.max
  )
    return null;
  return { normalized: value, display: `${value}${unit}` };
}

function categorical(normalized, display) {
  return { normalized, display };
}

function strictDate(text, mode) {
  const value = String(text || '');
  const match = value.match(
    mode === 'source'
      ? /(?:截止|截至|申请时间)[^，。]{0,10}?(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})日?/
      : /(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})日?/,
  );
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const display = `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return categorical(display, display);
}

const parsers = {
  current_education(text) {
    const match = String(text || '').match(
      /博士|硕士|研究生|本科|学士|大专|专科|高中|中专/,
    );
    if (!match) return null;
    const aliases = {
      研究生: '硕士',
      学士: '本科',
      专科: '大专',
    };
    const display = aliases[match[0]] || match[0];
    return categorical(display, display);
  },
  daily_time(text, mode) {
    const found = dailyHours(text);
    if (found)
      return { normalized: found.value, display: `${found.value}小时/天` };
    return mode === 'user'
      ? exactNumber(text, new RegExp(`${token}\\s*(?:个)?小时`), '小时/天', {
          max: 24,
        })
      : null;
  },
  weekly_hours(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`(?:每周|一周)[^，。]{0,12}?${token}\\s*(?:个)?小时`)
        : new RegExp(`${token}\\s*(?:个)?小时`),
      '小时/周',
      { max: 168 },
    );
  },
  current_stage(text) {
    const value = String(text || '');
    const year = value.match(new RegExp(`大\\s*${token}`));
    const parsed = year && number(year[1]);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 8)
      return categorical(`year-${parsed}`, year[0].replace(/\s+/g, ''));
    if (/研究生/.test(value)) return categorical('graduate', '研究生');
    if (/尚未入学|还没入学/.test(value))
      return categorical('not-enrolled', '尚未入学');
    return null;
  },
  current_term(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`第\\s*${token}\\s*(?:个)?学期`)
        : new RegExp(`(?:第\\s*)?${token}\\s*(?:个)?学期`),
      '学期',
      { min: 1, max: 20 },
    );
  },
  gpa_value(text, mode) {
    const value = String(text || '');
    if (mode === 'user') {
      if (/%|百分位|排名|名次/.test(value)) return null;
      return exactNumber(value, /([0-9]+(?:\.[0-9]+)?)/, '', {
        max: 100,
      });
    }
    const match = value.match(
      /(?:GPA|绩点)([^，。0-9]{0,8})([0-9]+(?:\.[0-9]+)?)/i,
    );
    if (!match || /百分位|排名|名次|前/.test(match[1])) return null;
    const suffix = value.slice((match.index || 0) + match[0].length);
    if (/^\s*%/.test(suffix)) return null;
    const parsed = Number(match[2]);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
      ? { normalized: parsed, display: String(parsed) }
      : null;
  },
  rank_percentile(text, mode) {
    const value = String(text || '');
    const pattern =
      mode === 'source'
        ? /(?:排名|位于|专业|年级|班级)[^，。]{0,12}?(?:前\s*)?([0-9]+(?:\.[0-9]+)?)\s*%/
        : /(?:前\s*)?([0-9]+(?:\.[0-9]+)?)\s*%/;
    const parsed = exactNumber(value, pattern, '%', { max: 100 });
    return parsed
      ? { ...parsed, display: `前${parsed.normalized}%` }
      : null;
  },
  rank_position(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? /(?:排名|名次)[^，。0-9]{0,8}(?:第\s*)?([0-9]+)(?:\s*名|\s*\/)/
        : /(?:第\s*)?([0-9]+)(?:\s*名|\s*\/)?/,
      '名',
      { min: 1, max: 100000 },
    );
  },
  failed_course_count(text, mode) {
    if (/(?:没有|无)挂科/.test(text)) return { normalized: 0, display: '0门' };
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`(?:挂科${token}门|${token}门[^，。]{0,4}挂科)`)
        : new RegExp(`${token}\\s*门`),
      '门',
      { max: 100 },
    );
  },
  makeup_credits(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`(?:补修|待补)[^，。]{0,8}?${token}\\s*学分`)
        : new RegExp(`${token}\\s*学分`),
      '学分',
      { max: 300 },
    );
  },
  relevant_tenure(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`${token}\\s*年[^，。]{0,10}(?:经验|工作|从业)`)
        : new RegExp(`${token}\\s*年`),
      '年',
      { max: 80 },
    );
  },
  application_count(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(`(?:投递|海投)[^，。]{0,8}?${token}\\s*(?:份|家|个)`)
        : new RegExp(`${token}\\s*(?:份|家|个)?`),
      '份',
      { max: 10000 },
    );
  },
  interview_count(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(
            `(?:面试[^，。]{0,6}?${token}\\s*次|${token}\\s*次[^，。]{0,6}?面试)`,
          )
        : new RegExp(`${token}\\s*次`),
      '次',
      { max: 10000 },
    );
  },
  income_gap_months(text, mode) {
    return exactNumber(
      text,
      mode === 'source'
        ? new RegExp(
            `(?:空窗|脱产|无收入|存款)[^，。]{0,12}?${token}\\s*(?:个)?月`,
          )
        : new RegExp(`${token}\\s*(?:个)?月`),
      '个月',
      { max: 120 },
    );
  },
  application_deadline(text, mode) {
    return strictDate(text, mode);
  },
  transfer_restriction(text, mode) {
    const value = String(text || '');
    if (/(?:不允许|不能|禁止|不接收).{0,8}(?:跨|转入|转专业)/.test(value))
      return categorical('blocked', '不允许转入');
    if (/(?:允许|可以|可申请|接收).{0,8}(?:跨|转入|转专业)/.test(value))
      return categorical('allowed', '允许申请转入');
    if (mode === 'user' && /^(?:不允许|不能|不可以|否)$/.test(value.trim()))
      return categorical('blocked', '不允许转入');
    if (mode === 'user' && /^(?:允许|可以|是)$/.test(value.trim()))
      return categorical('allowed', '允许申请转入');
    return null;
  },
  policy_verified(text, mode) {
    const value = String(text || '');
    if (
      /(?:没|未|没有|尚未).{0,8}(?:查|看|找到|核对).{0,8}(?:通知|官网|校规)/.test(
        value,
      )
    )
      return categorical('not_checked', '尚未核对');
    if (/(?:已|已经|查过|看过|找到|核对).{0,8}(?:通知|官网|校规)/.test(value))
      return categorical('checked', '已经核对');
    if (mode === 'user' && /^(?:否|没有|还没|尚未)$/.test(value.trim()))
      return categorical('not_checked', '尚未核对');
    if (mode === 'user' && /^(?:是|有|已经)$/.test(value.trim()))
      return categorical('checked', '已经核对');
    return null;
  },
  portfolio_or_work_sample(text, mode) {
    const value = String(text || '');
    if (/(?:没有|暂无|还没|未).{0,8}(?:项目|作品|案例|作品集)/.test(value))
      return categorical('none', '尚无可展示作品');
    if (
      /(?:已有|有|做过|做了|完成了|准备了).{0,8}(?:项目|作品|案例|作品集)/.test(
        value,
      )
    )
      return categorical('has', '已有可展示作品');
    if (mode === 'user' && /^(?:否|没有|暂无|还没)$/.test(value.trim()))
      return categorical('none', '尚无可展示作品');
    if (mode === 'user' && /^(?:是|有|已有)$/.test(value.trim()))
      return categorical('has', '已有可展示作品');
    return null;
  },
  income_continuity(text, mode) {
    const value = String(text || '');
    if (mode === 'user' && /^(?:是|需要|必须)$/.test(value.trim()))
      return categorical('retained', '需要保持收入');
    if (
      /(?:不能|不可|不想|不愿).{0,6}(?:中断|失去).{0,4}收入|必须.{0,6}(?:保持|保留).{0,4}收入/.test(
        value,
      )
    )
      return categorical('retained', '需要保持收入');
    if (
      /(?:在职|边工作边|下班后|业余时间).{0,12}(?:学习|准备|转行)?/.test(value)
    )
      return categorical('retained', '保持收入期间准备');
    if (
      /(?:裸辞|脱产|辞职后|离职后).{0,12}(?:学习|准备|转行|培训)?/.test(value)
    )
      return categorical('interrupted', '中断收入期间准备');
    if (mode === 'user' && /^(?:否|可以|能|可中断|不需要)$/.test(value.trim()))
      return categorical('interrupted', '可以中断收入');
    return null;
  },
  entry_level_acceptance(text, mode) {
    const value = String(text || '');
    if (/(?:不接受|不能接受|不考虑).{0,8}(?:初级|助理|过渡岗位)/.test(value))
      return categorical('reject', '不接受初级或过渡岗位');
    if (
      /(?:接受|愿意|先从|从).{0,8}(?:初级|助理|过渡岗位).{0,6}(?:开始|做起)?/.test(
        value,
      )
    )
      return categorical('accept', '接受初级或过渡岗位');
    if (mode === 'user' && /^(?:否|不接受|不能)$/.test(value.trim()))
      return categorical('reject', '不接受初级或过渡岗位');
    if (mode === 'user' && /^(?:是|接受|愿意|可以)$/.test(value.trim()))
      return categorical('accept', '接受初级或过渡岗位');
    return null;
  },
};

export function parseUserCondition(id, text) {
  return parsers[id]?.(text, 'user') || null;
}

export function parseSourceCondition(id, text) {
  return parsers[id]?.(text, 'source') || null;
}

function typedValue(id, value) {
  return value
    ? {
        ...value,
        fieldId: id,
        unit: conditionUnits[id] || 'category',
        semanticType:
          typeof value.normalized === 'number' ? 'number' : 'category',
      }
    : null;
}

function gpaScale(text, allowBare = false) {
  const value = String(text || '');
  const match = value.match(
    /(?:\/\s*|(?:满分|分制)(?:是|为)?\s*)(4(?:\.0)?|5(?:\.0)?|100)(?:\s*分)?/,
  );
  if (match) return Number(match[1]);
  if (!allowBare) return null;
  const bare = value.match(/^\s*(4(?:\.0)?|5(?:\.0)?|100)\s*(?:分制|分)?\s*$/);
  return bare ? Number(bare[1]) : null;
}

function rankPopulation(text) {
  return String(text || '').match(/(班级|专业|年级)(?:排名|内)?/)?.[1] || '';
}

function compatibility(id, caseValue, userValue, quote, profile) {
  if (
    caseValue.fieldId !== userValue.fieldId ||
    caseValue.unit !== userValue.unit ||
    caseValue.semanticType !== userValue.semanticType
  )
    return { comparable: false, reason: '双方条件的字段、单位或语义类型不一致。' };
  if (id === 'gpa_value') {
    const caseScale = gpaScale(quote);
    const userScale = gpaScale(profile.conditionAnswers?.gpa_scale, true);
    if (!caseScale || !userScale)
      return { comparable: false, reason: '双方绩点分制未完整确认，不比较绩点高低。' };
    if (caseScale !== userScale)
      return { comparable: false, reason: '双方绩点分制不同，未经明确换算不直接比较。' };
  }
  if (id === 'rank_percentile' || id === 'rank_position') {
    const casePopulation = rankPopulation(quote);
    const userPopulation = rankPopulation(
      profile.conditionAnswers?.rank_population,
    );
    if (!casePopulation || !userPopulation)
      return { comparable: false, reason: '双方排名的比较群体未完整确认。' };
    if (casePopulation !== userPopulation)
      return { comparable: false, reason: '双方排名分属不同比较群体，不直接比较。' };
  }
  return { comparable: true, reason: '' };
}

function userAnswer(profile, id) {
  if (id === 'daily_time')
    return profile.conditionAnswers?.daily_time || profile.time || '';
  return profile.conditionAnswers?.[id] || '';
}

function sourceClauses(source) {
  return [source.title, ...(source.snippets || [])]
    .flatMap((text) => String(text || '').split(/[，。；！!？?\n]/))
    .map((text) => text.trim())
    .filter((text) => text.length >= 5 && text.length <= 700);
}

function discoveredEvidence(source, allowed, supplied) {
  const present = new Set(
    (Array.isArray(supplied) ? supplied : []).map((item) => item?.conditionId),
  );
  const discovered = [];
  const clauses = sourceClauses(source);
  for (const id of allowed) {
    if (present.has(id) || !parsers[id]) continue;
    const quote = clauses.find((clause) => parsers[id](clause, 'source'));
    if (quote) discovered.push({ conditionId: id, quote });
  }
  return discovered;
}

export function compareConditionEvidence(source, raw, profile, validQuote) {
  const allowed = new Set(COMPARABLE_CONDITIONS[profile.decisionScope] || []);
  const result = [];
  const seen = new Set();
  const supplied = Array.isArray(raw) ? raw : [];
  const candidates = [
    ...supplied,
    ...discoveredEvidence(source, allowed, supplied),
  ];
  for (const item of candidates.slice(0, 12)) {
    const id = item?.conditionId;
    if (!allowed.has(id) || seen.has(id) || !parsers[id]) continue;
    const quote = validQuote(source, item.quote);
    const caseValue = typedValue(
      id,
      quote && parsers[id](quote, 'source'),
    );
    if (!caseValue) continue;
    const answer = userAnswer(profile, id);
    const userValue = typedValue(id, answer && parsers[id](answer, 'user'));
    const compatible =
      userValue && compatibility(id, caseValue, userValue, quote, profile);
    const status = !userValue
      ? 'unknown'
      : !compatible.comparable
        ? 'unknown'
        : userValue.normalized === caseValue.normalized
        ? 'similar'
        : 'different';
    result.push({
      conditionId: id,
      label: dictionaryIndex.get(id).label,
      status,
      userValue: userValue?.display || '',
      userQuote: userValue ? answer : '',
      caseValue: caseValue.display,
      quote,
      needsUserInput: !answer,
      comparisonBasis: {
        fieldId: id,
        unit: caseValue.unit,
        semanticType: caseValue.semanticType,
        compatible: Boolean(compatible?.comparable),
      },
      text:
        status === 'similar'
          ? '这一项的可核对条件相同，不代表整体条件相同。'
          : status === 'different'
            ? '这一项的可核对条件不同，不能直接照搬案例周期或结果。'
            : compatible?.reason ||
              '案例已提供该条件，你尚未提供可按同一口径比较的信息。',
    });
    seen.add(id);
    if (result.length === 9) break;
  }
  return result;
}

export const DYNAMIC_QUESTION_LIMIT = 8;
const criticalQuestions = new Set([
  'application_deadline', 'transfer_restriction', 'policy_verified',
  'gpa_value', 'current_education', 'income_continuity',
  'income_gap_months', 'daily_time', 'weekly_hours',
]);

export function selectDynamicQuestions(candidates) {
  const unique = new Map();
  for (const question of candidates) {
    const key = question.conditionId || question.question;
    if (!unique.has(key)) unique.set(key, question);
  }
  return [...unique.values()]
    .sort((a, b) => Number(criticalQuestions.has(b.conditionId)) - Number(criticalQuestions.has(a.conditionId)))
    .slice(0, DYNAMIC_QUESTION_LIMIT);
}

export function questionsFromComparisons(paths, profile) {
  const questions = [];
  const seen = new Set();
  for (const path of paths) {
    for (const item of path.cases) {
      for (const comparison of item.conditionComparisons || []) {
        const condition = dictionaryIndex.get(comparison.conditionId);
        if (
          !condition ||
          !comparison.needsUserInput ||
          seen.has(condition.id) ||
          profile.conditionAnswers?.[condition.id] ||
          (profile.skipped || []).includes(condition.question)
        )
          continue;
        questions.push({
          conditionId: condition.id,
          question: condition.question,
          reason: `案例原文给出了“${condition.label}”，需要你的同口径值才能比较。`,
          sourceId: item.sourceId,
          quote: comparison.quote,
          options:
            condition.policy.answer_type === 'single_choice' ||
            ['portfolio_or_work_sample', 'entry_level_acceptance'].includes(
              condition.id,
            )
              ? ['是', '否', '尚未核实']
              : [],
        });
        seen.add(condition.id);
      }
    }
  }
  return questions;
}
