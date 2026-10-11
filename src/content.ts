// No page contents, keystrokes, or search queries are stored. Only send the URL
// transiently to catch decoded navigations which native rules cannot express.
function check(): void {
  void chrome.runtime.sendMessage({ type: 'check-url', url: location.href }).catch(() => {});
}
check();
window.addEventListener('popstate', check);
window.addEventListener('hashchange', check);
window.addEventListener('pageshow', check);
