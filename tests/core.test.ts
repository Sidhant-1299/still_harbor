import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SEARCH_HOSTS, addTime, changesCategoryDestination, createPassword, dayKey, domainMatches, duration, matchedRule, matchesRule, nativeRuleMatches, networkRules, normalizeDomain, normalizeRedirect, normalizeUrlRule, pruneInsights, ruleDomain, totals, validateRedirects, verifyPassword, type Insights, type Rule } from '../src/core';
import { CATEGORIES, categoryById } from '../src/categories';

// Only enum values are needed to compile native rules outside Chrome.
Object.assign(globalThis, { chrome: { declarativeNetRequest: { RuleActionType: { REDIRECT: 'redirect' }, ResourceType: { MAIN_FRAME: 'main_frame' } } } });
const domain: Rule = { id: 1, kind: 'domain', value: 'example.com', redirect: '', enabled: true };
const keyword: Rule = { ...domain, id: 2, kind: 'keyword', value: 'sudoku' };

test('URL boundaries require a domain and non-root path and normalize equivalent prefixes', () => {
  assert.equal(normalizeUrlRule('instagram.com/reels'), 'instagram.com/reels');
  assert.equal(normalizeUrlRule('HTTPS://Instagram.COM/Reels/'), 'instagram.com/reels');
  assert.equal(normalizeUrlRule('instagram.com/reels/*'), 'instagram.com/reels');
  assert.equal(normalizeUrlRule('instagram.com/r%65els'), 'instagram.com/reels');
  assert.equal(normalizeUrlRule('example.com/caf%C3%A9'), 'example.com/caf%C3%A9');
  assert.equal(normalizeUrlRule('example.com/foo%2F..%2Freels'), 'example.com/reels');
  for (const invalid of ['', '/reels', 'instagram/reels', 'instagram.com', 'instagram.com/', 'instagram.com/%2f', 'instagram.com/foo%2F..%2F', 'instagram.com/%2e%2F', 'instagram.com/reels?q=1', 'instagram.com/reels#feed', 'instagram.com/reels?', 'instagram.com/reels#', 'ftp://instagram.com/reels', 'https://user:pass@instagram.com/reels', 'instagram.com:8080/reels', 'instagram.com/*/reels', 'instagram.com/%FF']) assert.throws(() => normalizeUrlRule(invalid), invalid);
});

test('URL prefixes match descendants and subdomains, not the rest of the site', () => {
  const rule: Rule = { ...domain, kind: 'url', value: normalizeUrlRule('instagram.com/reels') };
  for (const url of ['https://instagram.com/reels', 'https://instagram.com/reels/', 'https://www.instagram.com/reels/123', 'http://instagram.com/reels/anything/else?q=1', 'https://instagram.com/reels?source=home', 'https://instagram.com/Reels/', 'https://instagram.com/r%65els/%31', 'https://instagram.com/reels%2F123', 'https://instagram.com/foo%2F..%2Freels']) assert.ok(matchesRule(rule, url), url);
  for (const url of ['https://instagram.com/', 'https://instagram.com/direct/', 'https://instagram.com/reels-other', 'https://instagram.com/my/reels', 'https://instagram.com/?next=/reels', 'https://notinstagram.com/reels', 'https://instagram.com.evil.test/reels']) assert.equal(matchesRule(rule, url), false, url);
  assert.equal(matchesRule({ ...rule, enabled: false }, 'https://instagram.com/reels/123'), false);
  assert.equal(ruleDomain(rule), 'instagram.com');
  assert.equal(ruleDomain(keyword), null);
});

test('native URL rules agree with semantic matching and keep redirects safe', () => {
  const rule: Rule = { ...domain, kind: 'url', value: normalizeUrlRule('instagram.com/reels') };
  const native = networkRules({ ...DEFAULTS, rules: [rule] }, 'chrome-extension://test/page.html');
  assert.equal(native.length, 1);
  assert.deepEqual(native[0].condition.requestDomains, ['instagram.com']);
  for (const url of ['https://instagram.com/reels', 'https://www.instagram.com/reels/123', 'https://instagram.com/reels?x=1', 'https://instagram.com/r%65els%2F123', 'https://instagram.com/reels-other', 'https://instagram.com/', 'https://other.test/reels']) assert.equal(nativeRuleMatches(native[0], url), matchesRule(rule, url), url);
  assert.throws(() => validateRedirects([{ ...rule, redirect: 'https://www.instagram.com/reels/123' }]));
  assert.doesNotThrow(() => validateRedirects([{ ...rule, redirect: 'https://instagram.com/' }]));
  const category: Rule = { ...domain, id: 5, kind: 'category', value: 'social' };
  assert.ok(changesCategoryDestination({ ...rule, redirect: 'https://quiet.test/' }, [category]));
  assert.equal(changesCategoryDestination(rule, [category]), false);
  assert.ok(matchedRule({ ...DEFAULTS, rules: [rule, category] }, 'https://instagram.com/'));
  const encoded = networkRules({ ...DEFAULTS, rules: [rule] }, '', 'encoded')[0];
  assert.ok(nativeRuleMatches(encoded, 'https://instagram.com/%72%65%65%6c%73/123'));
  for (const [input, allowed] of [['example.com/foo%252fbar', 'https://example.com/foo%2fbar'], ['example.com/%2541', 'https://example.com/%41']]) {
    const literalPercent: Rule = { ...rule, value: normalizeUrlRule(input) };
    const compiled = networkRules({ ...DEFAULTS, rules: [literalPercent] }, '')[0];
    assert.equal(matchesRule(literalPercent, allowed), false);
    assert.equal(nativeRuleMatches(compiled, allowed), false);
    assert.ok(matchesRule(literalPercent, `https://${literalPercent.value}`));
    assert.ok(nativeRuleMatches(compiled, `https://${literalPercent.value}`));
  }
});

