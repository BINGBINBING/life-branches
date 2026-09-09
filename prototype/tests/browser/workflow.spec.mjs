import { test, expect } from '@playwright/test';
import { normalizeIntake } from '../../server/intake.mjs';
import { validateAnalysis, validProfile } from '../../server/engine.mjs';

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
    return box.width > window.innerWidth + 1 || box.left < -1 || box.right > window.innerWidth + 1;
  }).map((element) => element.textContent || element.getAttribute('aria-label')));
  expect(clipped).toEqual([]);
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
