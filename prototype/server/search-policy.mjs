export function searchStopReason(counts, limit = 5) {
  if (counts.length >= limit) return '已达到本次搜索轮数上限；未找到的经历不代表不存在。';
  if (counts.length >= 3 && counts.at(-1) === counts.at(-2) && counts.at(-2) === counts.at(-3))
    return '连续两轮没有新增有效来源，停止重复检索；这不代表信息已经完整。';
  return '';
}
