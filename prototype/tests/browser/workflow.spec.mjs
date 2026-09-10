import { test, expect } from '@playwright/test';
import { normalizeIntake } from '../../server/intake.mjs';
import { analyze, validateAnalysis, validProfile } from '../../server/engine.mjs';

const question = '我想校内转专业，从机械专业转入计算机专业，目前大一';
const profile = validProfile({ question, decisionScope: 'major_transition', decisionPath: 'campus_transfer' });
const source = { id: 'S1', title: '虚构转专业经历', url: 'https://www.zhihu.com/question/1/answer/1', author: '测试作者', snippets: ['我补修了数学先修课程，我每天学习8小时，我现在大二，现在第3学期，GPA3.6/4.0，我每周学习40小时'] };
const raw = { paths: [{ cases: [{ sourceId: 'S1', action: { text: '补修先修课程', quote: '我补修了数学先修课程' }, conditionEvidence: [
  { conditionId: 'daily_time', quote: '我每天学习8小时' },
  { conditionId: 'current_stage', quote: '我现在大二' },
  { conditionId: 'current_term', quote: '现在第3学期' },
  { conditionId: 'gpa_value', quote: 'GPA3.6/4.0' },
  { conditionId: 'weekly_hours', quote: '我每周学习40小时' },
] }] }] };
const job = { id: 'test-job', status: 'done', createdAt: Date.now(), profile, sources: [source], result: validateAnalysis(raw, [source], profile), metrics: { searchCalls: 0, stages: [] }, officialSources: [], officialAssessment: null };

async function assertFits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const clipped = await page.locator('button:visible, input:visible, textarea:visible, select:visible').evaluateAll((elements) => elements.filter((element) => {
    const box = element.getBoundingClientRect();
    // Horizontally scrollable navigation may intentionally contain offscreen items.
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) {
        const container = parent.getBoundingClientRect();
        if (container.left >= 0 && container.right <= window.innerWidth && box.width <= container.width) return false;
      }
    }
    return box.width > window.innerWidth + 1 || box.left < -1 || box.right > window.innerWidth + 1;
  }).map((element) => element.textContent || element.getAttribute('aria-label')));
  expect(clipped).toEqual([]);
}

