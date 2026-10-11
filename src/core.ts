import { categoryById } from './categories';
export type Rule = { id: number; kind: 'domain' | 'url' | 'keyword' | 'category'; value: string; redirect: string; enabled: boolean };
export type Password = { salt: string; hash: string };
export type Settings = { version: 1; enabled: boolean; rules: Rule[]; password: Password | null; showFavicons?: boolean; fetchFavicons?: boolean };
export type Day = Record<string, number>;
export type Insights = Record<string, Day>;
export type Snapshot = { settings: Settings; insights: Insights; unlocked: boolean };
export const DEFAULTS: Settings = { version: 1, enabled: true, rules: [], password: null, showFavicons: false, fetchFavicons: false };
export const RETENTION_DAYS = 90;
export const SEARCH_HOSTS = ['google.com', 'bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com'];
export const SEARCH_PARAMS = ['q', 'query', 'search_query', 'p'];

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || /[\s*?#]/.test(trimmed)) throw new Error('Enter a hostname, such as example.com. Wildcards are not needed.');
  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Use a domain only, without a path, port, or credentials.');
  }
  const host = url.hostname.replace(/\.$/, '');
  if (!host.includes('.') && host !== 'localhost') throw new Error('Enter a complete domain, such as example.com.');
  return host;
}

export function normalizeRedirect(input: string): string {
  if (!input.trim()) return '';
  const url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Redirects must be HTTP or HTTPS URLs without credentials.');
  return url.href;
}

export function normalizeUrlRule(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) throw new Error('Enter a domain and path, such as instagram.com/reels. Encode spaces as %20.');
  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('URL boundaries need an HTTP/HTTPS domain and path, without credentials or a port.');
  if (url.href.includes('?') || url.href.includes('#')) throw new Error('Use a domain and path only, without query parameters or a fragment. All queries at that path will be covered.');
  const host = normalizeDomain(url.hostname);
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { throw new Error('The URL path contains invalid percent encoding.'); }
  if (path.endsWith('/*')) path = path.slice(0, -2);
  if (path.includes('*')) throw new Error('Wildcards are not needed. Enter the path prefix; everything beneath it is included.');
  path = path.replace(/\/+$/, '').toLowerCase();
  const canonical = new URL(`https://${host}${path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`);
  const canonicalPath = canonical.pathname.replace(/\/+$/, '');
  if (!canonicalPath) throw new Error('Include a specific path, such as /reels. Use a domain boundary to block an entire site.');
  return host + canonicalPath;
}

export function ruleDomain(rule: Rule): string | null {
  if (rule.kind === 'domain') return rule.value;
  if (rule.kind === 'url') return new URL(`https://${rule.value}`).hostname;
  return null;
}

export function domainMatches(host: string, domain: string): boolean {
  host = host.toLowerCase().replace(/\.$/, '');
  return host === domain || host.endsWith(`.${domain}`);
}

function decoded(text: string): string {
  // Decode valid runs even if an unrelated byte is malformed. A bad escape
  // must not hide an otherwise valid keyword elsewhere in the pathname.
  return text.replace(/(?:%[0-9a-f]{2})+/gi, run => new TextDecoder().decode(Uint8Array.from(run.match(/[0-9a-f]{2}/gi)!, byte => parseInt(byte, 16))));
}

function comparablePath(pathname: string): string {
  const encoded = decoded(pathname).toLowerCase().split('/').map(segment => encodeURIComponent(segment)).join('/');
  // Resolve dot segments revealed by encoded separators, just as URL input
  // normalization does. A copied encoded URL must match its own boundary.
  return new URL(`https://path.invalid${encoded}`).pathname.toLowerCase();
}

export function matchesRule(rule: Rule, rawUrl: string): boolean {
  if (!rule.enabled) return false;
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (rule.kind === 'domain') return domainMatches(url.hostname, rule.value);
  if (rule.kind === 'url') {
    const target = new URL(`https://${rule.value}`);
    const path = comparablePath(url.pathname);
    const prefix = comparablePath(target.pathname);
    return domainMatches(url.hostname, target.hostname) && (path === prefix || path.startsWith(`${prefix}/`));
  }
  if (rule.kind === 'category') return categoryById(rule.value)?.domains.some(domain => domainMatches(url.hostname, domain)) ?? false;
  const keyword = rule.value.toLowerCase();
  if (decoded(url.pathname).toLowerCase().includes(keyword)) return true;
  if (!SEARCH_HOSTS.some(host => domainMatches(url.hostname, host))) return false;
  return [...url.searchParams].some(([key, value]) => SEARCH_PARAMS.includes(key.toLowerCase()) && value.toLowerCase().includes(keyword));
}

