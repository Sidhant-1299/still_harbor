# Still Harbor 0.3.4

- Removed the bundled Facebook logo and Chrome favicon-cache lookups; removed the `favicon` permission.
- Website icons come only from explicitly authorized HTTPS favicon.ico requests, default off. Legacy settings require fresh opt-in.
- Removed all persistent/session and retained-result icon caching. Active requests and displayed images use temporary memory only. Requests use no-store; unchanged list refreshes do not initiate repeated requests.
- Startup deletes the old saved `favicons` storage key; disabling requests cancels pending work and removes images.
- Updated Settings, privacy policy, README, store-listing draft and publishing instructions to match.

The bundled-logo rights concern from the 0.3.3 report is resolved by removal. Public privacy-policy hosting, publisher/support details and store disclosures remain publisher tasks. Compilation/tests do not certify legal compliance or guarantee store approval.

Verification passed: strict TypeScript, 21 unit tests, 14 Chromium extension tests, production build, MV3 release checks and whitespace checks. The removed artwork/cache-specific tests were replaced with no-storage, fresh-request, opt-out, concurrency and upgrade-cleanup coverage. The release ZIP is `/tmp/opencode/still-harbor-0.3.4.zip` with `manifest.json` at its root.