test('long document URL boundaries retain exact path scope in native literal and decoded matching', () => {
  const copied = 'colab.research.google.com/drive/1HpQp8R7Uwm2UKgxKfAlAv96rBpZBOINv';
  const rule: Rule = { ...domain, kind: 'url', value: normalizeUrlRule(copied) };
  const native = networkRules({ ...DEFAULTS, rules: [rule] }, '', 'literal')[0];
  assert.equal(rule.value, copied.toLowerCase());
  for (const url of [`https://${copied}`, `https://${copied}/child`, `https://${copied}?authuser=0`, `https://sub.${copied}`]) {
    assert.ok(matchesRule(rule, url), url);
    assert.ok(nativeRuleMatches(native, url), url);
  }
  for (const url of ['https://colab.research.google.com/', 'https://colab.research.google.com/drive/another', `https://${copied}-other`, `https://${copied}x`, `https://${copied.replace('.com/', '.com.evil.test/')}`]) {
    assert.equal(matchesRule(rule, url), false, url);
    assert.equal(nativeRuleMatches(native, url), false, url);
  }
  const encoded = `https://colab.research.google.com/drive/${[...copied.split('/').at(-1)!].map(char => `%${char.charCodeAt(0).toString(16)}`).join('')}`;
  assert.ok(matchesRule(rule, encoded));
  assert.throws(() => validateRedirects([{ ...rule, redirect: encoded }]), /avoid a loop/);
});

test('bundled categories contain unique normalized domains and match exact host boundaries', () => {
  assert.equal(CATEGORIES.length, 3);
  for (const category of CATEGORIES) {
    assert.equal(new Set(category.domains).size, category.domains.length);
    assert.ok(category.domains.length >= 25);
    const rule: Rule = { ...domain, kind: 'category', value: category.id };
    for (const host of category.domains) {
      assert.equal(normalizeDomain(host), host);
      assert.ok(matchesRule(rule, `https://${host}/`), host);
      assert.ok(matchesRule(rule, `https://sub.${host}/`), host);
      assert.equal(matchesRule(rule, `https://${host}.unrelated.test/`), false);
    }
    assert.equal(matchesRule({ ...rule, enabled: false }, `https://${category.domains[0]}/`), false);
    const native = networkRules({ ...DEFAULTS, rules: [rule] }, 'chrome-extension://test/page.html');
    assert.equal(native.length, 1);
    assert.deepEqual(native[0].condition.requestDomains, category.domains);
  }
  assert.equal(categoryById('unknown'), undefined);
  assert.equal(matchesRule({ ...domain, kind: 'category', value: 'unknown' }, 'https://facebook.com/'), false);
});

test('individual redirects take precedence without changing category coverage', () => {
  const category: Rule = { ...domain, id: 9, kind: 'category', value: 'social' };
  const individual: Rule = { ...domain, id: 10, value: 'facebook.com', redirect: 'https://quiet.test/' };
  const settings = { ...DEFAULTS, rules: [category, individual] };
  assert.equal(matchedRule(settings, 'https://facebook.com/'), individual);
  assert.equal(matchedRule(settings, 'https://instagram.com/'), category);
  const native = networkRules(settings, 'chrome-extension://test/page.html');
  assert.ok(native[0].priority! > native[1].priority!);
  assert.throws(() => validateRedirects([{ ...category, redirect: 'https://facebook.com/' }]));
  assert.doesNotThrow(() => validateRedirects(settings.rules));
  assert.throws(() => networkRules({ ...DEFAULTS, rules: [{ ...category, value: 'unknown' }] }, ''));
  assert.ok(changesCategoryDestination(individual, [category]));
  assert.equal(changesCategoryDestination({ ...individual, redirect: '' }, [category]), false);
  assert.equal(changesCategoryDestination({ ...individual, value: 'quiet.test' }, [category]), false);
  assert.ok(changesCategoryDestination({ ...keyword, redirect: 'https://quiet.test/' }, [category]));
});

