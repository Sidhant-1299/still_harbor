# Still Harbor

A local-only Chrome extension for calmer browsing. Block domains, specific URL paths, and keyword substrings, redirect each rule to a chosen URL or a quiet page, and reflect on where your active browsing time goes.

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
- **Specific URL/path boundaries:** choose **Specific URL / path** and enter `instagram.com/reels` (or `https://instagram.com/reels/`). This blocks `/reels`, `/reels/123`, and deeper descendants on that domain and its subdomains, but leaves the homepage, `/direct`, and `/reels-other` alone. Matching is case-insensitive across HTTP and HTTPS, and query strings on a matching path do not bypass the rule. An optional trailing `/*` is accepted; descendants are already included without it. You must include a full domain and a non-root path. Query/fragment-specific rules, ports, credentials, and arbitrary wildcards are not supported; remove query parameters/fragments from pasted rule inputs. **Existing whole-domain, keyword, or category boundaries still apply**—a URL rule is not an allowlist exception. Pause/remove any broader Instagram boundary if you want the rest of that site to remain accessible. Site logos, per-rule redirects, exports, existing-tab enforcement, and password protection also work with URL rules.
- **One-click categories:** bundled starter lists for **Social media (35 domains)**, **Pornography (35 domains)**, and **Betting & gambling (45 domains)**. The **A little less, all at once** section sits below your boundaries and is collapsed by default. Expand it to preview/select groups; your open/closed preference is remembered locally. Collapsing it does not disable selected blocks. Each category is one boundary; pause/remove it or change its destination using the normal controls. Existing individual rules remain intact. Lists are not exhaustive, never contact the listed sites, and only change when you install an updated extension. See [list scope and references](docs/categories.md).
- **Website icons:** none by default, including upgrades without an explicit icon-display preference. Enable **Settings & privacy → Show website icons** for bundled artwork and Chrome's saved favicons: easier recognition, but possibly missing/outdated icons. Facebook's f logo is bundled and works offline when icons are enabled. Separately opt into **Also fetch missing website icons from their sites** for better coverage at the cost of disclosing your IP to those sites. Hiding icons disables fetching and clears downloads. Blocking is unaffected; keywords retain `#` and categories retain group symbols.
- **Keyword boundaries:** case-insensitive substring matching in decoded URL paths and supported search-query values. `sudoku` matches `/sudoku`, `/sudokus`, and `?q=learn+sudoku`; it does not match `sudoky`. Hostnames, fragments, page text, and unrelated query parameters are not keyword-matched.
- **Search support:** Google (`google.com`), Bing, DuckDuckGo, Brave Search, and Yahoo; query parameters `q`, `query`, `search_query`, and `p`. Country-specific Google domains and on-site searches are not currently supported unless their URL path matches. Add domain rules when you need broader coverage.
- **Per-rule redirects:** an HTTP/HTTPS destination, including an optional path, or the bundled calm `page.html` when empty. Destinations matching any active block are rejected to prevent loops. Individual domain/URL/keyword rules take precedence over categories; within each tier, the first enabled rule in the list wins when rules overlap. A URL boundary can redirect to the same site's unblocked homepage, unless another rule blocks that destination.
- **Immediate boundaries:** newly added/enabled rules are also checked against already-open, non-private website tabs.
- **Insights:** a popup pie/donut chart, full dashboard, domain table, and today/7/30/90-day views. Only focused, active browsing counts, with a 60-second idle threshold.
- **Local data:** daily hostname/time totals kept for 90 local calendar days. JSON export includes rules, the selected categories' domain lists/version, and insights; CSV includes daily insights. Exports omit the password verifier and icon cache. Export files are unencrypted. Export/import restore is not implemented; exports are for your records.
- **Optional password:** protects weakening restrictions, including category changes. New rules and re-enabling restrictions remain available while locked unless they override an active category with a different destination. Unlocking lasts five minutes; you can lock immediately. Five failed attempts trigger a one-minute wait. Passwords use salted PBKDF2-SHA-256 with 310,000 iterations; plaintext passwords are never stored.
- **Accessible calm UI:** responsive dashboard, system fonts, keyboard controls, semantic labels, and a breathing animation that respects reduced-motion preferences.
- **In-app confirmations:** removing boundaries, removing password protection, and deleting insights use styled dialogs instead of browser JavaScript popups. Cancel/Escape leaves data unchanged; request errors appear inside the dialog, and password checks remain enforced in the background. The insights period selector has a comfortably inset arrow while keeping native keyboard selection.

