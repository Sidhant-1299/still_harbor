# Still Harbor mission and handoff

## Why it exists

Still Harbor helps people reclaim attention without shame, surveillance, or unnecessary complexity. It puts a calm, self-chosen boundary between an intention and a distracting browsing habit. It is not a punishment, productivity leaderboard, or unbreakable lock.

People should be able to keep the useful parts of a website while blocking the parts they find compulsive. Blocking `instagram.com/reels` without blocking Instagram's homepage or messages is the guiding example. The quiet landing page, chosen redirects, and local browsing-time reflections serve the same purpose.

## Product decisions to preserve

- Keep the existing font and calm visual style. Do not turn the interface into a noisy dashboard.
- Keep optional category bundles below individual boundaries, collapsed by default.
- Use in-app confirmations rather than browser `alert()` or `confirm()` popups.
- Give dropdown arrows comfortable spacing.
- Do not add analytics, remote fonts, accounts, cloud sync, monetization, or a proxy icon service without a new product decision.

## Current release: 0.3.4

This is a working TypeScript-built Chrome Manifest V3 extension, tested in Chromium.

- Exact domain and subdomain boundaries, without fuzzy hostname matches.
- Domain-plus-path boundaries. `instagram.com/reels` covers `/reels` and descendants, not `/reels-other`. Paths are case-insensitive. Queries do not bypass a matching path. Path rules do not override broader boundaries.
- Case-insensitive keyword substrings in decoded URL paths and supported search-query values, not page contents.
- Optional, bundled starter categories for social media, pornography, and betting/gambling. Lists are transparent, incomplete, and intended for protective blocking.
- Per-rule HTTP/HTTPS redirects or the bundled quiet page, with redirect-loop validation.
- Native main-frame blocking plus checks for existing tabs and client-side navigation. Some encoded edge cases are checked only after navigation commits.
- Local daily active browsing time by hostname, retained for 90 local calendar days, with charts, exports, and deletion.
- Optional password protection enforced in the background worker. It adds friction, not tamper-proof security, and has no recovery.

Insights continue recording while blocking is paused. Deleting insights starts a fresh record, not a permanent recording opt-out. Exports are unencrypted and cannot currently restore an installation. Uninstalling or resetting can lose local data.

## Website icons: final decision

Earlier versions used a bundled Facebook logo, Chrome favicon lookup, and saved icon results. Those decisions were rejected and are superseded.

1. Do not bundle third-party website logos. Keep the extension's own generated application icons.
2. Do not use Chrome's favicon cache or request the `favicon` permission.
3. Make no website icon requests by default. Explicit consent permits direct HTTPS `favicon.ico` requests for individual boundary domains, with a possible same-domain `www` retry.
4. Do not save icon bytes or failed results in local/session storage or a retained result cache. Active requests and visible images may hold data temporarily for display.
5. Omit cookies and referrers, refuse redirects, and use `cache: 'no-store'`. Explain that sites still see the user's IP address.
6. Bound size, concurrency, and timeouts. Reject SVG/HTML. Keep a simple symbol when no icon is available.
7. Upgrades remove the old `favicons` storage key and require fresh consent. Disabling requests cancels pending work and removes displayed icons.
8. Preserve unchanged visible list DOM during periodic refreshes. Reloading or revisiting may fetch again because there is no retained cache.

## Maintaining the project

Use [the reference](docs/reference.md) for source layout, behavior, permissions, and limits. The source manifest is `public/manifest.json`; keep its version aligned with `package.json`. `dist/` is generated and ignored by Git. Load that folder for source-based installation. Release ZIPs put `manifest.json` at the archive root.

Run the checks in [README.md](README.md#build-from-source) after changes. The original 0.3.4 baseline was 21 unit tests and 14 Chromium extension tests. That history is not a reason to skip fresh checks. Browser icon tests mock responses rather than contacting blocked websites.

Review source commits and history for secrets, personal exports, profiles, and screenshots with personal data. Keep dependencies, generated output, and test artifacts out of Git. Preserve unrelated owner changes. Confirm publication destinations and use normal Git history, not force-pushes. The owner chose MIT for this repository.

## Chrome Web Store work remains separate

A GitHub push is not a Chrome Web Store submission. Before store submission, host the current privacy policy publicly over HTTPS, supply real publisher/support details and listing assets, enable two-step verification, and complete accurate data-use and permission disclosures.

Local browsing activity is still handled user data. Do not claim the extension handles no data. Explain the single purpose and Limited Use commitment. Review current store policies and the working name before distribution. Removing the Facebook logo is not blanket legal clearance. Tests do not certify legal compliance or store approval.

Use [publishing.md](docs/publishing.md) and [store-listing.md](docs/store-listing.md) as starting points, not proof these external steps are complete.

## Orion on iPhone

The owner wants to try Orion on iPhone. No successful installation or device test has been reported. File-based extension installation instructions are not proof this package works there.

Chrome remains the supported and tested platform. Orion's incomplete APIs may affect service workers, native network rules, navigation events, idle/focus signals, and session storage. Capture the exact error, Orion/iOS versions, and reproduction steps if testing fails. Test on a real device before promising support. Keep any compatibility build separate from stable Chrome and do not silently weaken its guarantees.

## Success

A person can set precise boundaries, understand what is recorded or requested, retain control over local data, and meet a gentle interface rather than judgment. Keep the repository understandable, the Chrome build reproducible, and publication claims truthful.
