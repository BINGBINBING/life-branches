function normalized(value) {
  return String(value || '').replace(/[\s，。！？、；：“”‘’（）【】]/g, '').toLowerCase();
}

function grams(value) {
  return new Set(Array.from({ length: Math.max(0, value.length - 3) }, (_, i) => value.slice(i, i + 4)));
}

function sameStory(a, b) {
  const left = normalized(a.snippets.join('\n'));
  const right = normalized(b.snippets.join('\n'));
  if (Math.min(left.length, right.length) < 120) return false;
  if (left === right) return true;
  if (!a.author || a.author === '作者信息未返回' || a.author !== b.author || normalized(a.title) !== normalized(b.title)) return false;
  // Preserve differences that can reverse an outcome or change a constraint.
  const signature = (text) => (text.match(/-?\d+(?:\.\d+)?%?|不|没|未|无|非|失败|成功|拒绝/g) || []).join('|');
  if (signature(left) !== signature(right)) return false;
  const x = grams(left);
  const y = grams(right);
  const intersection = [...x].filter((gram) => y.has(gram)).length;
  return intersection / (x.size + y.size - intersection) >= 0.98;
}

export function markDuplicateSources(sources) {
  const unique = [];
  return sources.map((source) => {
    const primary = unique.find((item) => sameStory(item, source));
    if (primary) return { ...source, duplicateOf: primary.id };
    unique.push(source);
    return source;
  });
}