### Password warning

**There is no password recovery.** If you forget it, remove the extension, clear its local data if your browser retains it, and reinstall. Rules, settings, and browsing insights will be lost. Save an export beforehand if you want a record of your data. Passwords are optional and intended as friction—not tamper-proof security. Browser extension controls, uninstalling, local storage edits, and developer tools can bypass the deterrent.

Deleting insights does not delete rules or remove your password. Browsing tracking resumes immediately afterwards.

## Privacy and permissions

All application data is stored in `chrome.storage.local`, not browser-sync storage or a `.config` directory. Temporary activity state, unlock expiry, and failed-attempt counters use `chrome.storage.session`. Only trusted extension contexts can access stored data. No accounts, remote fonts, cloud sync, analytics, external libraries at runtime, or extension-initiated telemetry requests are used. Custom redirects naturally navigate to the destination you choose.

**Opt-in local icon previews:** no artwork or Chrome favicon lookup is used until you enable website icons. The bundled Facebook PNG is a 32px conversion of Facebook's own favicon, retrieved from `https://facebook.com/favicon.ico` on 2026-10-11. The mark belongs to Meta and is shown only to identify the boundary, without implying endorsement. Other domain previews use Chrome's internal `_favicon` endpoint to read its saved favicons; no new site visit or third-party favicon service is used for this lookup. Chrome may only have a generic icon for an unvisited domain. This endpoint requires the `favicon` permission; with the existing tabs/host permissions, Chrome documents that it adds no separate permission warning. Older/unported browsers can fall back to the generic badge.

**Optional icon networking:** off by default, including when upgrading an existing installation. Enabling it allows a request to `https://<individual-domain>/favicon.ico` when viewing your domain or URL/path boundaries, except when bundled artwork already supplies the icon, with a possible second try at the same domain's `www` hostname. URL rules use the hostname's icon; no blocked path is fetched for its logo. These requests reveal your IP to that website. Cookies and referrers are omitted, redirects to other endpoints are refused, and no Google/proxy/favicon service is used. Categories do not trigger icon requests for their members. Literal IPs, localhost, and common local/test hostnames are not probed. Some websites only serve icons through a CDN or a different path; those keep their browser-cache fallback.

Downloaded icons are cached as raster image data URLs in browser-local storage (up to 48 icons, each at most 32 KiB before base64 encoding), for seven days. Failed requests are suppressed for one day; networking is limited to three requests at a time with a five-second overall timeout per domain. SVG/HTML responses are rejected. An additional page-session cache prevents periodic dashboard updates from re-fetching icons evicted from the durable cache. Turning network fetching off clears downloaded icons and cancels in-flight requests; removing an individual boundary prunes its downloaded icon. Use **Clear downloaded icon cache** for a manual reset. This does not remove bundled artwork or Chrome's own favicon cache.

Insights store **hostname → daily active milliseconds**. Visited full URLs and search queries are examined transiently for blocking but are not logged. Saved rules include the keyword/domain/URL prefix and redirect URL you intentionally enter. JSON exports omit the password verifier. Private/incognito browsing is not tracked; leave **Allow in incognito** disabled, since blocking there is outside this release's supported scope.

Permissions:

| Permission | Why |
| --- | --- |
| `storage` | Local settings, password verifier, insights, and optional favicon cache |
| `favicon` | Opt-in previews from Chrome's saved website icons |
| `declarativeNetRequest` + HTTP/HTTPS hosts | Native domain/URL/keyword/category redirects before normal navigation requests; hosts also allow optional direct favicon fetching |
| `tabs` | Current website, foreground tab, redirects, and closing the calm tab |
| `webNavigation` + a document-start content script | Enforce decoded URL edge cases and client-side navigation changes; verify current documents to avoid stale redirects |
| `idle` | Stop counting idle/locked browsing |
| `alarms` | Checkpoint active time and prune expired daily totals every 30 seconds |

