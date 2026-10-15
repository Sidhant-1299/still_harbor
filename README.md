# Still Harbor

Keep the parts of the internet you need. Set boundaries around the parts you want to spend less time on.

Still Harbor is a Chrome extension that blocks websites, specific paths, and keywords in hostnames, URL paths, and supported search queries. A blocked visit takes you to a quiet page or a destination you choose. Browsing-time insights stay on your device. No accounts, analytics, or cloud sync.

## Install in Chrome

Use **desktop Chrome 120 or newer**. You do not need Node.js or a developer account to use the release download.

1. [Download still-harbor-0.3.6.zip](https://github.com/Sidhant-1299/still_harbor/releases/download/v0.3.6/still-harbor-0.3.6.zip). Choose this file, not GitHub's **Source code** archives.
2. Extract the ZIP into a folder you will keep, such as `Documents/Still Harbor`. Do not delete or move that folder while the extension is installed.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked**. Select the extracted folder containing `manifest.json`, not the ZIP itself.
6. Open Chrome's extensions menu, pin **Still Harbor**, and click its icon. Choose **Open your space**.

This is a manual installation from GitHub, not a Chrome Web Store installation. Chrome may show developer-mode notices. Managed work or school browsers may not allow unpacked extensions. Chrome on phones is not supported.

### Enable blocking in Incognito (0.3.6+)

Incognito support uses desktop Chrome APIs on **macOS, Windows and Linux**; it is not Mac-only. Automated browser verification is performed on macOS; Windows/Linux and other Chromium browsers are not independently verified.

1. In Still Harbor's popup or **Settings & privacy**, click **Enable in Incognito**. Alternatively, open `chrome://extensions`, find Still Harbor, and choose **Details**.
2. Turn on **Allow in Incognito**. Chrome requires you to grant this access manually; the extension cannot enable it for you. Chrome may close open extension pages while applying this change—reopen them afterwards.
3. Open an Incognito window (on Mac: **⌘⇧N**; on Windows/Linux: **Ctrl+Shift+N**) and try a blocked site.

Your existing active boundaries and redirects apply in private windows, including changes made in a regular window. **Private browsing is not recorded in insights or exports.** The private popup shows blocking status only; manage boundaries and view normal browsing insights in a regular window. Blocking cannot work in Incognito unless Chrome grants access, and pausing blocking also pauses it in private windows.

## Start with one boundary

To block Instagram Reels without blocking the whole of Instagram:

1. In **Open your space**, choose **Specific URL / path**.
2. Enter `instagram.com/reels`.
3. Leave the redirect destination empty to use the quiet page, then add the boundary.
4. Try visiting `https://www.instagram.com/reels/`. The boundary also covers paths below it, such as `/reels/123`.

Instagram's homepage and `/direct` remain available **unless another active boundary blocks them**. Pause any whole-domain Instagram boundary or social-media category if you want those parts to stay accessible. A path boundary does not override broader blocks.

For a whole website, use a domain such as `example.com`. It includes that site's subdomains, not lookalike names. Keyword boundaries match hostnames, URL paths, and supported search terms, not the text of a page. For example, `chess` blocks both `chess.com` and `mychessclub.com`. Choose a domain boundary if you only want one site and its subdomains. Optional category lists sit below your individual boundaries; expand **A little less, all at once** to review them before enabling anything.

Each boundary can use its own HTTP/HTTPS redirect. Leave it empty for the quiet page. You can pause or remove boundaries, with an optional password to make weakening them less immediate.

## Your data and control

- **Insights stay local.** The extension records daily active browsing time by hostname for 90 local calendar days. It examines visited URLs temporarily for blocking but does not log full browsing URLs, search terms, or page contents.
- **Pausing blocks does not pause recording.** Deleting insights clears the current record; recording then continues.
- **Exports are for your records.** JSON and CSV files are unencrypted. They cannot currently be imported to restore an installation.
- **Website icons are off by default.** Enabling them contacts individual websites for `favicon.ico`, revealing your IP address. Requests omit cookies and referrers. Icons are displayed temporarily, not saved. No third-party website logos are bundled.
- **Passwords have no recovery.** Password protection adds friction, not an unbreakable lock. Uninstalling or resetting can lose rules, settings, and insights.

Read the [full behavior and privacy reference](docs/reference.md), or open the bundled privacy policy from the dashboard.

## Updates and troubleshooting

Unpacked extensions do not update automatically. To update, close extension pages, replace the files in the **same installation folder** with the new release's extracted contents, then click **Reload** on Still Harbor in `chrome://extensions`. Reopen its pages. Keep the same folder to preserve the installation's local data; do not uninstall first.

- **Chrome cannot find the manifest:** choose the folder that directly contains `manifest.json`. For a source build, that folder is `dist/`.
- **More of a site is blocked than expected:** check for a whole-domain, keyword, or category boundary that also matches.
- **Something is not working:** [open an issue](https://github.com/Sidhant-1299/still_harbor/issues) with your Chrome version and steps to reproduce it. Do not attach personal exports or browsing data.

Still Harbor is a navigation blocker, not a firewall or download blocker. Some unusual URL encodings are checked only after navigation commits. Time totals are estimates of active Chrome browsing, not all screen time. [See the limits](docs/reference.md#privacy-and-permissions).

**Orion on iPhone is unverified.** This is the tested Chrome package, not an Orion-ready release.

## Build from source

Install Node.js 22 or newer with npm, then run:

```sh
git clone https://github.com/Sidhant-1299/still_harbor.git
cd still_harbor
npm ci
npm run build
```

Load `dist/` through **Load unpacked**. After source changes, build again and reload the extension and any open extension pages.

To run the checks:

```sh
npx playwright install chromium
mkdir -p /tmp/opencode
npm run check
npm run test:browser
git diff --check
```

`npm run check` runs TypeScript checks, unit tests, the production build, and package verification. Browser tests use an isolated Chromium profile and mock website icon responses.

## More about the project

- [Detailed reference and source layout](docs/reference.md)
- [Category lists and scope](docs/categories.md)
- [Release 0.3.6 and manual checks](docs/release-0.3.6.md)
- [Publishing checklist](docs/publishing.md) and [Chrome Web Store submission draft](docs/store-listing.md)

Licensed under [MIT](LICENSE). Still Harbor is a working product name, not a claim of trademark clearance. A GitHub release does not imply Chrome Web Store approval.
