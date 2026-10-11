import { DEFAULTS, addTime, createPassword, matchedRule, nativeRuleMatches, networkRules, normalizeDomain, normalizeRedirect, pruneInsights, validateRedirects, verifyPassword, type Insights, type Rule, type Settings } from './core';

type Activity = { domain: string; since: number } | null;
let settings: Settings = structuredClone(DEFAULTS);
let insights: Insights = {};
let activity: Activity = null;
let unlockedUntil = 0;
let failedAttempts = 0;
let retryAfter = 0;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const task = queue.then(work);
  queue = task.catch(() => {});
  return task;
}

async function compile(next: Settings): Promise<void> {
  const candidates = networkRules(next, chrome.runtime.getURL('page.html'));
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const canonical = networkRules(next, chrome.runtime.getURL('page.html'), 'canonical');
  const literal = networkRules(next, chrome.runtime.getURL('page.html'), 'literal');
  const encoded = networkRules(next, chrome.runtime.getURL('page.html'), 'encoded');
  const supports = async (rule: chrome.declarativeNetRequest.Rule) => (await chrome.declarativeNetRequest.isRegexSupported({ regex: rule.condition.regexFilter!, isCaseSensitive: false, requireCapturing: false })).isSupported;
  for (const rule of candidates) {
    if (rule.condition.regexFilter) {
      if (!await supports(rule)) {
        rule.condition.regexFilter = canonical.find(other => other.id === rule.id)!.condition.regexFilter;
        if (!await supports(rule)) {
          const plain = literal.find(other => other.id === rule.id)!;
          const escaped = { ...encoded.find(other => other.id === rule.id)!, id: rule.id + 2 };
          if (!await supports(plain) || !await supports(escaped)) throw new Error('This keyword is too complex for Chrome’s blocking engine. Try a shorter keyword.');
          rules.push(plain, escaped);
          continue;
        }
      }
    }
    rules.push(rule);
  }
  if (rules.length > 900) throw new Error('These keywords exceed Chrome’s native rule budget. Remove or shorten a rule before adding another.');
  for (const rule of next.rules) {
    if (rule.enabled && rule.redirect && rules.some(native => nativeRuleMatches(native, rule.redirect))) throw new Error(`The redirect for “${rule.value}” matches a native blocking rule. Choose another destination to avoid a loop.`);
  }
  const previous = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: previous.map(rule => rule.id), addRules: rules });
}

async function saveSettings(next: Settings): Promise<void> {
  validateRedirects(next.rules);
  await compile(next);
  try { await chrome.storage.local.set({ settings: next }); }
  catch (error) { await compile(settings); throw error; }
  settings = next;
  await enforceOpenTabs();
  await refreshActivity();
}

function requireUnlock(): void {
  if (settings.password && unlockedUntil <= Date.now()) throw new Error('Unlock settings with your password first.');
}

async function flushActivity(now = Date.now()): Promise<void> {
  if (activity) {
    // Bound stale sessions after sleep, crashes, or delayed background execution.
    const end = Math.min(now, activity.since + 60000);
    if (end > activity.since) addTime(insights, activity.domain, activity.since, end);
    activity.since = Math.max(activity.since, now);
  }
  insights = pruneInsights(insights);
  await chrome.storage.local.set({ insights });
  await chrome.storage.session.set({ activity });
}

async function refreshActivity(transitionAt = Date.now()): Promise<void> {
  await flushActivity(transitionAt);
  activity = null;
  const [window, idle] = await Promise.all([chrome.windows.getLastFocused(), chrome.idle.queryState(60)]);
  if (window.focused && idle === 'active') {
    const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
    if (tab?.url && !tab.incognito && !matchedRule(settings, tab.url)) {
      try {
        const url = new URL(tab.url);
        if (['http:', 'https:'].includes(url.protocol)) activity = { domain: url.hostname.replace(/\.$/, ''), since: Date.now() };
      } catch { /* Internal and incomplete URLs are not tracked. */ }
    }
  }
  await chrome.storage.session.set({ activity });
}

