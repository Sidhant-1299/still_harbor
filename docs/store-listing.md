# Chrome Web Store submission draft

## Single purpose

Help users manage their attention through self-chosen website, URL-path and keyword boundaries, with calm redirects and related local browsing-time insights.

## Listing description

Still Harbor creates quiet boundaries for your browsing. Block entire domains, specific URL subtrees or keyword substrings in hostnames, URL paths and supported search queries, and redirect to a calm page or a destination you choose. Optional password protection adds friction before weakening boundaries; it is not tamper-proof and has no password recovery.

**Browsing activity disclosure:** Still Harbor processes navigation URLs temporarily for blocking and records domain names and daily active browsing time locally for up to 90 days, including while blocking is paused. No visited full-URL history, page contents or search terms are logged. Saved rules may contain the URL prefixes and keywords you intentionally enter. Export or delete insights in Settings; recording resumes after deletion.

No accounts, cloud sync, advertising or telemetry. Website icons and requests are off by default. Explicitly opt-in favicon.ico requests contact selected websites over HTTPS, revealing your IP address without sending cookies or referrers. Icons are displayed temporarily, never saved by the extension. No website logos are bundled and Chrome's favicon cache is not used. Custom redirects navigate normally to your chosen destination.

Desktop Chrome only for this release. Incognito blocking requires manually enabling Allow in Incognito in Chrome's extension details. Private browsing is not recorded in insights or exports; manage settings and insights in a regular window. This is a navigation blocker, not a firewall: some encoded paths may be checked only after a page commits. Browser controls and uninstallation can bypass password protection.

## Permission justifications

- `storage`: local rules, settings, daily insights and password verifier; temporary state in session storage. No icon data is stored.
- `tabs`: identify active websites for time accounting, inspect current navigation and apply user-chosen redirects.
- `idle`: exclude idle or locked time from insights.
- `alarms`: checkpoint activity and expire old insights despite MV3 service-worker suspension.
- `webNavigation`: check committed and client-side navigation against user rules, avoiding stale-document redirects.
- `declarativeNetRequest`: apply native main-frame redirects for user-selected boundaries.
- HTTP/HTTPS host access and document-start content script: rules can target any user-selected website; navigation checks process URLs, not page contents. Host access also supports separately opt-in favicon requests.

## Privacy tab and submission tasks

Do not claim the extension handles no user data: it handles browsing activity locally and temporarily processes URLs. Review the dashboard's current category definitions, accurately disclose this behavior, and make all required Limited Use certifications. Distinguish local handling from transmission to the publisher; disclose opt-in requests to website operators.

Before submission, the publisher must host the exact privacy policy in `public/privacy.html` at a publicly accessible HTTPS URL, set that URL in the privacy-policy field, supply a real support contact and publisher identity, upload screenshots and required promotional assets, and enable account 2-step verification. The extension-relative stylesheet/link paths may need adjusting when hosting the policy; preserve the policy text.

No third-party website logo is bundled. Optional icons come only from user-authorized website requests and are not saved. Keep pornography/gambling categories framed as protective blocking, not promotion, and use non-explicit listing screenshots. Store approval and legal compliance require publisher review; this document is not a legal opinion.
