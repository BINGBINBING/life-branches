export const RULE_VERSION = 'evidence-4-ds-content';
export const CALL_BUDGET = Object.freeze({
  intake: 1,
  analysis: 3,
  retries: 0,
  search: 5,
});

// A deliberately narrow parser: ranges, plans, third-party statements and
// conflicting values remain unknown rather than becoming guessed conditions.
export function dailyHours(text) {
  const clauses = String(text || '')
    .split(/[，。；！!？?\n]/)
    .filter(Boolean);
  const found = [];
  for (const quote of clauses) {
    if (
      /如果|假如|计划|希望|目标|建议|应该|可能|听说|别人|他|她|未必|不是|不一定|不能|不到|至少|最多|大约|左右|[~～至到-]/.test(
        quote,
      )
    )
      continue;
    const match = quote.match(
      /(?:每天|每日)(?:学习|投入|可投入|能投入|可学习|能学习)?\s*([0-9]+(?:\.[0-9]+)?|[一二两三四五六七八九十])\s*(?:个)?小时/,
    );
    if (!match) continue;
    const digits = {
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
    const value = digits[match[1]] ?? Number(match[1]);
    if (value > 0 && value <= 24) found.push({ value, quote: quote.trim() });
  }
  return found.length && new Set(found.map((x) => x.value)).size === 1
    ? found[0]
    : null;
}

export function userHours(profile) {
  // Goals and the search question describe an intended choice, not capacity.
  return dailyHours(
    [
      profile.time,
      profile.conditionAnswers?.daily_time,
      ...Object.entries(profile.answers || {})
        .filter(([q]) => /时间|时长|小时|投入/.test(q))
        .map(([, a]) => a),
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function compareTime(source, profile) {
  const author = dailyHours(source.snippets.join('\n'));
  const user = userHours(profile);
  if (!author || !user)
    return {
      status: 'unknown',
      quote: '',
      userQuote: '',
      text: '双方尚无可明确比较的每日投入时长。不能从年龄、专业或在职状态推算时间与基础。',
    };
  return {
    status: author.value === user.value ? 'similar' : 'different',
    quote: author.quote,
    userQuote: user.quote,
    text: `片段写明每天${author.value}小时，你提供的是每天${user.value}小时。${author.value === user.value ? '仅这一项数值相同，不代表整体适配，也不能保证相同结果。' : '投入时长不同，不能直接照搬其完成周期；这不等于判断你无法达成目标。'}`,
  };
}

export const TIME_QUESTION = '你每天可以明确投入多少小时？';
export function timeQuestion(source, profile) {
  const author = dailyHours(source.snippets.join('\n'));
  if (
    !author ||
    userHours(profile) ||
    profile.time?.trim() ||
    profile.conditionAnswers?.daily_time?.trim() ||
    Object.keys(profile.answers || {}).some((q) =>
      /时间|时长|小时|投入/.test(q),
    ) ||
    (profile.skipped || []).some((q) => /时间|时长|小时|投入/.test(q))
  )
    return null;
  return {
    question: TIME_QUESTION,
    reason: '片段给出了每日投入时长，需要确认你的可投入时间才能比较。',
    sourceId: source.id,
    quote: author.quote,
    options: ['每天两小时', '每天八小时', '暂时无法确定'],
  };
}
