import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('Incognito permission, blocking, live updates and private-data isolation', async () => {
  test.setTimeout(120000);
  const profile = await mkdtemp(path.join(tmpdir(), 'still-harbor-private-'));
  const extension = path.resolve('dist');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    let dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
    await expect(dashboard.locator('#incognito-status')).toHaveText('Not allowed in Incognito');

    const detailsPromise = context.waitForEvent('page');
    await dashboard.locator('#enable-incognito').click();
    const details = await detailsPromise;
    await expect(details).toHaveURL(`chrome://extensions/?id=${id}`);
    await details.locator('extensions-toolbar #devMode').check();
    await details.locator('#allow-incognito cr-toggle').click();
    await expect(details.locator('#allow-incognito cr-toggle')).toHaveAttribute('checked', '');
    // Chrome reloads the extension and closes its pages when access changes.
    dashboard = await context.newPage();
    await expect(async () => {
      await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
      await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    }).toPass({ timeout: 15000 });
    await expect.poll(() => dashboard.evaluate(() => chrome.extension.isAllowedIncognitoAccess())).toBe(true);
    await dashboard.getByRole('button', { name: 'Settings & privacy' }).click();
    await expect(dashboard.locator('#incognito-status')).toHaveText('Allowed in Incognito');

    const add = async (kind: string, value: string, redirect = '') => {
      const response = await dashboard.evaluate(async rule => chrome.runtime.sendMessage({ type: 'add-rule', rule }), { kind, value, redirect, enabled: true });
      expect(response.ok, response.error).toBe(true);
    };
    await add('domain', 'example.com');
    await add('url', 'example.org/private-path');
    await add('keyword', 'chess');
    await add('keyword', 'social media');
    await add('category', 'social');
    await add('domain', 'redirect.test', 'https://example.net/');

    const privateContext = await context.browser()!.newContext();
    const privatePage = await privateContext.newPage();
    await privatePage.goto(`chrome-extension://${id}/page.html`);
    const privateWorker = privateContext.serviceWorkers()[0] || await privateContext.waitForEvent('serviceworker');
    expect(await privateWorker.evaluate(() => chrome.extension.inIncognitoContext)).toBe(true);
    const visit = async (url: string, expected: string) => {
      await privatePage.goto(url).catch(() => {});
      await expect(privatePage).toHaveURL(expected);
    };
    const quiet = `chrome-extension://${id}/page.html`;
    for (const url of ['https://example.com/', 'https://sub.example.com/', 'https://example.org/private-path/child', 'https://example.net/chess', 'https://example.net/%63hess', 'https://google.com/search?q=chess', 'https://google.com/search?q=social+media', 'https://instagram.com/']) {
      await visit(url, quiet);
    }
    await visit('https://redirect.test/', 'https://example.net/');
    await visit('https://example.org/allowed', 'https://example.org/allowed');
    await add('url', 'example.org/allowed');
    await expect(privatePage).toHaveURL(quiet);
    // SPA history changes must use the fallback in the private worker too.
    await privatePage.route('https://spa.test/**', route => route.fulfill({ body: '<h1>SPA</h1>', contentType: 'text/html' }));
    await add('url', 'spa.test/blocked');
    await visit('https://spa.test/allowed', 'https://spa.test/allowed');
    await privatePage.evaluate(() => history.pushState({}, '', '/blocked/child'));
    await expect(privatePage).toHaveURL(quiet);

    // Settings/exports cannot be requested by private extension pages, and no
    // private activity is written even when its heartbeat is explicitly fired.
    expect(await privatePage.evaluate(() => chrome.extension.inIncognitoContext)).toBe(true);
    const denied = await privatePage.evaluate(() => chrome.runtime.sendMessage({ type: 'snapshot' }));
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('regular window');
    const mutation = await privatePage.evaluate(() => chrome.runtime.sendMessage({ type: 'set-enabled', enabled: false }));
    expect(mutation.ok).toBe(false);
    const popup = await privateContext.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.locator('#current-domain')).toContainText('Private browsing is not recorded');
    await expect(popup.locator('#insights-tab')).toBeHidden();
    await expect(popup.locator('#block-current')).toBeHidden();
    await popup.locator('#open-dashboard').click();
    await expect(popup.locator('#notice')).toContainText('regular Chrome window');
    await popup.close();
    // The shared pause switch must affect private native rules and fallbacks.
    expect((await dashboard.evaluate(() => chrome.runtime.sendMessage({ type: 'set-enabled', enabled: false }))).ok).toBe(true);
    await privatePage.route('https://example.com/**', route => route.fulfill({ body: '<h1>Paused</h1>', contentType: 'text/html' }));
    await visit('https://example.com/', 'https://example.com/');
    expect((await dashboard.evaluate(() => chrome.runtime.sendMessage({ type: 'set-enabled', enabled: true }))).ok).toBe(true);
    await expect(privatePage).toHaveURL(quiet);
    const before = await dashboard.evaluate(() => chrome.storage.local.get('insights'));
    const sessionBefore = await dashboard.evaluate(() => chrome.storage.session.get(['activity', 'unlockedUntil', 'failedAttempts', 'retryAfter']));
    await privatePage.route('https://private-only.test/**', route => route.fulfill({ body: '<h1>Private site</h1>', contentType: 'text/html' }));
    await visit('https://private-only.test/', 'https://private-only.test/');
    await privateWorker.evaluate(async () => chrome.alarms.create('harbor-heartbeat', { when: Date.now() + 100 }));
    await expect.poll(() => privateWorker.evaluate(async () => chrome.alarms.get('harbor-heartbeat'))).toBeUndefined();
    const stored = await dashboard.evaluate(() => chrome.storage.local.get(['insights']));
    expect(JSON.stringify(stored.insights)).not.toContain('private-only.test');
    expect(JSON.stringify(before.insights)).not.toContain('private-only.test');
    expect(stored.insights).toEqual(before.insights);
    expect(await dashboard.evaluate(() => chrome.storage.session.get(['activity', 'unlockedUntil', 'failedAttempts', 'retryAfter']))).toEqual(sessionBefore);
    await privateContext.close();
    await details.locator('#allow-incognito cr-toggle').click();
    const reopened = await context.newPage();
    await expect(async () => {
      await reopened.goto(`chrome-extension://${id}/dashboard.html`);
      await expect(reopened.locator('#blocking-status')).toContainText('Blocking is on');
    }).toPass({ timeout: 15000 });
    await reopened.getByRole('button', { name: 'Settings & privacy' }).click();
    await expect(reopened.locator('#incognito-status')).toHaveText('Not allowed in Incognito');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
