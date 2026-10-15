import { dayKey, duration, ruleDomain, totals, type Rule, type Snapshot } from './core';
import { chart, download, element, notify, request, snapshot } from './ui';
import { CATEGORIES, CATEGORY_VERSION, categoryById } from './categories';
import { setupIncognito } from './incognito';

let state: Snapshot;
let busy = false;
let editing: Rule | null = null;
let renderedRules = '';
const unlockDialog = element<HTMLDialogElement>('unlock-dialog');
const editDialog = element<HTMLDialogElement>('edit-dialog');
const confirmationDialog = element<HTMLDialogElement>('confirmation-dialog');
let confirmation: { run: () => Promise<void>; success: string } | null = null;
const input = (id: string) => element<HTMLInputElement>(id);

async function load(): Promise<void> {
  state = await snapshot();
  renderCategories();
  renderRules();
  renderInsights();
  renderSettings();
}

function renderCategories(): void {
  const list = element('category-list');
  const expanded = new Set([...list.querySelectorAll<HTMLDetailsElement>('details[open]')].map(node => node.dataset.category));
  list.replaceChildren();
  for (const category of CATEGORIES) {
    const rule = state.settings.rules.find(rule => rule.kind === 'category' && rule.value === category.id);
    const card = document.createElement('article');
    card.className = `category-card${rule?.enabled ? ' selected' : ''}`;
    card.dataset.category = category.id;
    const header = document.createElement('div');
    header.className = 'category-header';
    const symbol = document.createElement('span');
    symbol.className = 'rule-badge';
    symbol.textContent = category.symbol;
    symbol.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h3');
    title.textContent = category.name;
    header.append(symbol, title);
    const description = document.createElement('p');
    description.textContent = category.description;
    const details = document.createElement('details');
    details.dataset.category = category.id;
    details.open = expanded.has(category.id);
    const summary = document.createElement('summary');
    summary.textContent = `Preview ${category.domains.length} domains`;
    const note = document.createElement('p');
    note.textContent = category.note;
    const domains = document.createElement('ul');
    domains.className = 'category-domains';
    for (const domain of category.domains) {
      const item = document.createElement('li');
      item.textContent = domain;
      domains.append(item);
    }
    details.append(summary, note, domains);
    const status = document.createElement('span');
    status.className = 'category-status';
    status.textContent = rule?.enabled ? state.settings.enabled ? 'Category is on' : 'Selected · blocking paused' : rule ? 'Category is paused' : 'Not added';
    const control = button(rule?.enabled ? 'Pause category' : rule ? 'Enable category' : 'Block category', () => {
      if (rule?.enabled && needsUnlock()) return;
      void action(async () => {
        if (rule) await request('update-rule', { id: rule.id, rule: { ...rule, enabled: !rule.enabled } });
        else await request('add-rule', { rule: { kind: 'category', value: category.id, enabled: true, redirect: '' } });
      }, rule?.enabled ? `${category.name} category paused.` : `${category.name} category added. ${category.domains.length} domains covered.`);
    }, rule?.enabled ? 'secondary full-width' : 'primary full-width');
    control.setAttribute('aria-label', `${control.textContent}: ${category.name}`);
    card.append(header, description, details, status, control);
    list.append(card);
  }
}

function hydrateIcon(badge: HTMLElement, domain: string): void {
  if (element('rules-panel').hidden || !state.settings.iconPings) return;
  void request<string | null>('favicon', { domain }).then(data => {
    if (!data || !badge.isConnected || !state.settings.iconPings || element('rules-panel').hidden) return;
    const image = document.createElement('img');
    image.alt = '';
    image.width = 22;
    image.height = 22;
    image.dataset.source = 'download';
    image.addEventListener('load', () => {
      if (badge.isConnected && state.settings.iconPings && !element('rules-panel').hidden) badge.replaceChildren(image);
    }, { once: true });
    image.src = data; // Display only; no retained result map or storage write.
  }).catch(() => {});
}

async function action(work: () => Promise<void>, message = ''): Promise<void> {
  if (busy) return;
  busy = true;
  try { await work(); await load(); if (message) notify(message); }
  catch (error) { notify(error instanceof Error ? error.message : 'Something went wrong.', true); }
  finally { busy = false; }
}

