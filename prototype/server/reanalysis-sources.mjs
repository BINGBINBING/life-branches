export function reanalysisSources(input) {
  if (!Array.isArray(input) || !input.length || input.length > 250) throw new Error('来源数量不正确。');
  const ids = new Set();
  return input.map((item) => {
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || !(url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com')) || url.username || url.password) throw new Error('仅接受知乎来源。');
    if (typeof item.id !== 'string' || !/^S\d+$/.test(item.id) || ids.has(item.id)) throw new Error('来源编号不正确。');
    ids.add(item.id);
    if (!Array.isArray(item.snippets) || !item.snippets.length || item.snippets.length > 100 || item.snippets.some((s) => typeof s !== 'string' || s.length > 50000)) throw new Error('来源片段不正确。');
    return { id: item.id, url: url.href, title: String(item.title || '').slice(0, 500), author: String(item.author || '').slice(0, 200), badge: String(item.badge || '').slice(0, 200), snippets: item.snippets, contentBasis: 'search_excerpt' };
  });
}
