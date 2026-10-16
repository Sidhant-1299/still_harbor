import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('dashboard remains editable when Chrome has no last-focused window', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'still-harbor-activity-'));
  const extension = path.resolve('dist');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    // Reproduce the exact API rejection without closing the test's own window.
    await worker.evaluate(() => {
      const original = chrome.windows.getLastFocused;
      Object.assign(globalThis, { restoreActivityWindow: () => { chrome.windows.getLastFocused = original; } });
      chrome.windows.getLastFocused = (async () => { throw new Error('No last-focused window'); }) as typeof original;
    });
    await dashboard.reload();
    await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    await dashboard.locator('#rule-value').fill('noise.test');
    await dashboard.getByRole('button', { name: 'Add boundary', exact: true }).click();
    await expect(dashboard.locator('#rules-list')).toContainText('noise.test');
    await dashboard.getByRole('button', { name: 'Destination: noise.test', exact: true }).click();
    await dashboard.locator('#edit-redirect').fill('https://quiet.test/');
    await dashboard.getByRole('button', { name: 'Save destination' }).click();
    await expect(dashboard.locator('#edit-dialog')).not.toBeVisible();
    await expect(dashboard.locator('#rules-list')).toContainText('https://quiet.test/');
    await dashboard.getByRole('button', { name: 'Pause: noise.test', exact: true }).click();
    await expect(dashboard.getByRole('button', { name: 'Enable: noise.test', exact: true })).toBeVisible();
    await dashboard.reload();
    await expect(dashboard.locator('#rules-list')).toContainText('https://quiet.test/');
    await dashboard.getByRole('button', { name: 'Remove: noise.test', exact: true }).click();
    await dashboard.getByRole('button', { name: 'Remove boundary', exact: true }).click();
    await expect(dashboard.locator('#rules-list')).not.toContainText('noise.test');
    expect(await worker.evaluate(async () => (await chrome.storage.session.get('activity')).activity)).toBeNull();
    await worker.evaluate(() => {
      (globalThis as typeof globalThis & { restoreActivityWindow: () => void }).restoreActivityWindow();
    });
    await dashboard.reload();
    await expect(dashboard.locator('#blocking-status')).toContainText('Blocking is on');
    await expect(dashboard.locator('#notice')).not.toHaveClass(/error/);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
