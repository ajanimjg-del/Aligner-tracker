# Aligner Tracker — CSV history import review

Prepared from the current `ajanimjg-del/Aligner-tracker` GitHub source. **Not published.** No build or dependencies are required for GitHub Pages.


## CSV history import (new)

Open **Settings & backups → Import CSV history**, choose the original CSV, review the ready/skipped/rejected counts and row explanations, then select **Confirm import**. Cancel leaves storage untouched. The preview shows local dates and times. Rejected rows and duplicates are not added; only the explicitly previewed ready rows are merged. Malformed CSV structure or headers aborts the preview entirely.

Required columns: `Start`, `End`, `Duration minutes` (any order). Start/End must be ISO UTC timestamps with exactly three millisecond digits, for example `2026-11-14T00:54:47.196Z`. Duration minutes is ignored, including its rounding; the timestamp difference determines duration. Quoted fields, escaped quotes, BOM and CRLF are supported. Limits: 2 MB and 10,000 records.

Exact timestamp pairs are duplicates regardless of IDs or notes. Overlaps with history or the active break are rejected; both sides of a conflict between distinct CSV records are rejected. Touching endpoints are allowed. Row numbers refer to source CSV lines. Existing IDs, records, notes, estimated flags, active timer, allowance and reminder settings remain intact. The tracking-start boundary moves earlier only if required for imported history.

The whole merge is built and validated in memory before saving. Confirmation checks that stored data still matches the preview. The app uses one synchronous `localStorage.setItem` call for the complete state, with no intermediate row saves, deletion or storage clearing. Cancellation/interruption before the save leaves the old state; a successful replacement contains the complete merged state. A failed storage write leaves existing data untouched. A changed preview must be refreshed and reviewed again. This uses browser local-storage atomic replacement, not a cloud backup or a guarantee against device/storage failure; keep your normal JSON backup.

Editing a note or estimate flag preserves the exact original start/end milliseconds and the original daylight-saving-time occurrence. Explicitly changing one displayed time changes that endpoint only; the unchanged endpoint retains its exact value. Existing time inputs display to seconds, while stored timestamps and JSON backups retain milliseconds.

### CSV verification results

The supplied 12-record CSV was tested without putting the full personal CSV in this release package. In a test state with a nonoverlapping active break and custom settings: **12 ready, 0 skipped, 0 rejected**; after merging and reimporting: **0 ready, 12 skipped, 0 rejected**. All 24 endpoint timestamps matched the input exactly. Actual results in your browser depend on its existing history and overlaps; this test did not import anything into your live app.

All **26 automated tests passed**, including one-write saving, failed storage writes, changed previews, cancellation, settings/active-timer preservation, millisecond-preserving edits, malformed records, duplicates, overlaps and JSON backup export/restore. The test clock for CSV fixtures is 18 November 2026 so all supplied historical rows can be validated deterministically. Browser visual QA remains unverified because the existing managed browser policy blocks local preview; device-level crash simulation was not performed.

To repeat the full suite with your own copy of the fixture:

`CSV_TEST_FILE=/absolute/path/to/invisalign-breaks.csv TZ=Europe/London node --test tests/*.test.mjs`

Without `CSV_TEST_FILE`, only the personal-fixture test is skipped; all synthetic tests still run. No deployment was performed.

## Earlier V2 changes

- Prominent **I forgot** button: forgotten start, forgotten stop, or a complete missed break.
- Start/end shortcuts of 5, 10, 15 or 30 minutes ago, plus custom date/time. All shortcuts open an editor for review before saving.
- Separate estimated-start and estimated-end flags, visible in history and preserved in backups. Uncheck a flag when you know the exact time.
- Overlaps, duplicate intervals/IDs, future timestamps, reversed times and simultaneous active breaks are rejected without changing stored data.
- Clear running-break display. Today's total time OUT and remaining allowance are always visible, including while viewing another day's history. Exceeding the allowance shows the amount over.
- No individual wear sessions. Daily allowance is editable in minutes; the previous daily wear goal is retained internally for compatibility (22 hours becomes 120 minutes out).
- Optional in-app reminders at 15, 30 and 45 minutes after the break starts. Configure up to 10 thresholds between 1 and 1440 minutes. These are elapsed-time thresholds, not repeating alarms. Default: off.
- Optional phone notifications on supported browsers after permission. Tap a notification to return; where notification actions are supported, **Stop break…** opens the relevant break with a proposed end time for confirmation. It does not silently change history. Stale notifications cannot stop another break.

