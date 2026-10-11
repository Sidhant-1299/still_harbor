import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SEARCH_HOSTS, addTime, createPassword, dayKey, domainMatches, duration, matchedRule, matchesRule, nativeRuleMatches, networkRules, normalizeDomain, normalizeRedirect, pruneInsights, totals, validateRedirects, verifyPassword, type Insights, type Rule } from '../src/core';

// Only enum values are needed to compile native rules outside Chrome.
Object.assign(globalThis, { chrome: { declarativeNetRequest: { RuleActionType: { REDIRECT: 'redirect' }, ResourceType: { MAIN_FRAME: 'main_frame' } } } });
const domain: Rule = { id: 1, kind: 'domain', value: 'example.com', redirect: '', enabled: true };
const keyword: Rule = { ...domain, id: 2, kind: 'keyword', value: 'sudoku' };

test('domains match boundaries, not fuzzy names', () => {
  for (const host of ['example.com', 'www.example.com', 'deep.sub.example.com', 'EXAMPLE.COM', 'example.com.']) assert.ok(domainMatches(host, 'example.com'));
  for (const host of ['example.org', 'notexample.com', 'example.com.evil.test']) assert.equal(domainMatches(host, 'example.com'), false);
  assert.equal(normalizeDomain('HTTPS://WWW.Example.com/'), 'www.example.com');
  assert.equal(normalizeDomain('bücher.de'), 'xn--bcher-kva.de');
  for (const invalid of ['*.example.com', 'example.com/path', 'example.com:8080', 'user@example.com', 'chrome://settings', 'example.com?q=x', 'two words']) assert.throws(() => normalizeDomain(invalid));
});

test('keyword matching is decoded, case-insensitive, and substring based', () => {
  for (const url of ['https://google.com/sudoku', 'https://google.com/sudokus', 'https://site.test/SUDOKU', 'https://site.test/%73udoku', 'https://www.google.com/search?q=learn+sudokus', 'https://bing.com/search?q=SUDOKU', 'https://duckduckgo.com/?q=sudoku', 'https://search.brave.com/search?q=sudoku', 'https://search.yahoo.com/search?p=sudoku']) assert.ok(matchesRule(keyword, url), url);
  for (const url of ['https://google.com/sudoky', 'https://sudoku.test/', 'https://evilgoogle.com/?q=sudoku', 'https://site.test/?q=sudoku', 'https://google.com/?unrelated=sudoku', 'chrome://sudoku', 'invalid']) assert.equal(matchesRule(keyword, url), false, url);
  assert.ok(matchesRule({ ...keyword, value: 'slow down' }, 'https://google.com/search?q=slow+down'));
  assert.ok(matchesRule({ ...keyword, value: 'café' }, 'https://site.test/caf%C3%A9'));
  assert.ok(matchesRule({ ...keyword, value: 'social media' }, 'https://site.test/%73ocial%20media/%FF'));
});

test('disabled settings and rules do not match', () => {
  assert.equal(matchesRule({ ...domain, enabled: false }, 'https://example.com/'), false);
  assert.equal(matchedRule({ ...DEFAULTS, enabled: false, rules: [domain] }, 'https://example.com/'), undefined);
  assert.equal(matchedRule({ ...DEFAULTS, rules: [domain] }, 'https://example.com/'), domain);
});

