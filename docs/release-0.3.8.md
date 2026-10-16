# Still Harbor 0.3.8 — blocklist editing recovery

Fixes settings becoming unusable after Chrome reports **No last-focused window**, such as when its background worker starts while no browser window is available.

Previously, this activity-tracking error could permanently reject worker initialization, causing every subsequent settings request to fail even after a window returned. During a save, it could also report failure after settings had already been persisted.

Unavailable windows, idle state, or active tabs now mean no browsing activity is recorded for that refresh. Cleared activity is persisted, and tracking resumes on a subsequent successful refresh. Window/tab lookup failures no longer prevent initialization, snapshots, or blocklist changes. Rule enforcement, password protection, and private-browsing isolation are unchanged; storage and blocking-engine errors still surface normally.

Verified on macOS Chromium: TypeScript checks, 27 unit tests, 18 Playwright browser tests, production build, and release-package verification. New worker tests cover startup without a window, boundary changes during window loss, a window disappearing during tab lookup, idle-state failure, and recovery. A new browser test injects the exact Chrome API error and exercises dashboard reload, add, destination edit, pause, remove, persistence, and recovery. These lifecycle conditions are simulated deterministically; this is not a long-running soak test. Windows/Linux are not independently verified.

Download `still-harbor-0.3.8.zip` from the GitHub release, not the source archives. To update an existing unpacked installation, replace the contents of the same installation folder with the new build and click **Reload** in `chrome://extensions`, then reopen the dashboard. Do not uninstall first: keeping the same installation preserves local settings and insights.