Time totals are an estimate, not machine-wide screen time. Background tabs, browser-internal pages, extension pages, other apps, and private tabs are excluded. Worker suspension, sleep, crashes, very fast focus changes, and abrupt closure can leave small gaps. Stale activity is capped to 60 seconds to avoid counting an entire sleep period. Hostnames/subdomains are tracked individually, rather than merged into a parent domain. Retention pruning runs at startup, on checkpoints, and when viewing/exporting insights; if the browser is closed, pruning resumes when it starts again.

Chrome's regex engine has a per-rule memory limit. Short keywords and URL paths support mixed literal/percent-encoded characters natively. When needed, longer patterns use a simpler literal/fully-encoded native fallback (split into separate rules if necessary); unusual mixed encodings and encoded separators/dot-segment combinations are caught after navigation commits, so that fallback cannot guarantee the request never reaches the website. Query parameter names `q` and `p` support percent encoding natively; encoded multi-character parameter names rely on post-commit checks. Client-side path changes are checked by navigation events. A native-missed navigation that starts a download does not commit a page and can evade those checks. Patterns still too complex for Chrome are rejected without changing existing rules. Up to 450 user rules are supported, subject to a 900 native-rule budget (longer keywords may need four native rules each). This is a navigation blocker, not a firewall or download blocker: cached/service-worker content, embedded resources, other browsers, external apps, and unsupported search engines are outside its guarantees.

## Development and tests

```sh
npm run check                  # strict TypeScript, unit tests, production build
npx playwright install chromium
npm run test:browser           # real unpacked-extension Chromium tests
```

Browser tests cover domain/subdomain redirects, encoded keyword substrings, longer keyword fallback, per-rule redirects, loop rejection, existing-tab enforcement, password checks in the background, unlock/lock, real activity totals, exports/deletion, popup charts, narrow layouts, all three category groups, remembered bundle collapse state, category password enforcement, Facebook's offline logo, opt-in/cached downloads, and URL-path blocking without whole-site blocking (including client-side navigation). They also verify styled destructive confirmations, cancellation/Escape, inline errors if settings become locked while confirming, absence of native JavaScript dialogs, and keyboard operation/inset padding of the insights selector. CI/headless environments report a locked desktop, so tests simulate the idle API's active state; remote icon responses are mocked to avoid contacting real blocked sites. Navigation, storage, network rules, and UI use the real extension. Unit tests additionally check URL normalization/path boundaries, encoded paths, bundled PNG dimensions, browser-icon URLs, byte limits, MIME signatures, timeouts/cancellation, safe request options, cache expiry, and category-domain integrity. Temporary test profiles are isolated under `/tmp/opencode/` and removed afterwards (create this directory first on another machine).

Source layout:

```text
src/core.ts          Pure rule matching, native rule generation, time aggregation, hashing
src/categories.ts    Bundled starter category domains and metadata
src/favicons.ts      Bounded, opt-in direct icon networking and local cache
src/site-icons.ts    Bundled Facebook logo and internal Chrome favicon URLs
src/background.ts    Chrome APIs, authoritative settings changes, activity accounting
src/content.ts       Transient URL checks; no DOM/history collection
src/dashboard.ts     Full-page management and insights
src/popup.ts         Compact overview and insights
src/page.ts          Calm landing page
src/ui.ts            Shared UI helpers and chart rendering
public/              Bundled HTML, CSS, manifest
scripts/             Build and local PNG icon generation
tests/               Unit and browser tests
docs/                Category scope and reference material
```

The rule/insights core is separate from browser integration for future ports. **Orion iOS support is unverified**, not promised: its extension API implementation is preliminary, and service workers, native blocking, idle/focus signals, and session storage need real-device testing. This Chrome package is not yet an Orion-ready release.

“Still Harbor” is a working product name, not a claim of trademark clearance. Check the name before public distribution.
