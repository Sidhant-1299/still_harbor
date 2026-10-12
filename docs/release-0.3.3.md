# Still Harbor 0.3.3: historical release checks

This report describes an older release. Version 0.3.4 removed the bundled Facebook logo, Chrome favicon-cache lookup, and saved icon results. See [the current release notes](release-0.3.4.md) for today's behavior.

## Changes

- Retained Chrome Manifest V3 with a background service worker and packaged scripts; explicitly disabled unsupported incognito use.
- Added a bundled privacy policy at `public/privacy.html`, linked from Settings and the dashboard footer.
- Corrected disclosures to distinguish domain-level browsing insights from stored user-entered rules, settings and password verifier. Disclosed recording while blocking is paused and after insight deletion.
- Added a Limited Use statement and disclosed separately opt-in favicon networking, retention, exports and password-reset limitations.
- Added `docs/store-listing.md` with single-purpose wording, prominent browsing-activity disclosure, permission justifications and publisher tasks.
- Added `scripts/verify-release.mjs` and integrated it into `npm run check` to verify the release manifest, version, assets, CSP and local HTML script references.

## Results

On October 11, 2026: strict TypeScript checks, 23 unit tests, 13 Chromium extension tests, production compilation, automated release verification and `git diff --check` passed. Package-lock installation reported zero known vulnerabilities; this is not a comprehensive security audit.

The Chromium tests exercise native and client-side blocking, redirects, passwords, categories, exports/deletion, opt-in icons, custom confirmations, dropdown spacing/keyboard interaction and the packaged privacy policy. They are not a claim that every browser or URL encoding is supported.

## Submission status: publisher action required

Reviewed Chrome Web Store Program Policies at https://developer.chrome.com/docs/webstore/program-policies/policies. The technical checks do not certify every term of Google's developer agreements, jurisdiction-specific law or third-party terms.

Before uploading, host the privacy policy publicly over HTTPS, provide the policy URL and real publisher/support details, complete privacy and permission disclosures, prepare listing assets and enable account 2-step verification. Review the bundled Facebook mark's applicable rights/branding basis, or replace it before publication. Attribution alone does not grant permission. These unresolved items mean the package is technically tested, not unconditionally approved for publication.

The source manifest is `public/manifest.json`; the compiled package manifest is `dist/manifest.json`. The store ZIP must place that manifest at its root.
