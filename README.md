# Aligner Tracker

A build-free, GitHub Pages-ready progressive web app. No account, analytics, external fonts or server database. All app files use relative paths for hosting at `/Aligner-tracker/`.

## Included

- One-tap aligners out/in; timestamp-based timer survives closed tabs and restarts.
- Local storage, editable notes and break start/end times, manual breaks and deletion.
- Per-day totals, local-midnight splitting (including daylight-saving changes), daily goal and progress.
- Validated JSON backup export/import. Import replaces data after confirmation; overlapping breaks are rejected.
- Manifest, normal/maskable PNG icons and an offline service worker.
- Install prompt where supported, with browser-menu installation guidance elsewhere.

## Publish, one step at a time

1. Unzip the download. Open https://github.com/ajanimjg-del/Aligner-tracker and choose **uploading an existing file** (or **Add file → Upload files**). Upload the **contents** of this folder, including `icons/`, so `index.html` sits at the repository root. Commit the files. Do not upload the ZIP itself or JSON backups.
2. Go to **Settings → Pages**. Select **Deploy from a branch**, select **main** and **/(root)**, then Save. If the initial commit used another branch name, choose that branch instead.
3. Wait for GitHub’s deployment to finish. The expected address is https://ajanimjg-del.github.io/Aligner-tracker/ . This is an expected address, not a verified live deployment.
4. Open that address on your phone while online. Wait for **Offline access is ready on this device** in Settings & backups. Use Chrome’s **Install app / Add to Home screen** option on Android, or Safari’s **Share → Add to Home Screen** on iPhone.
5. Verify on your phone: start a break, close/reopen the app, end the break; edit it; export a backup; then reopen in airplane mode. Restore connectivity afterwards. Keep the backup.

GitHub instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Data and migration

The repository was empty when inspected on 15 November 2026. The earlier HTML attachment and complete chat were not available in this session. This is therefore a new implementation of the requested features, not a verified migration of that earlier tracker. Supply the original HTML and an example backup before migrating existing data. Do not clear the old browser’s data.

Storage key: `aligner-tracker.v1`. Unrelated existing storage keys are untouched. New backup shape: `{ "app": "aligner-tracker", "exportedAt": "ISO timestamp", "data": { "version": 1, "startedAt": 0, "goalHours": 22, "breaks": [{ "id": "unique string", "start": 0, "end": null, "note": "" }] } }`. Timestamps are Unix milliseconds; a null end means the currently active break. Unknown backup formats are rejected without modifying current data.

Tracking starts on first use, with aligners assumed in. Adding an earlier manual break extends tracking back to its start; all time since that start outside recorded breaks counts as wear. Record every missed break to keep totals accurate. The default goal is editable and should be set to your clinician’s advice. Totals use the device’s current local timezone, so travelling to a new timezone can change historic day allocations. Ambiguous fall-back clock times use the browser’s first occurrence. Backups preserve absolute timestamps.

Browser storage is specific to the browser/device and website origin. It is not cloud sync and can be cleared by the browser. Export regularly. Moving from an old local HTML file or another domain requires an explicit migration/import; a web page cannot automatically read storage from another origin. The app does not silently overwrite unreadable data.

## Offline updates

First load must be online over HTTPS (or localhost for development). Offline access is available after the service worker caches all app files. Change the cache version in `sw.js` whenever updating app-shell files. New versions wait until old app windows close, keeping each running app version consistent. Data is stored separately and survives cache updates.

## Later native Android timer

The PWA does not promise a persistent notification, lock-screen timer, background alarms or Samsung Now Bar integration. Background web execution is restricted.

Next phase: an Android app sharing this backup schema, with a durable active-break timestamp and native ongoing-notification timer. Add in/out actions, notification-permission handling and restoration after app/process/device restart. Verify current Android foreground-service rules before choosing an implementation. Test permission denial, reboot, battery restrictions, locked screen and offline use on the user’s actual phone. Samsung Now Bar support is a separate, device-dependent investigation; an ordinary notification is not a guarantee of Now Bar placement.

## Verification

Passed: JavaScript syntax checks and six automated tests covering midnight splitting, multi-day active breaks and persistence, partial first-day tracking, UK spring/autumn DST day lengths, invalid/overlapping imports and durations above 24 hours. All declared offline assets and manifest icon dimensions were checked.

Not verified: visual/browser interaction, installation and actual airplane-mode operation. The browser preview tool could not connect. Complete the phone checks above before relying on this tracker. No deployment was performed.

For local development: `python3 -m http.server 8765` from this folder, then open http://localhost:8765 . Opening the HTML directly as a file will not enable the PWA service worker.
