import test from 'node:test';
import assert from 'node:assert/strict';
import { FaviconRequests, canFetchIcon, fetchIcon, rasterMime } from '../src/favicons';

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64'));
const signal = () => new AbortController().signal;

test('icon requests omit credentials/referrer, use HTTPS, and refuse redirects', async () => {
  const requests: [string, RequestInit | undefined][] = [];
  const fetcher: typeof fetch = async (url, options) => {
    requests.push([String(url), options]);
    return new Response(PNG);
  };
  const data = await fetchIcon('facebook.com', signal(), fetcher);
  assert.ok(data?.startsWith('data:image/png;base64,'));
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], 'https://facebook.com/favicon.ico');
  assert.equal(requests[0][1]?.credentials, 'omit');
  assert.equal(requests[0][1]?.referrerPolicy, 'no-referrer');
  assert.equal(requests[0][1]?.redirect, 'error');
  assert.equal(requests[0][1]?.cache, 'no-store');
});

test('a missing root icon tries only the same domain’s www host', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async url => {
    urls.push(String(url));
    return urls.length === 1 ? new Response('', { status: 404 }) : new Response(PNG);
  };
  assert.ok(await fetchIcon('facebook.com', signal(), fetcher));
  assert.deepEqual(urls, ['https://facebook.com/favicon.ico', 'https://www.facebook.com/favicon.ico']);
  let calls = 0;
  assert.equal(await fetchIcon('www.facebook.com', signal(), async () => { calls++; return new Response('', { status: 404 }); }), null);
  assert.equal(calls, 1);
});

test('HTML/SVG and oversized responses are rejected; raster signatures are recognized', async () => {
  for (const content of ['<html>error</html>', '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.test/"/></svg>']) {
    assert.equal(await fetchIcon('facebook.com', signal(), async () => new Response(content)), null);
  }
  assert.equal(await fetchIcon('facebook.com', signal(), async () => new Response(new Uint8Array(32769))), null);
  assert.equal(await fetchIcon('facebook.com', signal(), async () => new Response(PNG, { headers: { 'content-length': '999999' } })), null);
  assert.equal(rasterMime(new Uint8Array([0, 0, 1, 0, 1, 0])), 'image/x-icon');
  assert.equal(rasterMime(new Uint8Array([255, 216, 255])), 'image/jpeg');
  assert.equal(rasterMime(new Uint8Array([71, 73, 70, 56, 57, 97])), 'image/gif');
  assert.equal(rasterMime(PNG), 'image/png');
});

test('local/intranet names and IP literals are never probed', async () => {
  for (const domain of ['localhost', '127.0.0.1', '192.168.1.1', '8.8.8.8', '[::1]', 'router.local', 'home.internal', 'site.test', 'site.invalid', 'site.example']) {
    assert.equal(canFetchIcon(domain), false);
    assert.equal(await fetchIcon(domain, signal(), async () => { throw new Error('Must not fetch'); }), null);
  }
});

test('only in-flight requests coalesce; completed icons are not cached', async () => {
  let calls = 0;
  const cache = new FaviconRequests(() => true, async () => { calls++; return new Response(PNG); });
  const [first, second] = await Promise.all([cache.get('facebook.com'), cache.get('facebook.com')]);
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.ok(first?.startsWith('data:image/png;base64,'));
  await cache.get('facebook.com');
  assert.equal(calls, 2);
});

test('opt-out prevents networking and even failures are not cached', async () => {
  let enabled = false;
  let calls = 0;
  const cache = new FaviconRequests(() => enabled, async () => { calls++; return new Response('', { status: 404 }); });
  assert.equal(await cache.get('facebook.com'), null);
  assert.equal(calls, 0);
  enabled = true;
  assert.equal(await cache.get('facebook.com'), null);
  assert.equal(calls, 2);
  await cache.get('facebook.com');
  assert.equal(calls, 4);
});

test('opt-out cancels in-flight requests without returning an image', async () => {
  let began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const cache = new FaviconRequests(() => true, async (_url, options) => {
    began();
    await new Promise<void>((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    return new Response(PNG);
  });
  const pending = cache.get('facebook.com');
  await started;
  await cache.clear();
  assert.equal(await pending, null);
});

test('icon requests are limited to three simultaneous fetches', async () => {
  let active = 0;
  let peak = 0;
  const requests = new FaviconRequests(() => true, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active--;
    return new Response(PNG);
  });
  await Promise.all(Array.from({ length: 10 }, (_, i) => requests.get(`icon${i}.com`)));
  assert.equal(peak, 3);
});
