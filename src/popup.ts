import { matchedRule, totals, type Snapshot } from './core';
import { chart, element, notify, request, snapshot } from './ui';

let state: Snapshot;
let currentDomain = '';
async function load(): Promise<void> {
  state = await snapshot();
  const active = state.settings.enabled;
  element('popup-status').classList.toggle('paused', !active);
  element('popup-status').title = active ? 'Blocking is on' : 'Blocking is paused';
  element('boundary-count').textContent = String(state.settings.rules.filter(rule => rule.enabled).length);
  chart(element('popup-chart'), totals(state.insights, 1), true);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentDomain = '';
  if (tab?.url && !tab.incognito) {
    try {
      const url = new URL(tab.url);
      if (['http:', 'https:'].includes(url.protocol)) currentDomain = url.hostname.replace(/\.$/, '');
    } catch { /* Not a website tab. */ }
  }
  const alreadyBlocked = Boolean(currentDomain && matchedRule({ ...state.settings, enabled: true }, `https://${currentDomain}/`));
  element('current-domain').textContent = currentDomain ? `You’re at ${currentDomain}` : '';
  element('block-current').hidden = !currentDomain || alreadyBlocked;
}
function tab(insights: boolean): void {
  element('overview-content').hidden = insights;
  element('insights-content').hidden = !insights;
  element('overview-tab').setAttribute('aria-selected', String(!insights));
  element('insights-tab').setAttribute('aria-selected', String(insights));
}
element('overview-tab').addEventListener('click', () => tab(false));
element('insights-tab').addEventListener('click', () => tab(true));
for (const id of ['overview-tab', 'insights-tab']) element(id).addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const insights = id === 'overview-tab';
    tab(insights);
    element(insights ? 'insights-tab' : 'overview-tab').focus();
  }
});
element('open-dashboard').addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});
element('block-current').addEventListener('click', async () => {
  const button = element<HTMLButtonElement>('block-current');
  button.disabled = true;
  try {
    await request('add-rule', { rule: { kind: 'domain', value: currentDomain, redirect: '', enabled: true } });
    // New network rules apply to the next navigation; also leave the current page.
    if (state.settings.enabled) {
      const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (current?.id !== undefined) await chrome.tabs.update(current.id, { url: chrome.runtime.getURL('page.html') });
    }
    notify('Boundary added.');
    await load();
  } catch (error) { notify((error as Error).message, true); }
  finally { button.disabled = false; }
});
void load().catch(error => notify(error.message, true));