for (const width of [1440, 360]) {
  test(`action branches and reviewed evidence remain distinct at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const second = { ...source, id: 'S2', title: '虚构申请材料经历', url: 'https://www.zhihu.com/question/1/answer/2',
      snippets: ['我整理并提交了转专业申请材料，最终转专业申请获批'] };
    const candidates = structuredClone(raw);
    candidates.paths[0].cases.push({ sourceId: 'S2', action: {
      text: '整理并提交申请材料', quote: '我整理并提交了转专业申请材料',
    } });
    let calls = 0;
    const result = await analyze([source, second], profile, () => {}, { ask: async (prompt) => {
      if (++calls === 1) return { value: candidates };
      const items = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
      return { value: { reviews: items.map((item) => ({ id: item.id, supported: true, contentType: item.field === 'action' ? 'actual_action' : item.field })) } };
    } });
    expect(result.paths.length).toBe(2);
    let captured;
    await page.route('**/api/branches/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/diagnostic-snapshot')) captured = route.request().postDataJSON();
      await route.fulfill({ json: path.endsWith('/health') ? { archive: false, developerTools: true }
        : path.endsWith('/researches') ? { records: [] }
        : path.endsWith('/intake') ? normalizeIntake(question)
        : path.endsWith('/explore') ? { id: job.id }
        : path.includes('/jobs/') ? { ...job, sources: [source, second], result } : {} });
    });
    const ready = page.waitForResponse((response) => response.url().endsWith('/api/branches/health'));
    await page.goto('/');
    await ready;
    await page.getByRole('textbox').first().fill(question);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await page.getByRole('button', { name: '确认并搜索知乎' }).click();
    const dialog = page.getByRole('dialog', { name: '补充本次研究的条件' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '保存诊断快照', exact: true }).click();
    await expect(page.locator('.diagnostic-capture output')).toContainText('诊断快照已保存到本地');
    expect(captured.researchId).toBe(job.id);
    expect(captured.dialogs.some((item) => item.open)).toBe(true);
    expect(captured.profile).toBeUndefined();
    await dialog.getByRole('button', { name: '查看相关经历' }).first().click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('article.experience.focused')).toHaveCount(1);
    const navigation = page.getByRole('navigation', { name: '行动路径' });
    await expect(navigation.getByRole('button')).toHaveCount(2);
    await navigation.getByRole('button').nth(1).click();
    await page.locator('article.experience details').first().evaluate((element) => { element.open = true; });
    await page.evaluate(() => window.scrollTo(0, 650));
    const position = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: '保存诊断快照', exact: true }).click();
    await expect.poll(() => captured.scroll.y).toBe(position);
    expect(captured.selectedPathId).toBe(result.paths[1].id);
    expect(captured.details.some((item) => item.open)).toBe(true);
    await page.screenshot({ path: info.outputPath('diagnostic-snapshot.png') });
    await page.locator('article.experience details').first().evaluate((element) => { element.open = false; });
    const card = page.locator('article.experience');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('heading', { name: second.title })).toBeVisible();
    await expect(card.getByText('整理并提交申请材料', { exact: true })).toBeVisible();
    await expect(page.locator('.insight-grid').getByText('整理并提交申请材料', { exact: true })).toBeVisible();
    await expect(card.getByText('AI 总结，已通过模型证据复核，仍需人工判断')).toBeVisible();
    const evidence = card.locator('.experience-facts > div').nth(1);
    await expect(evidence.locator('blockquote')).not.toBeVisible();
    await evidence.locator('summary').click();
    await expect(evidence.locator('blockquote')).toHaveText('我整理并提交了转专业申请材料');
    await assertFits(page);
    await page.screenshot({ path: info.outputPath('reviewed-evidence.png'), fullPage: true });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
  test(`initial form, results and dynamic dialog at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const errors = [];
    const requests = [];
    let currentJob = job;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/branches/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const payload = request.method() === 'POST' ? request.postDataJSON() : null;
      requests.push({ path, method: request.method(), payload });
      if (path.endsWith('/explore')) currentJob = { ...job, profile: payload.profile, result: validateAnalysis(raw, [source], payload.profile) };
      const value = path.endsWith('/health') ? { archive: false, developerTools: false }
        : path.endsWith('/researches') ? { records: [] }
        : path.endsWith('/intake') ? { ...normalizeIntake(question), generatedBy: 'test' }
        : path.endsWith('/explore') ? { id: job.id }
        : path.includes('/jobs/') ? currentJob : {};
      await route.fulfill({ json: value });
    });
    const ready = page.waitForResponse((response) => response.url().endsWith('/api/branches/health'));
    await page.goto('/');
    await ready;
    await page.getByRole('textbox').first().fill(question);
    await assertFits(page);
    await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认并搜索知乎' })).toBeVisible();
    expect(requests.some((item) => item.path.endsWith('/explore'))).toBe(false);
    await assertFits(page);
    await page.screenshot({ path: info.outputPath('initial-form.png'), fullPage: true });
    await page.getByRole('button', { name: '确认并搜索知乎' }).click();
    const dialog = page.getByRole('dialog', { name: '补充本次研究的条件' });
    await expect(dialog).toBeVisible();
    expect(await dialog.getByRole('textbox').count()).toBeGreaterThan(1);
    await assertFits(page);
    await page.screenshot({ path: info.outputPath('dynamic-dialog.png') });
    await dialog.getByRole('textbox').first().fill('测试大学');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await assertFits(page);
    const contentLefts = await page.locator('.experience-facts > div').nth(1).locator(':scope > :not(h4)').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
    expect(new Set(contentLefts).size).toBe(1);
    await page.screenshot({ path: info.outputPath('results.png'), fullPage: true });
    await expect(page.locator('.experience-facts').getByText('暂未形成可靠归纳').first()).toBeVisible();
    await expect(page.locator('.insight-grid .insight')).toHaveCount(0);
    await expect(page.locator('.experience-facts').getByText(source.snippets[0], { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /补充 \d+ 项条件/ }).click();
    await expect(dialog.getByRole('textbox').first()).toHaveValue('测试大学');
    expect(requests.filter((item) => item.path.endsWith('/explore')).length).toBe(1);
    await dialog.getByRole('textbox').nth(1).fill('2小时');
    await dialog.getByRole('button', { name: '更新条件对照' }).click();
    await expect.poll(() => requests.filter((item) => item.path.endsWith('/explore')).length).toBe(2);
    const update = requests.filter((item) => item.path.endsWith('/explore')).at(-1).payload;
    expect(update.previousId).toBe(job.id);
    expect(update.profile.conditionAnswers.institution_name).toBe('测试大学');
    expect(Object.values(update.profile.answers)).toContain('2小时');
    expect(errors).toEqual([]);
  });
}
