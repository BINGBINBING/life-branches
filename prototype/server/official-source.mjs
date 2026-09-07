import { load } from 'cheerio';
import { lookup } from 'node:dns/promises';

const allowedHost = (hostname) =>
  hostname.endsWith('.edu.cn') || hostname.endsWith('.gov.cn');

export function classifyOfficialMaterial(text) {
  const value = String(text || '');
  return [
    /培养方案|课程设置|教学计划/.test(value) && '培养方案',
    /名额|接收人数|招生计划/.test(value) && '接收名额',
    /考核|笔试|面试|材料审核/.test(value) && '考核办法',
    /通知|公告|申请安排/.test(value) && '当年通知',
  ].filter(Boolean);
}

export function validateOfficialUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('官方通知链接格式不正确。');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !allowedHost(url.hostname)
  )
    throw new Error('官方通知链接仅支持学校或政府的 HTTPS 地址。');
  return url;
}

function extractHtml(html, url) {
  const $ = load(html);
  $('script, style, nav, footer, header, form, noscript').remove();
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();
  const text = ($('main, article').first().text() || $('body').text())
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40000);
  if (text.length < 80) throw new Error('官方页面正文过短，暂时无法核对。');
  return {
    id: 'O1',
    kind: 'official',
    title: title || '学校或政府官方通知',
    url: url.href,
    host: url.hostname,
    retrievedAt: new Date().toISOString(),
    years: [...new Set(text.match(/20\d{2}/g) || [])].slice(0, 6),
    documentTypes: classifyOfficialMaterial(`${title}\n${text}`),
    excerpt: text.slice(0, 1200),
    text,
  };
}

function linkedOfficialDocuments(html, baseUrl) {
  const $ = load(html);
  const links = [];
  $('a[href]').each((_index, element) => {
    const title = $(element).text().replace(/\s+/g, ' ').trim();
    const href = $(element).attr('href');
    if (
      !href ||
      !/(?:规定|通知|方案|名额|计划|考核|细则)/.test(title)
    )
      return;
    let url;
    try {
      url = validateOfficialUrl(new URL(href, baseUrl).href);
    } catch {
      return;
    }
    if (
      url.hostname !== baseUrl.hostname ||
      !/\.(?:pdf|docx)(?:$|[?#])/i.test(url.href) ||
      links.some((item) => item.url.href === url.href)
    )
      return;
    links.push({ url, title });
  });
  return links.slice(0, 3);
}

function privateAddress(address) {
  return (
    /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(address) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(address) ||
    /^(?:::1|fc|fd|fe80)/i.test(address)
  );
}

export async function verifyPublicHost(url, resolver = lookup) {
  const addresses = await resolver(url.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address)))
    throw new Error('官方通知地址未通过网络安全校验。');
}

export async function extractPdf(buffer, url) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pages = [];
  for (let index = 1; index <= Math.min(document.numPages, 80); index++) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || '').join(' '));
  }
  const text = pages.join('\n').replace(/\s+/g, ' ').trim().slice(0, 40000);
  if (text.length < 80) throw new Error('官方 PDF 正文过短，暂时无法核对。');
  return {
    id: 'O1',
    kind: 'official',
    title: url.pathname.split('/').pop() || '学校或政府官方 PDF',
    url: url.href,
    host: url.hostname,
    retrievedAt: new Date().toISOString(),
    years: [...new Set(text.match(/20\d{2}/g) || [])].slice(0, 6),
    documentTypes: classifyOfficialMaterial(text),
    excerpt: text.slice(0, 1200),
    text,
  };
}

export async function extractDocx(buffer, url, title = '') {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });
  const text = result.value.replace(/\s+/g, ' ').trim().slice(0, 40000);
  if (text.length < 80) throw new Error('官方 Word 正文过短，暂时无法核对。');
  return {
    id: 'O1',
    kind: 'official',
    title: title || url.pathname.split('/').pop() || '学校或政府官方 Word',
    url: url.href,
    host: url.hostname,
    retrievedAt: new Date().toISOString(),
    years: [...new Set(text.match(/20\d{2}/g) || [])].slice(0, 6),
    documentTypes: classifyOfficialMaterial(`${title}\n${text}`),
    excerpt: text.slice(0, 1200),
    text,
  };
}

async function fetchDocument(
  initialUrl,
  fetchImpl,
  resolver,
  pdfExtractor,
  docxExtractor,
  title = '',
) {
  let url = initialUrl;
  for (let redirects = 0; redirects <= 2; redirects++) {
    await verifyPublicHost(url, resolver);
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: {
        accept:
          'text/html,text/plain;q=0.9,application/pdf;q=0.9,application/vnd.openxmlformats-officedocument.wordprocessingml.document;q=0.8',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 2)
        throw new Error('官方通知链接重定向过多。');
      url = validateOfficialUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok)
      throw new Error(`官方通知暂时无法读取（${response.status}）。`);
    const contentType = response.headers.get('content-type') || '';
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > 8 * 1024 * 1024)
      throw new Error('官方材料超过 8MB，暂时无法读取。');
    if (/application\/pdf/i.test(contentType) || /\.pdf$/i.test(url.pathname)) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 8 * 1024 * 1024)
        throw new Error('官方材料超过 8MB，暂时无法读取。');
      return { source: await pdfExtractor(buffer, url), html: '' };
    }
    if (
      /wordprocessingml\.document/i.test(contentType) ||
      /\.docx$/i.test(url.pathname)
    ) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 8 * 1024 * 1024)
        throw new Error('官方材料超过 8MB，暂时无法读取。');
      return {
        source: await docxExtractor(buffer, url, title),
        html: '',
      };
    }
    if (!/text\/html|text\/plain/.test(contentType))
      throw new Error('官方材料格式暂不支持。');
    const html = await response.text();
    return { source: extractHtml(html, url), html };
  }
  throw new Error('官方通知链接重定向过多。');
}

export async function fetchOfficialSources(
  profile,
  fetchImpl = fetch,
  resolver = lookup,
  pdfExtractor = extractPdf,
  docxExtractor = extractDocx,
) {
  const value = profile.conditionAnswers?.policy_link;
  if (profile.decisionScope !== 'major_transition' || !value) return [];
  const url = validateOfficialUrl(value);
  const primary = await fetchDocument(
    url,
    fetchImpl,
    resolver,
    pdfExtractor,
    docxExtractor,
  );
  const sources = [primary.source];
  for (const attachment of linkedOfficialDocuments(primary.html, url)) {
    try {
      const document = await fetchDocument(
        attachment.url,
        fetchImpl,
        resolver,
        pdfExtractor,
        docxExtractor,
        attachment.title,
      );
      sources.push(document.source);
    } catch {
      // A broken attachment must not discard a readable official notice.
    }
  }
  return sources.map((source, index) => ({ ...source, id: `O${index + 1}` }));
}