## Review first

Do not upload to the publishing branch until reviewed. To preview locally, run `python3 -m http.server 8765` from this folder, then open http://localhost:8765 . Local preview uses separate browser storage from the live tracker. Use dummy records for review. Opening `index.html` as a file does not provide a working module/service-worker preview.

Suggested review:
1. Tap **I forgot → To start a break → 10 minutes ago**, then **Save break**. Check the running timer and Estimated label.
2. Tap **I forgot → To stop a break → 5 minutes ago**, then save. Check that the full break lasted about five minutes.
3. Add a complete missed break and edit it. Attempt an overlap and confirm it is rejected.
4. Export a backup, reload, then import it. Check that history and estimated flags remain intact.
5. Enable reminders with a 1-minute threshold and leave the app open. Check the in-app reminder. On the actual Android phone, enable notifications and test opening/confirming a break from one.
6. Verify offline reopening after the app reports offline access ready.

## Existing data and updates

The existing `aligner-tracker.v1` local-storage key, version-1 backup envelope and break IDs/timestamps/notes remain in use. Old backups load; missing estimated flags default to false and reminders default to off. New backups preserve both additions. Unrelated browser keys are untouched. Existing records remain on the same device/browser and website address. Do not clear browser storage or uninstall the old app during the upgrade.

Before an approved release, export a backup from the live tracker. Then upload the files at the same repository root, preserving `icons/`. The service-worker cache version has been bumped to v3. Once the updated worker installs, close all tracker windows and reopen to activate it. There is no forced reload during a break. Offline cache changes do not clear history. Avoid opening an older app version and saving changes after upgrading: older code does not understand the new estimated-time/reminder fields.

Breaks spanning midnight are split by actual local calendar boundaries, including 23/25-hour daylight-saving days. The active break continues across midnight; daily totals reset automatically. Only recorded breaks count. The current device timezone determines day allocations, so travel can change historic day groupings. Ambiguous fall-back local times follow the browser's interpretation; absolute timestamps are retained in backups.

## Reminder limits and Android priority

Reminder checks run in the page. When a browser throttles or suspends it, a reminder can be late or missed; closing the PWA stops these checks. Returning to a running break shows only the latest overdue threshold rather than a burst of old reminders. Within a tab, delivered thresholds survive reload using session storage. Different app windows may each display an in-app reminder; phone notifications use one replacement tag.

Notifications are best-effort and require permission, a supported browser and an active service-worker registration. Denied permission does not block tracking or in-app reminders. There is no push server, scheduled background worker, guaranteed lock-screen timer or Now Bar integration. Use the phone's own alarm when a dependable reminder is needed.

**Future priority:** native Android ongoing notification with a persistent timer and in/out actions, durable state, restart recovery and tests on the user's phone. Check Android service/permission requirements and investigate Samsung Now Bar separately.

API references:
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

## Validation

26 automated tests passed (including the attached 12-record CSV, duplicate reimport, malformed input, storage failure, preview cancellation, stale previews, timestamp-preserving edits, and JSON export/restore): existing backup compatibility; estimated-flag round trips; forgotten start/stop/full breaks; all four shortcuts and custom end correction through the real event handlers in a simulated document; duplicate/overlap/invalid-time rejection; stale notification protection; reminder thresholds/settings; midnight/multi-day splitting; daylight-saving boundaries. JavaScript syntax and offline asset references were also checked.

Run: `TZ=Europe/London node --test tests/*.test.mjs` (Node 24 was used).

Browser visual/interaction QA and actual Android notification delivery remain unverified: managed browser security policy blocked the local preview. Simulated-document tests do not replace these device checks. No GitHub push or publication was performed.
