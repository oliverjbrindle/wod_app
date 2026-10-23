# Stack Days

A white and light blue, local-first workout calendar and progressive web app. Import your programming from an iCalendar file, schedule and edit workouts, and log each set. No account or backend is required.

## Develop

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

```sh
npm test             # calendar parsing, recurrence and deduplication
npm run build        # production output in dist/
npm run preview      # serve the production app locally
npm run test:e2e     # desktop/mobile Chromium workflows, including offline
```

Browser tests use `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to another installed Chromium executable if needed. In the cloud workspace, use `npm ci --cache /tmp/wod-npm-cache` if the default home cache is not writable.

Deploy `dist/` to a static HTTPS host at the domain root. The manifest and service worker use root-relative paths. HTTPS is required for installation and offline support outside localhost. No deployment or remote service is configured by this repository.

## Use

- Import an `.ics` file from the calendar. Event titles, original calendar dates and descriptions are retained.
- A description line such as `Back squat 5x5 @ 80kg` creates an exercise with five sets of five repetitions. `Bench press 3x8 @ 135lb` and `Pull-ups 3x6` also work. Free-form notes remain available and can be programmed manually in the editor. Parsing is intentionally conservative; review prescriptions after import.
- Recurring events, exclusions and recurrence exceptions are handled by ical.js. Imports are capped at 366 occurrences per series and 2,000 sessions per file; bounded exports are recommended. The event's original calendar date is used, not a conversion to the device timezone. Times, alarms, calendar subscriptions, and automatic syncing are not implemented.
- Matching event UID and occurrence identifiers prevent duplicate imports. Re-importing preserves existing edits and progress rather than applying calendar changes. Delete a session before re-importing it if you want to replace it.
- Start a session, complete sets, undo individual completed sets, then finish the session after all prescribed sets are done. Progress survives reloads.
- Export JSON backups from **App & data**. Restore replaces current data after confirmation. Browser storage can be erased or evicted, so keep regular backups. There is no cloud synchronization across devices.
- On iPhone, use Safari → Share → Add to Home Screen (the label is STACK). Open the app online once before offline use. Offline caching is enabled in production builds, not the development server.

## iOS platform limits

A PWA cannot create ActivityKit Live Activities, interactive Lock Screen completion buttons, or Dynamic Island activities. These require a native iOS app/companion with ActivityKit and App Intents, plus a deliberate data-sharing bridge. This repository provides in-app set completion and session progress only; it does not claim native functionality.

## Privacy

All workout data is stored in localStorage on the current browser/device. Calendar content is treated as text and is never uploaded. Assets are served from the app origin; there are no analytics or external font requests. The service worker caches app assets for offline use.

## Complete-workout calendar template

Create **one event per workout**. Set the event title to the workout name. Put each lift on its own line in the description:

```text
lift, Back squat, 5, 5, 80, kg
lift, Bench press, 3, 8, 75, % of Max
lift, Pull-ups, 3, 6, 100, % of Bodyweight
cardio, Running, 3, time, 10, min, 2
Notes: Rest 2 minutes between sets.
```

Use `Exercise name SETSxREPS @ WEIGHTkg` (or `lb`). Weight is optional. Keep sets between 1 and 50 and reps between 1 and 1000. Bullets and numbered lines are supported. Export your calendar as `.ics`, then import it. All exercises appear inside **one** workout. Do not create a separate event for each lift. Non-prescription lines stay as notes. Use consistent lift names to combine history correctly.

Download the ready-made example from **App & data → Download a complete workout calendar template**, or use [examples/programming.ics](examples/programming.ics). Change the event title, date and UID for each new workout. In raw ICS, description line breaks are escaped as `\n`, while a calendar editor accepts real line breaks. The supplied file already handles this encoding.

## Lift history

The **Lift history** tab appears in the bottom navigation on phones and the sidebar on desktop. Select a lift to see each completed set with its session date, weight, unit and reps. The active workout lets you enter the actual weight for each set; the small numbered set buttons use the prescribed weight. Undoing a set removes its history entry. New sets preserve a snapshot even if you later edit the prescription. Existing completed sets without snapshots fall back to the prescription and are marked with an asterisk. Kilograms, pounds, percentages and bodyweight are kept separate. Deleting a workout deletes its history. Existing local workouts and older backups remain supported; the original storage key is intentionally retained.

After deployment, reopen the app online to receive the updated service worker. iOS may retain the old installed icon/name; export a backup before reinstalling, then add the updated site to the Home Screen as STACK and restore the backup if needed.

## Cardio and lift programming

Choose **Lift** or **Cardio** as the first field of each exercise in the workout editor. Cardio supports sets, exercise name, a target (time/distance/calories), unit, and heart-rate zone 1–5. Each set has the same target and can be completed or undone separately in the active session. A mixed session's progress counts both lift sets and cardio sets as steps. Cardio is excluded from lift weight history. No heart-rate sensor connection or automatic cardio measurement is provided; targets are prescriptions and completion is manual.

Use one description line per exercise:

```text
lift, Back squat, 5, 5, 80, kg
lift, Bench press, 3, 8, 75, % of Max
lift, Pull-ups, 3, 6, 100, % of Bodyweight
cardio, Running, 3, time, 10, min, 2
cardio, Rowing, 4, distance, 500, m, 4
cardio, Bike, 2, calories, 20, kcal, 5
```

- Lift: `lift, exercise name, sets, reps, weight, unit`.
- Cardio: `cardio, exercise name, sets, measurement type, measurement magnitude, unit, heart rate zone`.
- Time units: `min`, `sec`, `hr`; distance: `km`, `m`, `mi`; calories: `kcal`.
- Sets: 1–50. Lift reps: 1–1,000. Cardio target: positive number. Zone: 1–5.
- Percentage units are `% of Max` and `% of Bodyweight`. Enter `75` for 75%, not `0.75`. They are percentages, not automatically calculated loads. Historical `%` remains the internal max-percentage identifier. Older `BW` ratios migrate to percentages (e.g. `0.75 BW` → `75 % of Bodyweight`) without changing kg/lb or max percentages. Existing backups and older lift notation remain supported.
- The earlier six-field cardio format without sets still imports as one set. Missing/invalid fields in explicitly typed programming are reported rather than silently skipped. Exercise names in these formats must not contain commas.
- In a calendar editor, enter ordinary commas. Raw ICS `DESCRIPTION` commas must be escaped as `\,` and newlines as `\n`; the downloadable template already does this.