test('redirect validation forbids loops and dangerous protocols', () => {
  assert.equal(normalizeRedirect('wikipedia.org'), 'https://wikipedia.org/');
  assert.equal(normalizeRedirect(''), '');
  for (const invalid of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.org']) assert.throws(() => normalizeRedirect(invalid));
  assert.throws(() => validateRedirects([{ ...domain, redirect: 'https://sub.example.com/' }]));
  assert.throws(() => validateRedirects([domain, { ...keyword, redirect: 'https://example.com/' }]));
  assert.doesNotThrow(() => validateRedirects([{ ...domain, redirect: 'https://wikipedia.org/' }]));
});

test('network regex matches keywords without regex injection or fuzzy hostnames', () => {
  const compiled = networkRules({ ...DEFAULTS, rules: [domain, keyword] }, 'chrome-extension://test/page.html');
  assert.equal(compiled.length, 3);
  assert.equal(new Set(compiled.map(rule => rule.id)).size, 3);
  assert.deepEqual(compiled[0].condition.requestDomains, ['example.com']);
  const path = new RegExp(compiled[1].condition.regexFilter!, 'i');
  const query = new RegExp(compiled[2].condition.regexFilter!, 'i');
  assert.ok(path.test('https://google.com/sudokus'));
  assert.ok(path.test('https://site.test/%73%75%64%6F%6B%75'));
  assert.equal(path.test('https://sudoku.test/'), false);
  assert.equal(path.test('https://site.test/?q=sudoku'), false);
  assert.ok(query.test('https://www.google.com/search?q=learn+sudokus'));
  // Query rules use native requestDomains to enforce the hostname boundary.
  assert.deepEqual(compiled[2].condition.requestDomains, SEARCH_HOSTS);
  assert.equal(query.test('https://google.com/?other=https://x?q=sudoku'), false);
  assert.equal(query.test('https://google.com/?other=sudoku'), false);
  assert.equal(nativeRuleMatches(compiled[2], 'https://google.com.evil.example/?q=sudoku'), false);
  assert.equal(nativeRuleMatches(compiled[2], 'https://evilgoogle.com/?q=sudoku'), false);
  assert.ok(nativeRuleMatches(compiled[2], 'https://google.com/?Q=sudoku'));
  assert.ok(nativeRuleMatches(compiled[2], 'https://google.com/?%71=sudoku'));
  assert.ok(nativeRuleMatches(compiled[2], 'https://google.com/?%51=sudoku'));
  assert.ok(nativeRuleMatches(compiled[1], 'https://site.test/%53%55%44%4F%4B%55'));
  assert.ok(matchesRule(keyword, 'https://google.com/?Q=sudoku'));
  const punctuation = networkRules({ ...DEFAULTS, rules: [{ ...keyword, value: 'a.b' }] }, 'chrome-extension://test/page.html');
  assert.ok(new RegExp(punctuation[0].condition.regexFilter!, 'i').test('https://site.test/a.b'));
  assert.equal(new RegExp(punctuation[0].condition.regexFilter!, 'i').test('https://site.test/axb'), false);
  const spaced = networkRules({ ...DEFAULTS, rules: [{ ...keyword, value: 'slow down' }] }, 'chrome-extension://test/page.html');
  assert.ok(new RegExp(spaced[1].condition.regexFilter!, 'i').test('https://google.com/?q=slow+down'));
  assert.deepEqual(networkRules({ ...DEFAULTS, enabled: false, rules: [keyword] }, ''), []);
  const long = networkRules({ ...DEFAULTS, rules: [{ ...keyword, value: 'social media' }] }, '', 'canonical');
  assert.ok(nativeRuleMatches(long[1], 'https://google.com/?q=social+media'));
  assert.ok(nativeRuleMatches(long[0], 'https://site.test/social%20media'));
});

test('retention is exactly 90 local calendar days and removes future dates', () => {
  const now = new Date(2026, 9, 11, 14);
  const cutoff = new Date(2026, 9, 11); cutoff.setDate(cutoff.getDate() - 89);
  const expired = new Date(cutoff); expired.setDate(expired.getDate() - 1);
  const result = pruneInsights({ [dayKey(cutoff)]: { 'site.test': 10 }, [dayKey(expired)]: { 'old.test': 10 }, '2026-10-11': { 'today.test': 20 }, '2026-10-12': { 'future.test': 10 } }, now);
  assert.equal(Object.keys(result).length, 2);
  assert.ok(result[dayKey(cutoff)]);
  assert.equal(result[dayKey(expired)], undefined);
});

test('active time splits at local midnight and aggregates by range', () => {
  const data: Insights = {};
  const start = new Date(2026, 9, 10, 23, 59, 50).getTime();
  addTime(data, 'example.com', start, start + 20000);
  assert.equal(data['2026-10-10']['example.com'], 10000);
  assert.equal(data['2026-10-11']['example.com'], 10000);
  assert.deepEqual(totals(data, 1, new Date(2026, 9, 11)), [['example.com', 10000]]);
  assert.deepEqual(totals(data, 7, new Date(2026, 9, 11)), [['example.com', 20000]]);
  assert.equal(duration(3900000), '1h 5m');
  assert.equal(duration(45000), '45s');
  addTime(data, 'constructor', start, start + 1000);
  assert.equal(data['2026-10-10'].constructor, 1000);
});

test('password is salted, derived, and rejects incorrect input', async () => {
  await assert.rejects(createPassword('short'));
  const first = await createPassword('correct horse battery');
  const second = await createPassword('correct horse battery');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(first.hash.length, 64);
  assert.ok(await verifyPassword('correct horse battery', first));
  assert.equal(await verifyPassword('wrong password', first), false);
});