export function matchedRule(settings: Settings, url: string): Rule | undefined {
  return settings.enabled ? orderedRules(settings.rules).find(rule => matchesRule(rule, url)) : undefined;
}

export function orderedRules(rules: Rule[]): Rule[] {
  // A specific, user-created destination takes precedence over a bundled group.
  return [...rules.filter(rule => rule.kind !== 'category'), ...rules.filter(rule => rule.kind === 'category')];
}

export function changesCategoryDestination(rule: Rule, rules: Rule[]): boolean {
  if (!rule.enabled || rule.kind === 'category') return false;
  return rules.some(other => {
    if (other.kind !== 'category' || !other.enabled || other.redirect === rule.redirect) return false;
    const domains = categoryById(other.value)?.domains ?? [];
    const host = ruleDomain(rule);
    return rule.kind === 'keyword' || Boolean(host && domains.some(domain => domainMatches(domain, host) || domainMatches(host, domain)));
  });
}

export function validateRedirects(rules: Rule[]): void {
  for (const rule of rules) {
    if (rule.enabled && rule.redirect && rules.some(other => matchesRule(other, rule.redirect))) {
      throw new Error(`The redirect for “${rule.value}” matches a blocking rule. Choose another destination to avoid a loop.`);
    }
  }
}

// Fixed-width escapes avoid regex injection. Accept literal and percent-encoded UTF-8.
function encodedPattern(char: string, foldCase = true): string {
  if (foldCase && /^[a-z]$/i.test(char)) {
    const low = char.toLowerCase().charCodeAt(0).toString(16);
    const high = char.toUpperCase().charCodeAt(0).toString(16);
    return `%[${low[0]}${high[0]}]${low[1]}`;
  }
  return [...new TextEncoder().encode(char)].map(byte => `%${byte.toString(16).padStart(2, '0')}`).join('');
}
export type Encoding = 'mixed' | 'canonical' | 'literal' | 'encoded';
function keywordPattern(keyword: string, query: boolean, encoding: Encoding = 'mixed', urlPath = false): string {
  const parts = [...keyword].map(char => {
    const encoded = encodedPattern(char, encoding === 'mixed');
    const reserved = query ? ['&', '#', '+', '"', "'", '<', '>'] : ['?', '#', ' ', '"', '<', '>', '`', '{', '}'];
    if (urlPath) reserved.push('%'); // A literal percent is %25, not another escape's introducer.
    const literal = /^[\x20-\x7e]$/.test(char) && !reserved.includes(char) ? `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}` : '';
    const spaces = query && char === ' ' ? ['\\+'] : [];
    return { mixed: `(${[literal, encoded, ...spaces].filter(Boolean).join('|')})`, plain: spaces.length ? `(${literal}|${encoded}|\\+)` : literal || encoded, encoded };
  });
  if (encoding === 'literal') return parts.map(part => part.plain).join('');
  if (encoding === 'encoded') return parts.map(part => part.encoded).join('');
  if (encoding === 'canonical') return `(${parts.map(part => part.plain).join('')}|${parts.map(part => part.encoded).join('')})`;
  return parts.map(part => part.mixed).join('');
}

