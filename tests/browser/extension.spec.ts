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

test('one-click categories block groups, preserve individual rules, and protect weakening', async () => {
  await dashboard.setViewportSize({ width: 1280, height: 900 });
  await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
  const social = dashboard.locator('article.category-card[data-category=social]');
  await social.getByText('Preview 35 domains', { exact: true }).click();
  await expect(social.locator('.category-domains')).toContainText('facebook.com');
  await social.getByRole('button', { name: 'Block category: Social media', exact: true }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('Social media');
  await expect(social.getByRole('button', { name: 'Pause category: Social media', exact: true })).toBeVisible();
  for (const category of ['Pornography', 'Betting & gambling']) {
    await dashboard.getByRole('button', { name: `Block category: ${category}`, exact: true }).click();
    await expect(dashboard.locator('#rules-list')).toContainText(category);
  }
  for (const url of ['https://sub.facebook.com/', 'https://pornhub.com/', 'https://bet365.com/']) {
    const blocked = await context.newPage();
    await blocked.goto(url).catch(() => {});
    await expect(blocked).toHaveURL(`chrome-extension://${extensionId}/page.html`);
    await blocked.close();
  }
  await expect(dashboard.locator('#rules-list')).toContainText('example.com');
  const denied = await dashboard.evaluate(async () => {
    const snapshot = await chrome.runtime.sendMessage({ type: 'snapshot' });
    const rule = snapshot.data.settings.rules.find((rule: { kind: string; value: string }) => rule.kind === 'category' && rule.value === 'social');
    return chrome.runtime.sendMessage({ type: 'update-rule', id: rule.id, rule: { ...rule, enabled: false } });
  });
  expect(denied.ok).toBe(false);
  const override = await dashboard.evaluate(async () => chrome.runtime.sendMessage({ type: 'add-rule', rule: { kind: 'domain', value: 'facebook.com', redirect: 'https://quiet.test/', enabled: true } }));
  expect(override.ok).toBe(false);
  await social.getByRole('button', { name: 'Pause category: Social media', exact: true }).click();
  await expect(dashboard.locator('#unlock-dialog')).toBeVisible();
  await dashboard.getByRole('button', { name: 'Keep my boundaries' }).click();
});

test('icons are opt-in, cached locally, never fetched for categories, and keep keyword badges', async () => {
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    const state = globalThis as typeof globalThis & { iconRequests: string[] };
    state.iconRequests = [];
    globalThis.fetch = async (url, options) => {
      state.iconRequests.push(String(url));
      if (options?.credentials !== 'omit' || options.redirect !== 'error') throw new Error('Unsafe icon request');
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
      return new Response(png);
    };
  });
  await dashboard.locator('#rule-value').fill('facebook.com');
  await dashboard.getByRole('button', { name: 'Add boundary' }).click();
  await expect(dashboard.locator('#rules-list')).toContainText('facebook.com');
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length)).toBe(0);
  await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
  await expect(dashboard.locator('#fetch-favicons')).not.toBeChecked();
  await dashboard.locator('#fetch-favicons').check();
  await expect(dashboard.locator('#notice')).toContainText('fetching enabled');
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length)).toBe(0);
  await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
  await expect(dashboard.locator('.rule-row').filter({ hasText: 'facebook.com' }).locator('.rule-badge img')).toBeVisible();
  await expect(dashboard.locator('.rule-row').filter({ hasText: 'sudoku' }).locator('.rule-badge')).toHaveText('#');
  const firstRequests = await worker.evaluate(() => [...(globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests]);
  expect(firstRequests).toEqual(['https://example.com/favicon.ico', 'https://facebook.com/favicon.ico']);
  const stored = await dashboard.evaluate(async () => chrome.storage.local.get('favicons'));
  expect((stored.favicons as Record<string, { data: string }>)['facebook.com'].data).toMatch(/^data:image\/png;base64,/);
  await dashboard.reload();
  await expect(dashboard.locator('.rule-row').filter({ hasText: 'facebook.com' }).locator('.rule-badge img')).toBeVisible();
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length)).toBe(firstRequests.length);
  await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
  await dashboard.locator('#fetch-favicons').uncheck();
  await expect(dashboard.locator('#notice')).toContainText('Saved icons cleared');
  expect(await dashboard.evaluate(async () => (await chrome.storage.local.get('favicons')).favicons)).toEqual({});
  await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
  await expect(dashboard.locator('.rule-badge img')).toHaveCount(0);
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length)).toBe(firstRequests.length);
});

test('re-rendering more icons than the durable cache holds does not repeat requests', async () => {
  const worker = context.serviceWorkers()[0];
  await dashboard.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const result = await chrome.runtime.sendMessage({ type: 'add-rule', rule: { kind: 'domain', value: `icon${i}.example.org`, redirect: '', enabled: true } });
      if (!result.ok) throw new Error(result.error);
    }
    await chrome.runtime.sendMessage({ type: 'set-icon-fetch', enabled: true });
  });
  await dashboard.reload();
  await expect(dashboard.locator('.rule-badge img')).toHaveCount(52);
  const count = await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length);
  const persisted = await dashboard.evaluate(async () => (await chrome.storage.local.get('favicons')).favicons);
  expect(Object.keys(persisted as Record<string, unknown>)).toHaveLength(48);
  for (let i = 0; i < 3; i++) {
    await dashboard.getByRole('button', { name: 'Your boundaries' }).click();
    await expect(dashboard.locator('.rule-badge img')).toHaveCount(52);
  }
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { iconRequests: string[] }).iconRequests.length)).toBe(count);
});
