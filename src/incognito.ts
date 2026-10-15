import { element, notify } from './ui';

// Chrome alone controls this permission; never present this as an in-app toggle.
export function setupIncognito(): void {
  const refresh = async () => {
    const allowed = await chrome.extension.isAllowedIncognitoAccess();
    element('incognito-status').textContent = allowed ? 'Allowed in Incognito' : 'Not allowed in Incognito';
    element('enable-incognito').textContent = allowed ? 'Incognito settings' : 'Enable in Incognito';
  };
  element('enable-incognito').addEventListener('click', () => {
    if (chrome.extension.inIncognitoContext) {
      notify('In a regular window, open chrome://extensions → Still Harbor → Details → Allow in Incognito.');
      return;
    }
    const url = `chrome://extensions/?id=${chrome.runtime.id}`;
    void chrome.tabs.create({ url }).catch(() => {
      notify('Open chrome://extensions, choose Still Harbor → Details, then turn on Allow in Incognito.');
    });
  });
  window.addEventListener('focus', () => { void refresh().catch(() => {}); });
  void refresh().catch(() => notify('Check Incognito access in Chrome’s extension settings.', true));
}