export function networkRules(settings: Settings, blockedUrl: string, encoding: Encoding = 'mixed'): chrome.declarativeNetRequest.Rule[] {
  if (!settings.enabled) return [];
  return orderedRules(settings.rules).filter(rule => rule.enabled).flatMap<chrome.declarativeNetRequest.Rule>((rule, index) => {
    const action: chrome.declarativeNetRequest.RuleAction = {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: rule.redirect ? { url: rule.redirect } : { url: blockedUrl },
    };
    const base = { action, priority: 10000 - index, condition: { resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME] } };
    if (rule.kind === 'domain') return [{ ...base, id: rule.id * 4, condition: { ...base.condition, requestDomains: [rule.value] } }];
    if (rule.kind === 'url') {
      const target = new URL(`https://${rule.value}`);
      const regexFilter = `^https?://[^/]+/${keywordPattern(decoded(target.pathname).slice(1), false, encoding, true)}(/|%2f|[?#]|$)`;
      return [{ ...base, id: rule.id * 4, condition: { ...base.condition, requestDomains: [target.hostname], regexFilter, isUrlFilterCaseSensitive: false } }];
    }
    if (rule.kind === 'category') {
      const category = categoryById(rule.value);
      if (!category) throw new Error('Unknown category.');
      return [{ ...base, id: rule.id * 4, condition: { ...base.condition, requestDomains: [...category.domains] } }];
    }
    const path = `^https?://[^/]+/[^?#]*${keywordPattern(rule.value, false, encoding)}`;
    // Single-character search keys can be decoded natively without inflating
    // Chrome's tiny RE2 memory budget. Encoded longer keys use the fallback.
    const params = SEARCH_PARAMS.flatMap(key => key.length === 1 ? [key, encodedPattern(key)] : [key]).join('|');
    const query = `^https?://[^/]+/[^?#]*\\?([^#&]*&)*(${params})=[^&#]*${keywordPattern(rule.value, true, encoding)}`;
    return [path, query].map((regexFilter, offset) => ({ ...base, id: rule.id * 4 + offset, condition: { ...base.condition, regexFilter, ...(offset === 1 ? { requestDomains: SEARCH_HOSTS } : {}), isUrlFilterCaseSensitive: false } }));
  });
}

export function nativeRuleMatches(rule: chrome.declarativeNetRequest.Rule, rawUrl: string): boolean {
  const url = new URL(rawUrl);
  if (rule.condition.requestDomains && !rule.condition.requestDomains.some(domain => domainMatches(url.hostname, domain))) return false;
  return !rule.condition.regexFilter || new RegExp(rule.condition.regexFilter, rule.condition.isUrlFilterCaseSensitive ? '' : 'i').test(url.href);
}

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function pruneInsights(insights: Insights, now = new Date()): Insights {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS + 1);
  const minimum = dayKey(cutoff);
  return Object.fromEntries(Object.entries(insights).filter(([day]) => day >= minimum && day <= dayKey(now)));
}

export function addTime(insights: Insights, domain: string, start: number, end: number): void {
  // Split intervals at local midnight, so day totals remain accurate.
  let cursor = start;
  while (cursor < end) {
    const next = new Date(cursor);
    next.setHours(24, 0, 0, 0);
    const stop = Math.min(end, next.getTime());
    const key = dayKey(new Date(cursor));
    const day = insights[key] ??= Object.create(null) as Day;
    Object.defineProperty(day, domain, { value: (Object.hasOwn(day, domain) ? day[domain] : 0) + stop - cursor, enumerable: true, writable: true, configurable: true });
    cursor = stop;
  }
}

export function totals(insights: Insights, days: number, now = new Date()): [string, number][] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - days + 1);
  const sums: Day = Object.create(null) as Day;
  for (const [day, domains] of Object.entries(insights)) {
    if (day < dayKey(cutoff) || day > dayKey(now)) continue;
    for (const [domain, ms] of Object.entries(domains)) sums[domain] = (sums[domain] ?? 0) + ms;
  }
  return Object.entries(sums).sort((a, b) => b[1] - a[1]);
}

export function duration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return minutes ? `${minutes}m` : `${Math.floor(ms / 1000)}s`;
}

const hex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = Uint8Array.from(salt.match(/.{2}/g)!, byte => parseInt(byte, 16));
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes, iterations: 310000, hash: 'SHA-256' }, key, 256)));
}
export async function createPassword(password: string): Promise<Password> {
  if (password.length < 8 || password.length > 256) throw new Error('Use a password between 8 and 256 characters.');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await derive(password, salt) };
}
export async function verifyPassword(password: string, stored: Password): Promise<boolean> {
  if (password.length > 256) return false;
  const hash = await derive(password, stored.salt);
  let difference = hash.length ^ stored.hash.length;
  for (let i = 0; i < hash.length; i++) difference |= hash.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return difference === 0;
}
