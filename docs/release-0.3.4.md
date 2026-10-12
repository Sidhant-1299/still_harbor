# Still Harbor 0.3.4

- Removed the bundled Facebook logo and Chrome favicon-cache lookups; removed the `favicon` permission.
- Website icons come only from explicitly authorized HTTPS favicon.ico requests, default off. Legacy settings require fresh opt-in.
- Removed all persistent/session and retained-result icon caching. Active requests and displayed images use temporary memory only. Requests use no-store; unchanged list refreshes do not initiate repeated requests.
- Startup deletes the old saved `favicons` storage key; disabling requests cancels pending work and removes images.
- Updated Settings, privacy policy, README, store-listing draft and publishing instructions to match.

The bundled Facebook logo from 0.3.3 has been removed. This does not establish legal clearance for the product name or every aspect of distribution. Public privacy-policy hosting, publisher/support details and store disclosures remain publisher tasks. Compilation/tests do not certify legal compliance or guarantee store approval.

The original release checks passed: strict TypeScript, 21 unit tests, 14 Chromium extension tests, production build, MV3 release checks and whitespace checks. The removed artwork/cache-specific tests were replaced with no-storage, fresh-request, opt-out, concurrency and upgrade-cleanup coverage.

## Install

Download [still-harbor-0.3.4.zip](https://github.com/Sidhant-1299/still_harbor/releases/download/v0.3.4/still-harbor-0.3.4.zip), extract it, and load the folder containing `manifest.json` from `chrome://extensions` with Developer mode enabled. See the [Chrome setup guide](../README.md#install-in-chrome) for the full steps.

This release is for desktop Chrome. It is not a Chrome Web Store submission or a verified Orion iPhone build.

## GitHub publication checks

On October 11, 2026, the checks were rerun for GitHub publication: strict TypeScript, all 21 unit tests, all 14 Chromium extension tests, production build, release verification, and whitespace checks passed.

The keyboard test now uses native select type-ahead on headless macOS, where arrow-key menu selection was not working in the test browser. The extension itself was not changed. All 15 files in the supplied ZIP match the fresh build byte for byte.

SHA-256 for `still-harbor-0.3.4.zip`:

```text
a27e9d18b887961f0ed239f7109f02b250393a3b7fc880cd05b79923a748ab87
```
