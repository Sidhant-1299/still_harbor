# Still Harbor

A local-only Chrome extension for calmer browsing. Block domains and keyword substrings, redirect each rule to a chosen URL or a quiet page, and reflect on where your active browsing time goes.

## Try it in Chrome

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome 120 or newer.
2. Enable **Developer mode**.
3. Click **Load unpacked**, then select this project's **`dist/`** folder.
4. Pin **Still Harbor** in the toolbar. Use **Open your space** to manage rules, insights, and settings.

After changing source files, run `npm run build` and reload the extension in `chrome://extensions`. Reload any open extension pages as well. Loading from the same folder preserves your local data; uninstalling/resetting does not.

## Features

- **Website boundaries:** `example.com` includes `www.example.com` and other subdomains, but not `notexample.com` or `example.com.evil.test`. An entered `www.example.com` is that specific hostname and its children, not the parent `example.com`.
- **Keyword boundaries:** case-insensitive substring matching in decoded URL paths and supported search-query values. `sudoku` matches `/sudoku`, `/sudokus`, and `?q=learn+sudoku`; it does not match `sudoky`. Hostnames, fragments, page text, and unrelated query parameters are not keyword-matched.
- **Search support:** Google (`google.com`), Bing, DuckDuckGo, Brave Search, and Yahoo; query parameters `q`, `query`, `search_query`, and `p`. Country-specific Google domains and on-site searches are not currently supported unless their URL path matches. Add domain rules when you need broader coverage.
- **Per-rule redirects:** an HTTP/HTTPS destination, including an optional path, or the bundled calm `page.html` when empty. Destinations matching any active block are rejected to prevent loops. The first enabled rule in the list wins when rules overlap.
- **Immediate boundaries:** newly added/enabled rules are also checked against already-open, non-private website tabs.
- **Insights:** a popup pie/donut chart, full dashboard, domain table, and today/7/30/90-day views. Only focused, active browsing counts, with a 60-second idle threshold.
- **Local data:** daily hostname/time totals kept for 90 local calendar days. JSON export includes rules and insights; CSV includes daily insights. Export files are unencrypted. Export/import restore is not implemented; exports are for your records.
- **Optional password:** protects weakening restrictions. New rules and re-enabling restrictions remain available while locked. Unlocking lasts five minutes; you can lock immediately. Five failed attempts trigger a one-minute wait. Passwords use salted PBKDF2-SHA-256 with 310,000 iterations; plaintext passwords are never stored.
- **Accessible calm UI:** responsive dashboard, system fonts, keyboard controls, semantic labels, and a breathing animation that respects reduced-motion preferences.

### Password warning

**There is no password recovery.** If you forget it, remove the extension, clear its local data if your browser retains it, and reinstall. Rules, settings, and browsing insights will be lost. Save an export beforehand if you want a record of your data. Passwords are optional and intended as friction—not tamper-proof security. Browser extension controls, uninstalling, local storage edits, and developer tools can bypass the deterrent.

Deleting insights does not delete rules or remove your password. Browsing tracking resumes immediately afterwards.

## Privacy and permissions

All application data is stored in `chrome.storage.local`, not browser-sync storage or a `.config` directory. Temporary activity state, unlock expiry, and failed-attempt counters use `chrome.storage.session`. Only trusted extension contexts can access stored data. No accounts, remote fonts, cloud sync, analytics, external libraries at runtime, or extension-initiated telemetry requests are used. Custom redirects naturally navigate to the destination you choose.

Insights store **hostname → daily active milliseconds**. Full URLs and search queries are examined transiently for blocking but are not persisted. Saved rules include the keyword/domain and redirect URL you intentionally enter. JSON exports omit the password verifier. Private/incognito browsing is not tracked; leave **Allow in incognito** disabled, since blocking there is outside this release's supported scope.

Permissions:

| Permission | Why |
| --- | --- |
| `storage` | Local settings, password verifier, and insights |
| `declarativeNetRequest` + HTTP/HTTPS hosts | Native domain/keyword redirects before normal navigation requests |
| `tabs` | Current website, foreground tab, redirects, and closing the calm tab |
| `webNavigation` + a document-start content script | Enforce decoded URL edge cases and client-side navigation changes; verify current documents to avoid stale redirects |
| `idle` | Stop counting idle/locked browsing |
| `alarms` | Checkpoint active time and prune expired daily totals every 30 seconds |

Time totals are an estimate, not machine-wide screen time. Background tabs, browser-internal pages, extension pages, other apps, and private tabs are excluded. Worker suspension, sleep, crashes, very fast focus changes, and abrupt closure can leave small gaps. Stale activity is capped to 60 seconds to avoid counting an entire sleep period. Hostnames/subdomains are tracked individually, rather than merged into a parent domain. Retention pruning runs at startup, on checkpoints, and when viewing/exporting insights; if the browser is closed, pruning resumes when it starts again.

Chrome's regex engine has a per-rule memory limit. Short keywords support mixed literal/percent-encoded characters natively. When needed, longer keywords use a simpler literal/fully-encoded native fallback (split into separate rules if necessary); unusual mixed encodings are caught after navigation commits, so that fallback cannot guarantee the request never reaches the website. Query parameter names `q` and `p` support percent encoding natively; encoded multi-character parameter names rely on post-commit checks. A native-missed navigation that starts a download does not commit a page and can evade those checks. Keywords still too complex for Chrome are rejected without changing existing rules. Up to 450 user rules are supported, subject to a 900 native-rule budget (longer keywords may need four native rules each). This is a navigation blocker, not a firewall or download blocker: cached/service-worker content, embedded resources, other browsers, external apps, and unsupported search engines are outside its guarantees.

## Development and tests

```sh
npm run check                  # strict TypeScript, unit tests, production build
npx playwright install chromium
npm run test:browser           # real unpacked-extension Chromium tests
```

Browser tests cover domain/subdomain redirects, encoded keyword substrings, longer keyword fallback, per-rule redirects, loop rejection, existing-tab enforcement, password checks in the background, unlock/lock, real activity totals, exports/deletion, popup charts, and narrow layouts. CI/headless environments report a locked desktop, so tests simulate the idle API's active state; navigation, storage, network rules, and UI use the real extension. Temporary test profiles are isolated under `/tmp/opencode/` and removed afterwards (create this directory first on another machine).

Source layout:

```text
src/core.ts          Pure rule matching, native rule generation, time aggregation, hashing
src/background.ts    Chrome APIs, authoritative settings changes, activity accounting
src/content.ts       Transient URL checks; no DOM/history collection
src/dashboard.ts     Full-page management and insights
src/popup.ts         Compact overview and insights
src/page.ts          Calm landing page
src/ui.ts            Shared UI helpers and chart rendering
public/              Bundled HTML, CSS, manifest
scripts/             Build and local PNG icon generation
tests/               Unit and browser tests
```

The rule/insights core is separate from browser integration for future ports. **Orion iOS support is unverified**, not promised: its extension API implementation is preliminary, and service workers, native blocking, idle/focus signals, and session storage need real-device testing. This Chrome package is not yet an Orion-ready release.

“Still Harbor” is a working product name, not a claim of trademark clearance. Check the name before public distribution.
