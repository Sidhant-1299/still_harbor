# Still Harbor 0.3.6 — Incognito blocking

## Changes

- Optional Incognito blocking for desktop Chrome on macOS, Windows and Linux, using split mode so the quiet page can load in private tabs.
- Popup and Settings & privacy show access status and link to Chrome's extension details. Users must manually enable **Allow in Incognito**.
- Existing domains, paths, keywords, categories and custom redirects apply in private windows. Regular-window settings changes also apply to open private tabs.
- Private activity is excluded from insights and exports. The private worker does not read/write insights, activity or password unlock state; it accepts blocking checks and a limited blocking-status request, not settings or export requests.
- Private popup hides insights and directs you to manage boundaries in a regular window.

## Verification

Automated checks completed on macOS: TypeScript, 22 unit tests, 16 browser tests, production build/package validation, and a Playwright MCP session covering the permission UI, private blocking/quiet-page rendering, private popup guidance, denied insights access and no private activity writes. The browser suite additionally covers paths, categories, search queries, SPA fallback, live changes, pause/resume and permission revocation.

The user confirmed the final local build works on Mac and approved publication. Windows/Linux and other Chromium browsers are not independently verified.

## Installation and manual checks

1. Extract `still-harbor-0.3.6.zip`. For an existing installation, replace files in the same folder and reload in `chrome://extensions`; do not uninstall or change the folder.
2. Verify existing boundaries, insights and password protection survived the update.
3. Check that Incognito access initially reflects Chrome's actual setting. Click **Enable in Incognito**, enable **Allow in Incognito**, and reopen any extension pages Chrome closes.
4. In an actual Mac Chrome Incognito window, test a domain/subdomain, specific path, keyword/search query, category and custom redirect. Default redirects should show the quiet page, not a Chrome error page.
5. Leave an allowed site open privately, then block it from a regular dashboard. Confirm the existing private tab redirects. Verify pause/resume follows regular-window settings.
6. Browse an unblocked site privately and switch/focus windows for at least a minute. Confirm its hostname never appears in normal insights or JSON/CSV exports. The private popup should show no insights or current-site shortcut.
7. Use **Manage in a regular window** from the private popup: it should explain how to open the regular dashboard, not expose private-window insights or settings. Verify password protection still works in the regular dashboard.
8. Disable **Allow in Incognito** again. Confirm normal blocking still works and the status reports access disabled. Private blocking is not expected without access.

Download the installable ZIP from the v0.3.6 GitHub release, not GitHub's source archives. Chrome requires you to enable **Allow in Incognito** manually; private blocking cannot work without this access.
