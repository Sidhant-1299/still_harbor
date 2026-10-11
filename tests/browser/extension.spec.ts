import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

// One end-to-end journey through a shared, isolated extension installation.
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let profile: string;
let extensionId: string;
let dashboard: Page;

test.beforeAll(async () => {
  profile = await mkdtemp('/tmp/opencode/still-harbor-test-');
  const extension = path.resolve('dist');
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  // CI has no unlocked desktop session; simulate active idle state only.
  await worker.evaluate(() => { chrome.idle.queryState = async () => 'active' as const; });
  extensionId = new URL(worker.url()).host;
  dashboard = await context.newPage();
  await dashboard.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
});
test.afterAll(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

test('empty dashboard, domain rules and native redirects', async () => {
  await expect(dashboard.getByRole('heading', { name: 'A boundary, not a barrier.' })).toBeVisible();
  await dashboard.locator('#rule-value').fill('example.com');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('example.com');
  const tab = await context.newPage();
  await tab.goto('https://sub.example.com/').catch(() => {});
  await expect(tab).toHaveURL(`chrome-extension://${extensionId}/page.html`);
  await expect(tab.getByRole('heading', { name: 'You can just be here.' })).toBeVisible();
  await tab.close();
});

test('keyword substrings, encoded paths, and loop rejection', async () => {
  await dashboard.bringToFront();
  await dashboard.locator('#rule-kind').selectOption('keyword');
  await dashboard.locator('#rule-value').fill('sudoku');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('sudoku');
  for (const url of ['https://google.com/sudokus', 'https://google.com/%73udoku', 'https://google.com/search?q=learn+sudokus', 'https://google.com/search?%71=sudoku', 'https://google.com/%53%55%44%4F%4B%55']) {
    const tab = await context.newPage();
    await tab.goto(url).catch(() => {});
    await expect(tab).toHaveURL(`chrome-extension://${extensionId}/page.html`);
    await tab.close();
  }
  for (const url of ['https://google.com/sudoky', 'https://google.com.evil.test/?q=sudoku', 'https://google.com/?other=https://site.test?q=sudoku']) {
    const allowed = await context.newPage();
    await allowed.route('**/*', route => route.fulfill({ body: '<h1>Allowed</h1>', contentType: 'text/html' }));
    await allowed.goto(url);
    await expect(allowed).toHaveURL(url);
    await expect(allowed.getByRole('heading', { name: 'Allowed' })).toBeVisible();
    await allowed.close();
  }
  await dashboard.locator('#rule-kind').selectOption('domain');
  await dashboard.locator('#rule-value').fill('noise.test');
  await dashboard.locator('#rule-redirect').fill('example.com');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#notice')).toContainText('avoid a loop');
  await dashboard.locator('#rule-redirect').fill('https://quiet.test/');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('noise.test');
  const tab = await context.newPage();
  await tab.route('https://quiet.test/**', route => route.fulfill({ body: '<h1>Quiet destination</h1>', contentType: 'text/html' }));
  await tab.goto('https://noise.test/').catch(() => {});
  await expect(tab).toHaveURL('https://quiet.test/');
  await tab.close();
});

test('long keyword fallback and enforcement on an already-open tab', async () => {
  await dashboard.bringToFront();
  await dashboard.locator('#rule-kind').selectOption('keyword');
  await dashboard.locator('#rule-value').fill('social media');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('social media');
  const search = await context.newPage();
  await search.goto('https://google.com/search?q=social+media').catch(() => {});
  await expect(search).toHaveURL(`chrome-extension://${extensionId}/page.html`);
  await search.close();
  const open = await context.newPage();
  await open.route('https://existing.test/**', route => route.fulfill({ body: '<h1>Already open</h1>', contentType: 'text/html' }));
  await open.goto('https://existing.test/');
  await dashboard.bringToFront();
  await dashboard.locator('#rule-kind').selectOption('domain');
  await dashboard.locator('#rule-value').fill('existing.test');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(open).toHaveURL(`chrome-extension://${extensionId}/page.html`);
  await open.close();
});

test('optional password, authoritative weakening protection, unlock and lock', async () => {
  await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
  await expect(dashboard.getByText('No password recovery.', { exact: true })).toBeVisible();
  await dashboard.locator('#new-password').fill('my quiet password');
  await dashboard.locator('#confirm-password').fill('my quiet password');
  await dashboard.locator('#password-ack').check();
  await dashboard.getByRole('button', { name: 'Enable password protection' }).click();
  await expect(dashboard.locator('#password-status')).toHaveText('Protected');
  const denied = await dashboard.evaluate(async () => chrome.runtime.sendMessage({ type: 'set-enabled', enabled: false }));
  expect(denied.ok).toBe(false);
  expect(denied.error).toContain('Unlock');
  await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
  await dashboard.getByRole('button', { name: 'Pause blocking', exact: true }).click();
  await expect(dashboard.locator('#unlock-dialog')).toBeVisible();
  await dashboard.locator('#unlock-password').fill('not the password');
  await dashboard.getByRole('button', { name: 'Unlock for 5 minutes' }).click();
  await expect(dashboard.locator('#unlock-error')).toContainText('Incorrect password');
  await dashboard.locator('#unlock-password').fill('my quiet password');
  await dashboard.getByRole('button', { name: 'Unlock for 5 minutes' }).click();
  await expect(dashboard.locator('#unlock-dialog')).not.toBeVisible();
  await dashboard.getByRole('button', { name: 'Pause blocking', exact: true }).click();
  await expect(dashboard.locator('#blocking-status')).toContainText('paused');
  await dashboard.getByRole('button', { name: 'Resume blocking' }).click();
  await expect(dashboard.locator('#blocking-status')).toContainText('on');
  await dashboard.getByRole('button', { name: 'Lock settings', exact: true }).click();
  const deniedAgain = await dashboard.evaluate(async () => chrome.runtime.sendMessage({ type: 'delete-rule', id: 1 }));
  expect(deniedAgain.ok).toBe(false);
  // Strengthening remains available while locked.
  await dashboard.locator('#rule-value').fill('another.test');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('another.test');
});

test('insights chart, export without verifier, deletion and compact popup', async () => {
  const reading = await context.newPage();
  await reading.route('https://reading.test/**', route => route.fulfill({ body: '<h1>A quiet read</h1>', contentType: 'text/html' }));
  await reading.goto('https://reading.test/');
  await reading.bringToFront();
  await expect.poll(async () => {
    const result = await dashboard.evaluate(async () => chrome.runtime.sendMessage({ type: 'snapshot' }));
    return Object.values(result.data.insights as Record<string, Record<string, number>>).reduce((sum, day) => sum + (day['reading.test'] ?? 0), 0);
  }).toBeGreaterThan(0);
  await dashboard.bringToFront();
  await dashboard.reload();
  await dashboard.getByRole('button', { name: 'Browsing insights' }).click();
  await expect(dashboard.getByRole('heading', { name: 'Where your attention goes.' })).toBeVisible();
  await expect(dashboard.locator('#insights-chart .donut')).toBeVisible();
  await expect(dashboard.locator('#domain-table')).toContainText('reading.test');
  await reading.close();
  await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
  const downloaded = dashboard.waitForEvent('download');
  await dashboard.getByRole('button', { name: 'Export local data · JSON' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^still-harbor-.*\.json$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const data = JSON.parse(Buffer.concat(chunks).toString());
  expect(data.settings.password).toBeUndefined();
  expect(data.settings.rules.length).toBeGreaterThan(0);
  dashboard.once('dialog', dialog => dialog.accept());
  await dashboard.getByRole('button', { name: 'Delete insights', exact: true }).click();
  await expect(dashboard.locator('#notice')).toContainText('cleared');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#boundary-count')).toHaveText('6');
  await popup.getByRole('tab', { name: 'Insights' }).click();
  await expect(popup.locator('#insights-content')).toBeVisible();
  await expect(popup.locator('#popup-chart')).toContainText('fresh start');
  await popup.close();
});

test('dashboard remains usable at mobile width', async () => {
  await dashboard.setViewportSize({ width: 390, height: 844 });
  await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
  await expect(dashboard.locator('#rule-form')).toBeVisible();
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