function needsUnlock(): boolean {
  if (!state.settings.password || state.unlocked) return false;
  showUnlock();
  return true;
}
function showUnlock(): void {
  input('unlock-password').value = '';
  element('unlock-error').textContent = '';
  unlockDialog.showModal();
  input('unlock-password').focus();
}
function button(text: string, onClick: () => void, className = 'text-button'): HTMLButtonElement {
  const node = document.createElement('button');
  node.textContent = text;
  node.className = className;
  node.addEventListener('click', onClick);
  return node;
}

function showConfirmation(title: string, description: string, confirmLabel: string, cancelLabel: string, run: () => Promise<void>, success: string): void {
  if (busy || confirmationDialog.open) return;
  confirmation = { run, success };
  element('confirmation-title').textContent = title;
  element('confirmation-description').textContent = description;
  element('confirmation-submit').textContent = confirmLabel;
  element('confirmation-cancel').textContent = cancelLabel;
  element('confirmation-error').textContent = '';
  confirmationDialog.showModal();
  element('confirmation-cancel').focus();
}

function renderRules(): void {
  const { settings } = state;
  // Keep unchanged visible DOM, not a separate icon cache. Periodic insights
  // refreshes must not cause repeated website requests.
  const signature = JSON.stringify([settings.rules, settings.enabled, settings.iconPings, element('rules-panel').hidden]);
  if (signature === renderedRules) return;
  renderedRules = signature;
  element('blocking-status').textContent = settings.enabled ? '● Blocking is on' : '○ Blocking is paused';
  element('blocking-status').classList.toggle('paused', !settings.enabled);
  element('toggle-blocking').textContent = settings.enabled ? 'Pause blocking' : 'Resume blocking';
  element('rule-count').textContent = String(settings.rules.length);
  const list = element('rules-list');
  list.replaceChildren();
  if (!settings.rules.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No boundaries yet. Start with one place you’d like a little distance from.';
    list.append(empty);
  }
  for (const rule of settings.rules) {
    const category = rule.kind === 'category' ? categoryById(rule.value) : undefined;
    const name = category?.name ?? rule.value;
    const row = document.createElement('article');
    row.className = `rule-row${rule.enabled ? '' : ' disabled'}`;
    const badge = document.createElement('span');
    badge.className = 'rule-badge';
    badge.textContent = category?.symbol ?? (ruleDomain(rule) ? '◌' : '#');
    badge.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div');
    info.className = 'rule-info';
    const title = document.createElement('strong');
    title.textContent = name;
    const detail = document.createElement('p');
    detail.textContent = `${category ? `Category · ${category.domains.length} domains + subdomains` : rule.kind === 'domain' ? 'Domain + subdomains' : rule.kind === 'url' ? 'URL path + descendants · includes subdomains' : 'Keyword · substring'} → ${rule.redirect || 'Your calm page'}${rule.enabled ? '' : ' · Paused'}`;
    info.append(title, detail);
    const controls = document.createElement('div');
    controls.className = 'rule-actions';
    controls.append(button('Destination', () => {
      if (needsUnlock()) return;
      editing = rule;
      input('edit-redirect').value = rule.redirect;
      element('edit-error').textContent = '';
      editDialog.showModal();
    }), button(rule.enabled ? 'Pause' : 'Enable', () => {
      if (rule.enabled && needsUnlock()) return;
      void action(async () => { await request('update-rule', { id: rule.id, rule: { ...rule, enabled: !rule.enabled } }); }, rule.enabled ? 'Boundary paused.' : 'Boundary enabled.');
    }), button('Remove', () => {
      if (needsUnlock()) return;
      showConfirmation('Remove this boundary?', `“${name}” will no longer be blocked by this rule. Other boundaries will stay unchanged.`, 'Remove boundary', 'Keep boundary', async () => { await request('delete-rule', { id: rule.id }); }, 'Boundary removed.');
    }, 'text-button danger'));
    for (const control of controls.querySelectorAll('button')) control.setAttribute('aria-label', `${control.textContent}: ${name}`);
    row.append(badge, info, controls);
    list.append(row);
    const host = ruleDomain(rule);
    if (host) hydrateIcon(badge, host);
  }
}

