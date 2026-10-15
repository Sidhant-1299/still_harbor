import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('a copied Colab notebook URL can be added without blocking other notebooks', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(path.join(tmpdir(), 'still-harbor-url-'));
  const extension = path.resolve('dist');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    // Mock all notebook responses: never request the user's actual document.
    await context.route('https://**colab.research.google.com/**', route => route.fulfill({ body: '<h1>Notebook</h1>', contentType: 'text/html' }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    const notebook = 'colab.research.google.com/drive/1HpQp8R7Uwm2UKgxKfAlAv96rBpZBOINv';
    await dashboard.locator('#rule-kind').selectOption('url');
    await dashboard.locator('#rule-value').fill(notebook);
    await dashboard.getByRole('button', { name: 'Add boundary' }).click();
    await expect(dashboard.locator('#notice')).not.toHaveClass(/error/);
    await expect(dashboard.locator('#rules-list')).toContainText(notebook.toLowerCase());
    const native = await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
    expect(native.length).toBeGreaterThan(0);
    expect(native.every(rule => rule.condition.requestDomains?.includes('colab.research.google.com'))).toBe(true);
    const blocked = await context.newPage();
    const quiet = `chrome-extension://${id}/page.html`;
    for (const suffix of ['', '/', '/child', '?authuser=0', '#scrollTo=example']) {
      await blocked.goto(`https://${notebook}${suffix}`).catch(() => {});
      await expect(blocked).toHaveURL(quiet);
    }
    const encodedPath = [...new URL(`https://${notebook}`).pathname].map(char => char === '/' ? '/' : `%${char.charCodeAt(0).toString(16)}`).join('');
    for (const pathname of [encodedPath, `/drive/%31HpQp8R7Uwm2UKgxKfAlAv96rBpZBOINv`, `/other%2F..%2Fdrive%2F1HpQp8R7Uwm2UKgxKfAlAv96rBpZBOINv`]) {
      await blocked.goto(`https://colab.research.google.com${pathname}`).catch(() => {});
      await expect(blocked).toHaveURL(quiet);
    }
    const allowed = await context.newPage();
    for (const url of ['https://colab.research.google.com/', 'https://colab.research.google.com/drive/another-notebook', `https://${notebook}-other`, `https://${notebook}x`]) {
      await allowed.goto(url);
      await expect(allowed).toHaveURL(url);
      await expect(allowed.getByRole('heading', { name: 'Notebook' })).toBeVisible();
    }
    const snapshot = await dashboard.evaluate(() => chrome.runtime.sendMessage({ type: 'snapshot' }));
    expect(snapshot.data.settings.rules).toHaveLength(1);
    await dashboard.reload();
    await expect(dashboard.locator('#rules-list')).toContainText(notebook.toLowerCase());
    // Adding the equivalent URL with a scheme must be detected as a duplicate.
    const duplicate = await dashboard.evaluate(value => chrome.runtime.sendMessage({ type: 'add-rule', rule: { kind: 'url', value, enabled: true, redirect: '' } }), `https://${notebook}`);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toContain('already exists');
    const loop = await dashboard.evaluate(value => chrome.runtime.sendMessage({ type: 'add-rule', rule: { kind: 'domain', value: 'redirect-loop.test', enabled: true, redirect: value } }), `https://colab.research.google.com${encodedPath}`);
    expect(loop.ok).toBe(false);
    expect(loop.error).toContain('avoid a loop');

    const details = await context.newPage();
    await details.goto(`chrome://extensions/?id=${id}`);
    await details.locator('extensions-toolbar #devMode').check();
    await details.locator('#allow-incognito cr-toggle').click();
    await expect(details.locator('#allow-incognito cr-toggle')).toHaveAttribute('checked', '');
    const privateContext = await context.browser()!.newContext();
    try {
      await privateContext.route('https://**colab.research.google.com/**', route => route.fulfill({ body: '<h1>Private notebook</h1>', contentType: 'text/html' }));
      const privatePage = await privateContext.newPage();
      for (const url of [`https://${notebook}`, `https://colab.research.google.com${encodedPath}`]) {
        await privatePage.goto(url).catch(() => {});
        await expect(privatePage).toHaveURL(quiet);
        await expect(privatePage.getByRole('heading', { name: 'You can just be here.' })).toBeVisible();
        expect(await privatePage.evaluate(() => chrome.extension.inIncognitoContext)).toBe(true);
      }
    } finally { await privateContext.close(); }
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
