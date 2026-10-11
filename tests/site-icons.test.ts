import test from 'node:test';
import assert from 'node:assert/strict';
import { browserIconUrl, bundledIcon } from '../src/site-icons';

test('Facebook has an offline, real 32px PNG logo with exact hostname boundaries', () => {
  const source = bundledIcon('facebook.com');
  assert.ok(source?.startsWith('data:image/png;base64,'));
  const png = Buffer.from(source!.split(',')[1], 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  for (const domain of ['www.facebook.com', 'm.facebook.com', 'fb.com', 'FACEBOOK.COM']) assert.equal(bundledIcon(domain), source);
  for (const domain of ['notfacebook.com', 'facebook.com.evil.test', 'reddit.com']) assert.equal(bundledIcon(domain), null);
});

test('Chrome favicon URLs are internal, scoped to the selected hostname, and encoded', () => {
  const url = new URL(browserIconUrl('reddit.com', 'chrome-extension://harbor/'));
  assert.equal(url.protocol, 'chrome-extension:');
  assert.equal(url.host, 'harbor');
  assert.equal(url.pathname, '/_favicon/');
  assert.equal(url.searchParams.get('pageUrl'), 'https://reddit.com/');
  assert.equal(url.searchParams.get('size'), '32');
});
