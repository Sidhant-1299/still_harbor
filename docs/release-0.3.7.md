# Still Harbor 0.3.7 — long URL/path boundary fix

Fixes rejection of long **Specific URL / path** boundaries such as copied Colab notebook links. Chrome can accept the ordinary-path native regex while rejecting the larger encoded alternatives because of its RE2 memory limit. Previously, this rejected the whole boundary.

The patch keeps the supported literal native rule for URL boundaries and omits an encoded alternative only when Chrome cannot support it. Unsupported encoded variants still use the existing document-start and committed-navigation checks; these may redirect after navigation begins. Domain/path scope, descendants, redirect-loop protection and Incognito behavior are unchanged. Keyword rule compilation is unchanged.

The regression test mocks notebook responses, so it never requests the user's actual document. It covers adding the copied URL through the dashboard, ordinary/encoded paths, descendants, query/fragment suffixes, allowed neighboring notebooks, duplicate detection, redirect-loop rejection and private browsing.

Verification on macOS Chromium: TypeScript, 23 unit tests, 17 browser tests, production/package checks, and Playwright MCP verification of adding the exact Colab URL through the dashboard and blocking ordinary/encoded visits in regular and private contexts. The test failed on 0.3.6 before the patch with the reported complexity error, then passed after the fix.

The user confirmed the final local patch works on Mac and approved publication. Windows/Linux and other Chromium browsers are not independently verified.

Download `still-harbor-0.3.7.zip` from the GitHub release, not the source archives. To update, replace the files in the same extension installation folder and click **Reload** in `chrome://extensions`. Do not uninstall or change the folder if you want to preserve local rules and insights. Incognito blocking still requires manually enabling **Allow in Incognito**.