async function enforceTab(tabId: number, expectedUrl?: string, documentId?: string): Promise<void> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || tab.incognito || (expectedUrl && tab.url !== expectedUrl) || (tab.pendingUrl && tab.pendingUrl !== tab.url)) return;
  if (documentId) {
    const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 }).catch(() => null);
    if (frame?.documentId !== documentId) return;
  }
  const rule = matchedRule(settings, tab.url);
  if (rule) await chrome.tabs.update(tabId, { url: rule.redirect || chrome.runtime.getURL('page.html') }).catch(() => {});
}

async function enforceOpenTabs(): Promise<void> {
  if (!settings.enabled) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(tab => tab.id !== undefined && !tab.incognito).map(tab => enforceTab(tab.id!, tab.url)));
}

const ready = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const [local, session] = await Promise.all([chrome.storage.local.get(['settings', 'insights']), chrome.storage.session.get(['activity', 'unlockedUntil', 'failedAttempts', 'retryAfter'])]);
  settings = (local.settings as Settings | undefined) ?? structuredClone(DEFAULTS);
  insights = pruneInsights((local.insights as Insights | undefined) ?? {});
  activity = (session.activity as Activity | undefined) ?? null;
  unlockedUntil = (session.unlockedUntil as number | undefined) ?? 0;
  failedAttempts = (session.failedAttempts as number | undefined) ?? 0;
  retryAfter = (session.retryAfter as number | undefined) ?? 0;
  await compile(settings);
  await chrome.alarms.create('harbor-heartbeat', { periodInMinutes: 0.5 });
  chrome.idle.setDetectionInterval(60);
  await enforceOpenTabs();
  await refreshActivity();
})();

function schedule(work: () => Promise<unknown>): void {
  void serial(async () => { await ready; return work(); }).catch(error => console.error('Still Harbor:', error));
}
function activityChanged(): void {
  const at = Date.now();
  schedule(() => refreshActivity(at));
}
chrome.tabs.onActivated.addListener(activityChanged);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === 'complete') activityChanged(); });
chrome.tabs.onRemoved.addListener(activityChanged);
chrome.windows.onFocusChanged.addListener(activityChanged);
chrome.idle.onStateChanged.addListener(activityChanged);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'harbor-heartbeat') schedule(refreshActivity); });
chrome.runtime.onStartup.addListener(() => schedule(refreshActivity));
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0) return;
  schedule(async () => {
    // Native rules intercept normal requests. This fallback handles decoded
    // edge cases after commit, and never acts on a stale navigation.
    await enforceTab(details.tabId, details.url, details.documentId);
  });
});
chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
  if (details.frameId !== 0) return;
  schedule(async () => {
    await enforceTab(details.tabId, details.url, details.documentId);
    await refreshActivity();
  });
});

function validRule(input: unknown, id: number): Rule {
  if (!input || typeof input !== 'object') throw new Error('Invalid rule.');
  const data = input as Record<string, unknown>;
  if (data.kind !== 'domain' && data.kind !== 'keyword') throw new Error('Choose a domain or keyword.');
  if (typeof data.value !== 'string' || typeof data.redirect !== 'string') throw new Error('Invalid rule fields.');
  const value = data.kind === 'domain' ? normalizeDomain(data.value) : data.value.trim().toLowerCase();
  if (!value || value.length > 120) throw new Error('Enter a rule between 1 and 120 characters.');
  return { id, kind: data.kind, value, redirect: normalizeRedirect(data.redirect), enabled: data.enabled !== false };
}

