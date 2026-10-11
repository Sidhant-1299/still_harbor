# Chrome Web Store packaging

`public/manifest.json` is the source Chrome Manifest V3 manifest. `npm run build` copies it to `dist/manifest.json`, alongside the compiled scripts, pages and generated extension icons. Upload a ZIP of the **contents** of `dist/`, with `manifest.json` at the ZIP root—not the source project or a enclosing `dist` folder.

The manifest includes a release version, description, extension icons, popup, options page, service worker, navigation checks and a self-hosted-script content security policy. No development key, localhost endpoint or remotely hosted JavaScript is included. Broad HTTP/HTTPS host access is needed for user-selected blocking and explicitly opt-in favicon.ico requests. No website artwork or icon cache is bundled/saved; the Chrome `favicon` permission is not requested. See the permission table and privacy details in `README.md` when preparing store justifications.

Before submitting:

- Run `npm run check` and `npm run test:browser`.
- Test the unpacked `dist/` build in Chrome.
- Prepare store screenshots, a listing description and required promotional assets.
- Host a public privacy policy accurately describing local browsing-time/domain storage, saved rules, exports and separately opt-in icon requests. Complete the store's privacy and permission disclosures consistently with actual behavior.
- Use non-explicit screenshots and accurately describe protective blocking categories.
- Increment the manifest version for each subsequent upload.

`npm run check` includes `npm run verify:release`, checking the built manifest against the source/version, packaged assets, MV3 service worker, incognito restriction, CSP and local HTML script references. See `docs/store-listing.md` for listing and permission-disclosure drafts. `public/privacy.html` is bundled and linked from the dashboard; it still needs public HTTPS hosting and a real store support contact before submission.

The manifest and package alone do not guarantee store approval. Submission, account setup, privacy-policy hosting and review are separate steps.