function renderInsights(): void {
  const days = Number(element<HTMLSelectElement>('insights-range').value);
  const entries = totals(state.insights, days);
  const sum = entries.reduce((total, [, ms]) => total + ms, 0);
  element('total-time').textContent = duration(sum);
  element('domain-count').textContent = String(entries.length);
  element('top-domain').textContent = entries[0]?.[0] ?? 'Nothing yet';
  chart(element('insights-chart'), entries);
  const tbody = element('domain-table');
  tbody.replaceChildren();
  for (const [domain, ms] of entries) {
    const tr = document.createElement('tr');
    for (const value of [domain, duration(ms), `${(ms / sum * 100).toFixed(1)}%`]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    tbody.append(tr);
  }
  if (!entries.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'No browsing time recorded in this period.';
    tr.append(td);
    tbody.append(tr);
  }
}

function renderSettings(): void {
  input('fetch-favicons').checked = Boolean(state.settings.iconPings);
  const protectedSettings = Boolean(state.settings.password);
  element('password-create').hidden = protectedSettings;
  element('password-manage').hidden = !protectedSettings;
  element('password-status').textContent = protectedSettings ? state.unlocked ? 'Unlocked · 5 min' : 'Protected' : 'Optional';
  element('unlock-state').textContent = state.unlocked ? 'Your settings are temporarily unlocked. Lock them again when you’re done.' : 'Your boundaries are protected. Adding a new rule is still available.';
  element('open-unlock').hidden = state.unlocked;
  element('lock-now').hidden = !protectedSettings || !state.unlocked;
}

function setTab(tab: string): void {
  if (!['rules', 'insights', 'settings'].includes(tab)) tab = 'rules';
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(node => {
    const selected = node.dataset.tab === tab;
    node.classList.toggle('active', selected);
    if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
  });
  for (const name of ['rules', 'insights', 'settings']) element(`${name}-panel`).hidden = name !== tab;
  history.replaceState(null, '', `#${tab}`);
  notify('');
  if (state) renderRules();
}
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(node => node.addEventListener('click', () => setTab(node.dataset.tab!)));
setTab(location.hash.slice(1));
element<HTMLSelectElement>('rule-kind').addEventListener('change', () => {
  const kind = element<HTMLSelectElement>('rule-kind').value;
  element('value-label').textContent = kind === 'url' ? 'Domain + path' : kind === 'keyword' ? 'Keyword' : 'Domain';
  input('rule-value').placeholder = kind === 'url' ? 'e.g. instagram.com/reels' : kind === 'keyword' ? 'e.g. sudoku' : 'e.g. reddit.com';
  input('rule-value').maxLength = kind === 'url' ? 2048 : 120;
  element('rule-help').textContent = kind === 'url' ? 'Blocks this path and descendants, not the entire site. Case-insensitive; includes subdomains. A broader domain/category block still applies.' : kind === 'keyword' ? 'Substring matches in hostnames, URL paths and supported search queries. “sudoku” matches sudoku.com and “sudokus”.' : 'Includes subdomains. Similar domain names stay allowed.';
});
element('rule-form').addEventListener('submit', event => {
  event.preventDefault();
  void action(async () => {
    await request('add-rule', { rule: { kind: element<HTMLSelectElement>('rule-kind').value, value: input('rule-value').value, redirect: input('rule-redirect').value, enabled: true } });
    input('rule-value').value = '';
    input('rule-redirect').value = '';
    input('rule-value').focus();
  }, 'A little less noise. Boundary added.');
});
element('toggle-blocking').addEventListener('click', () => {
  if (state.settings.enabled && needsUnlock()) return;
  void action(async () => { await request('set-enabled', { enabled: !state.settings.enabled }); }, state.settings.enabled ? 'Blocking paused.' : 'Your boundaries are back.');
});
element('edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!editing) return;
  try {
    await request('update-rule', { id: editing.id, rule: { ...editing, redirect: input('edit-redirect').value } });
    editDialog.close();
    await load();
    notify('Destination updated.');
  } catch (error) { element('edit-error').textContent = (error as Error).message; }
});
element('cancel-edit').addEventListener('click', () => editDialog.close());
element('insights-range').addEventListener('change', renderInsights);
element('password-form').addEventListener('submit', event => {
  event.preventDefault();
  if (input('new-password').value !== input('confirm-password').value) { notify('The passwords do not match.', true); return; }
  void action(async () => {
    await request('set-password', { password: input('new-password').value });
    element<HTMLFormElement>('password-form').reset();
  }, 'Password protection enabled. Keep your password somewhere safe.');
});
element('open-unlock').addEventListener('click', showUnlock);
element('cancel-unlock').addEventListener('click', () => unlockDialog.close());
element('unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = element<HTMLFormElement>('unlock-form').querySelector<HTMLButtonElement>('[type=submit]')!;
  submit.disabled = true;
  try {
    await request('unlock', { password: input('unlock-password').value });
    input('unlock-password').value = '';
    unlockDialog.close();
    await load();
    notify('Settings unlocked for five minutes. You can now make your change.');
  } catch (error) { element('unlock-error').textContent = (error as Error).message; }
  finally { submit.disabled = false; }
});
unlockDialog.addEventListener('close', () => { input('unlock-password').value = ''; });
element('lock-now').addEventListener('click', () => { void action(async () => { await request('lock'); }, 'Settings locked.'); });
element('remove-password').addEventListener('click', () => {
  if (needsUnlock()) return;
  showConfirmation('Remove password protection?', 'Your boundaries will remain in place, but changing or removing them will no longer require a password. There is still no recovery for a forgotten password.', 'Remove protection', 'Keep protection', async () => { await request('remove-password'); }, 'Password protection removed.');
});
element('export-json').addEventListener('click', () => {
  void action(async () => {
    const fresh = await snapshot();
    download(`still-harbor-${dayKey()}.json`, JSON.stringify({ version: 1, categoryListVersion: CATEGORY_VERSION, exportedAt: new Date().toISOString(), settings: { enabled: fresh.settings.enabled, iconPings: Boolean(fresh.settings.iconPings), rules: fresh.settings.rules }, categoryDomains: Object.fromEntries(fresh.settings.rules.filter(rule => rule.kind === 'category').map(rule => [rule.value, categoryById(rule.value)?.domains ?? []])), insights: fresh.insights }, null, 2), 'application/json');
  }, 'Local export created. Keep it private.');
});
element('export-csv').addEventListener('click', () => {
  void action(async () => {
    const fresh = await snapshot();
    const rows = ['date,domain,active_seconds'];
    for (const [day, domains] of Object.entries(fresh.insights).sort()) {
      for (const [domain, ms] of Object.entries(domains)) rows.push(`${day},"${domain.replace(/"/g, '""')}",${(ms / 1000).toFixed(1)}`);
    }
    download(`still-harbor-insights-${dayKey()}.csv`, rows.join('\n'), 'text/csv');
  }, 'Insights exported.');
});
element('delete-insights').addEventListener('click', () => {
  showConfirmation('Make a fresh start?', 'This permanently deletes your browsing insights. Your boundaries and password protection will stay unchanged. Export your insights first if you want to keep a copy.', 'Delete insights', 'Keep insights', async () => { await request('delete-insights'); }, 'Your insights have been cleared. A fresh start.');
});
element('confirmation-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !confirmation) return;
  const selected = confirmation;
  const submit = element<HTMLButtonElement>('confirmation-submit');
  const cancel = element<HTMLButtonElement>('confirmation-cancel');
  busy = true;
  submit.disabled = true;
  cancel.disabled = true;
  element('confirmation-error').textContent = '';
  try {
    await selected.run();
    confirmationDialog.close();
    await load();
    notify(selected.success);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    if (confirmationDialog.open) element('confirmation-error').textContent = message;
    else notify(message, true);
  } finally {
    submit.disabled = false;
    cancel.disabled = false;
    busy = false;
  }
});
element('confirmation-cancel').addEventListener('click', () => { if (!busy) confirmationDialog.close(); });
confirmationDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
confirmationDialog.addEventListener('close', () => { confirmation = null; });
input('fetch-favicons').addEventListener('change', () => {
  const enabled = input('fetch-favicons').checked;
  void action(async () => { await request('set-icon-fetch', { enabled }); }, enabled ? 'Website icon fetching enabled. Sites will be contacted; icons are displayed temporarily, not saved.' : 'Website icon fetching is off. No icons are saved.');
});
const bundles = element<HTMLDetailsElement>('category-bundles');
void chrome.storage.local.get('bundlesExpanded').then(stored => { bundles.open = stored.bundlesExpanded === true; }).catch(() => {});
bundles.addEventListener('toggle', () => { void chrome.storage.local.set({ bundlesExpanded: bundles.open }).catch(() => {}); });
setupIncognito();
element('release-version').textContent = `v${chrome.runtime.getManifest().version}`;
void load().catch(error => notify(error.message, true));
setInterval(() => { if (!busy && !unlockDialog.open && !editDialog.open && !confirmationDialog.open) void load().catch(error => notify(error.message, true)); }, 30000);