async function handle(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (sender.id !== chrome.runtime.id) throw new Error('Unauthorized sender.');
  if (message.type === 'check-url') {
    if (!sender.tab || sender.frameId !== 0 || typeof message.url !== 'string') return null;
    if (sender.tab.id !== undefined) await enforceTab(sender.tab.id, message.url, sender.documentId);
    return null;
  }
  if (!sender.url?.startsWith(chrome.runtime.getURL('')) || sender.tab?.incognito) throw new Error('Settings are only available inside the extension.');
  switch (message.type) {
    case 'snapshot':
      await refreshActivity();
      return { settings: { ...settings, password: settings.password ? { salt: '', hash: '' } : null }, insights, unlocked: !settings.password || unlockedUntil > Date.now() };
    case 'add-rule': {
      if (settings.rules.length >= 450) throw new Error('The limit is 450 rules.');
      const id = Math.max(0, ...settings.rules.map(rule => rule.id)) + 1;
      const rule = validRule(message.rule, id);
      if (settings.rules.some(other => other.kind === rule.kind && other.value === rule.value)) throw new Error('That rule already exists.');
      await saveSettings({ ...settings, rules: [...settings.rules, rule] });
      return null;
    }
    case 'update-rule': {
      const old = settings.rules.find(rule => rule.id === message.id);
      if (!old) throw new Error('Rule not found.');
      const rule = validRule(message.rule, old.id);
      if (old.value !== rule.value || old.kind !== rule.kind || old.redirect !== rule.redirect || (old.enabled && !rule.enabled)) requireUnlock();
      if (settings.rules.some(other => other.id !== old.id && other.kind === rule.kind && other.value === rule.value)) throw new Error('That rule already exists.');
      await saveSettings({ ...settings, rules: settings.rules.map(other => other.id === old.id ? rule : other) });
      return null;
    }
    case 'delete-rule':
      requireUnlock();
      await saveSettings({ ...settings, rules: settings.rules.filter(rule => rule.id !== message.id) });
      return null;
    case 'set-enabled':
      if (typeof message.enabled !== 'boolean') throw new Error('Invalid setting.');
      if (!message.enabled) requireUnlock();
      await saveSettings({ ...settings, enabled: message.enabled });
      return null;
    case 'unlock': {
      if (!settings.password) return null;
      if (Date.now() < retryAfter) throw new Error('Too many attempts. Wait a minute before trying again.');
      if (typeof message.password !== 'string' || !await verifyPassword(message.password, settings.password)) {
        failedAttempts++;
        if (failedAttempts >= 5) { retryAfter = Date.now() + 60000; failedAttempts = 0; }
        await chrome.storage.session.set({ failedAttempts, retryAfter });
        throw new Error('Incorrect password. There is no password recovery.');
      }
      unlockedUntil = Date.now() + 5 * 60000;
      failedAttempts = 0;
      retryAfter = 0;
      await chrome.storage.session.set({ unlockedUntil, failedAttempts, retryAfter });
      return null;
    }
    case 'lock':
      unlockedUntil = 0;
      await chrome.storage.session.set({ unlockedUntil });
      return null;
    case 'set-password': {
      requireUnlock();
      if (typeof message.password !== 'string') throw new Error('Enter a password.');
      const password = await createPassword(message.password);
      await saveSettings({ ...settings, password });
      unlockedUntil = 0;
      await chrome.storage.session.set({ unlockedUntil });
      return null;
    }
    case 'remove-password':
      requireUnlock();
      await saveSettings({ ...settings, password: null });
      unlockedUntil = 0;
      await chrome.storage.session.set({ unlockedUntil });
      return null;
    case 'delete-insights':
      insights = {};
      if (activity) activity.since = Date.now();
      await chrome.storage.local.set({ insights });
      await chrome.storage.session.set({ activity });
      return null;
    default: throw new Error('Unknown action.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void serial(async () => {
    await ready;
    if (!message || typeof message !== 'object') throw new Error('Invalid message.');
    return handle(message, sender);
  }).then(data => sendResponse({ ok: true, data }), error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }));
  return true;
});
