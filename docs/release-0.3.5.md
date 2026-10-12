# Still Harbor 0.3.5

## Keyword blocking now includes hostnames

Previously, a `chess` or `sudoku` keyword boundary could block a matching URL path or supported search, but still let the site's homepage through. Keyword boundaries now also match hostnames, including already-open tabs.

- `chess` blocks `chess.com`, its subdomains, and other hostnames containing `chess`, such as `mychessclub.com`.
- `sudoku` blocks `sudoku.com` and its subdomains.
- Matching stays case-insensitive. Exact domain boundaries are unchanged.
- Credentials, ports, fragments, page contents, and unrelated query parameters are not keyword-matched. International hostnames use their ASCII/punycode form.
- Native rules retain hostname matching across encoding fallbacks, and redirect validation rejects destinations that match these keywords.

**Review existing keyword boundaries when upgrading.** They now cover more hostnames. Use a domain boundary if you want to block only a particular site and its subdomains.

## Install or update

Download [still-harbor-0.3.5.zip](https://github.com/Sidhant-1299/still_harbor/releases/download/v0.3.5/still-harbor-0.3.5.zip), extract it, and load the folder containing `manifest.json` through `chrome://extensions` with Developer mode enabled.

If Still Harbor is already installed, replace the files in the same installation folder, click **Reload**, and reopen any extension pages. Do not uninstall first if you want to retain local rules and insights. Unpacked extensions do not update automatically.

See the [Chrome setup guide](../README.md#install-in-chrome) for the full steps. The old 0.3.4 download remains available as a historical release and does not contain this fix.

Chrome is the supported platform. Orion on iPhone remains unverified. This release is not a Chrome Web Store submission.

## Verification

All 22 unit tests and 15 Chromium extension tests passed, along with strict TypeScript checks, production compilation, release verification, and whitespace checks. The new tests cover homepage and subdomain keyword blocking, already-open tabs, encoding fallbacks, unrelated URL fields, and redirect-loop prevention.

The ZIP contains all 15 files from the tested `dist/` build, with `manifest.json` at its root and version `0.3.5`. Every archived file matches that build byte for byte. Both the blocking script and dashboard differ from the old 0.3.4 package.

SHA-256 for `still-harbor-0.3.5.zip`:

```text
f3f8e8585b0190e7779aa0de4ed44ec9e9a11dfed2b945e0520a69663fe10326
```
