const WINDOW_SIZE = 600;
const WINDOW_LIMIT = 4;
const outcome = /获批|录用|入职|未通过|没通过|被拒|放弃|转入后|转专业后|转行后|offer/i;
const action = /申请|投递|补修|自学|学习|练习|训练营|作品|项目|竞聘|面试|笔试/;

export function analysisExcerpts(snippets) {
  const windows = [];
  for (const [sourceIndex, text] of (snippets || []).entries()) {
    if (typeof text !== 'string' || !text.trim()) continue;
    // Each candidate remains one contiguous piece of returned text.
    for (const match of text.matchAll(/[^\n]+/g)) {
      for (let start = match.index; start < match.index + match[0].length; start += WINDOW_SIZE) {
        const quote = text.slice(start, Math.min(start + WINDOW_SIZE, match.index + match[0].length));
        windows.push({ quote, sourceIndex, start, priority: outcome.test(quote) ? 2 : action.test(quote) ? 1 : 0 });
      }
    }
  }
  if (!windows.length) return [];
  const selected = [windows[0]];
  const seen = new Set([windows[0].quote]);
  const candidates = windows.slice(1);
  const ranked = [
    candidates.find((item) => item.priority === 1),
    candidates.find((item) => item.priority === 2),
    ...candidates.sort((a, b) => b.priority - a.priority || a.sourceIndex - b.sourceIndex || a.start - b.start),
  ].filter(Boolean);
  for (const candidate of ranked) {
    if (seen.has(candidate.quote)) continue;
    selected.push(candidate);
    seen.add(candidate.quote);
    if (selected.length === WINDOW_LIMIT) break;
  }
  return selected.sort((a, b) => a.sourceIndex - b.sourceIndex || a.start - b.start).map((item) => item.quote);
}