test('domains match boundaries, not fuzzy names', () => {
  for (const host of ['example.com', 'www.example.com', 'deep.sub.example.com', 'EXAMPLE.COM', 'example.com.']) assert.ok(domainMatches(host, 'example.com'));
  for (const host of ['example.org', 'notexample.com', 'example.com.evil.test']) assert.equal(domainMatches(host, 'example.com'), false);
  assert.equal(normalizeDomain('HTTPS://WWW.Example.com/'), 'www.example.com');
  assert.equal(normalizeDomain('bücher.de'), 'xn--bcher-kva.de');
  for (const invalid of ['*.example.com', 'example.com/path', 'example.com:8080', 'user@example.com', 'chrome://settings', 'example.com?q=x', 'two words']) assert.throws(() => normalizeDomain(invalid));
});

test('keyword matching is decoded, case-insensitive, and substring based', () => {
  for (const url of ['https://google.com/sudoku', 'https://google.com/sudokus', 'https://site.test/SUDOKU', 'https://site.test/%73udoku', 'https://www.google.com/search?q=learn+sudokus', 'https://bing.com/search?q=SUDOKU', 'https://duckduckgo.com/?q=sudoku', 'https://search.brave.com/search?q=sudoku', 'https://search.yahoo.com/search?p=sudoku']) assert.ok(matchesRule(keyword, url), url);
  for (const url of ['https://google.com/sudoky', 'https://evilgoogle.com/?q=sudoku', 'https://site.test/?q=sudoku', 'https://google.com/?unrelated=sudoku', 'chrome://sudoku', 'invalid']) assert.equal(matchesRule(keyword, url), false, url);
  assert.ok(matchesRule({ ...keyword, value: 'slow down' }, 'https://google.com/search?q=slow+down'));
  assert.ok(matchesRule({ ...keyword, value: 'café' }, 'https://site.test/caf%C3%A9'));
  assert.ok(matchesRule({ ...keyword, value: 'social media' }, 'https://site.test/%73ocial%20media/%FF'));
});

test('hostname keywords agree across native encodings and fallback without matching other URL fields', () => {
  for (const value of ['sudoku', 'chess']) {
    const rule: Rule = { ...keyword, value };
    const blocked = [`https://${value}.com/`, `https://www.${value}.com/`, `http://play.${value}.com/game`, `https://MY${value.toUpperCase()}CLUB.com/`, `https://${value}.com:8443/`, `https://user:pass@${value}.com/`, `https://example.com/${value}`, `https://google.com/search?q=${value}`];
    const allowed = [`https://example.com/#${value}`, `https://${value}:password@example.com/`, `https://example.com/?next=https://${value}.com/`, `https://example.com/?q=${value}`, 'https://example.com/', value === 'chess' ? 'https://chesboard.test/' : 'https://sudoky.test/'];
    for (const encoding of ['mixed', 'canonical', 'literal', 'encoded'] as const) {
      const native = networkRules({ ...DEFAULTS, rules: [rule] }, '', encoding);
      for (const url of blocked.slice(0, 6)) {
        assert.ok(matchesRule(rule, url), url);
        assert.ok(native.some(item => nativeRuleMatches(item, url)), `${encoding}: ${url}`);
      }
      for (const url of allowed) {
        assert.equal(matchesRule(rule, url), false, url);
        assert.equal(native.some(item => nativeRuleMatches(item, url)), false, `${encoding}: ${url}`);
      }
    }
    for (const url of blocked) assert.ok(matchesRule(rule, url), url);
    assert.equal(matchesRule({ ...rule, enabled: false }, blocked[0]), false);
    assert.throws(() => validateRedirects([{ ...rule, redirect: blocked[0] }]), /avoid a loop/);
  }
  for (const [value, url, expected] of [
    ['8443', 'https://example.com:8443/', false],
    ['example.com:8443', 'https://example.com:8443/', false],
    ['a.b', 'https://a.b.test/', true],
    ['a.b', 'https://axb.test/', false],
    ['::1', 'http://[::1]/', true],
    ['xn--bcher', 'https://bücher.de/', true],
    ['bücher', 'https://bücher.de/', false],
  ] as const) {
    const rule = { ...keyword, value };
    assert.equal(matchesRule(rule, url), expected, url);
    assert.equal(networkRules({ ...DEFAULTS, rules: [rule] }, '').some(item => nativeRuleMatches(item, url)), expected, url);
  }
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
  assert.equal(path.test('https://sudoku.test/'), true);
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
