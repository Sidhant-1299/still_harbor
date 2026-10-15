# Publishing Still Harbor

## GitHub releases

The source repository and the installable extension are separate downloads. Keep generated `dist/`, ZIPs, dependencies, and browser profiles out of Git. Attach the tested extension ZIP to a versioned GitHub release instead.

1. Run `npm ci`, `npm run check`, and `npm run test:browser`. Install Playwright Chromium and create `/tmp/opencode` first, as shown in the README.
2. Check staged files and history for secrets or personal data. Run `git diff --check`.
3. Confirm that `package.json` and `public/manifest.json` use the same release version.
4. Package the contents of `dist/`, with `manifest.json` at the archive root. Compare any supplied ZIP with the freshly built files before attaching it.
5. Push normal history to the intended repository, then create the matching release tag and attach the ZIP. Include installation instructions and known limits.

Do not bump the version just to upload the repository. Downloading from GitHub does not mean the extension has been reviewed by the Chrome Web Store.

## Chrome Web Store packaging

`public/manifest.json` is the source Chrome Manifest V3 manifest. `npm run build` copies it to `dist/manifest.json`, alongside the compiled scripts, pages and generated extension icons. Upload a ZIP of the **contents** of `dist/`, with `manifest.json` at the ZIP root. Do not upload the source project or an enclosing `dist` folder.

The manifest includes a release version, description, extension icons, popup, options page, service worker, navigation checks and a self-hosted-script content security policy. No development key, localhost endpoint or remotely hosted JavaScript is included. Broad HTTP/HTTPS host access is needed for user-selected blocking and explicitly opt-in favicon.ico requests. No website artwork or icon cache is bundled/saved; the Chrome `favicon` permission is not requested. See the permission table and privacy details in `README.md` when preparing store justifications.

Before submitting:

- Run `npm run check` and `npm run test:browser`.
- Test the unpacked `dist/` build in Chrome.
- Prepare store screenshots, a listing description and required promotional assets.
- Host a public privacy policy accurately describing local browsing-time/domain storage, saved rules, exports and separately opt-in icon requests. Complete the store's privacy and permission disclosures consistently with actual behavior.
- Use non-explicit screenshots and accurately describe protective blocking categories.
- Increment the manifest version for each subsequent upload.

`npm run check` includes `npm run verify:release`, checking the built manifest against the source/version, packaged assets, MV3 service worker, split-mode Incognito support, CSP and local HTML script references. Browser tests explicitly grant Incognito access in an isolated profile and check private blocking and activity isolation. See `docs/store-listing.md` for listing and permission-disclosure drafts. `public/privacy.html` is bundled and linked from the dashboard; it still needs public HTTPS hosting and a real store support contact before submission.

The manifest and package alone do not guarantee store approval. Submission, account setup, privacy-policy hosting and review are separate steps.
