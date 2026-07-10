# With Little Architecture Audit

## Storage Owners

- `fs-core` is the legacy local-first core store managed by `faithfulness-store.js`. It still owns seeds, mentor/principle records, daily anchor configuration, practice sessions, schedule blocks, journal-entry helpers, and a preserved backup copy of legacy projects/tasks.
- `fs-stewardship` is the canonical relational planning store managed by `stewardship-store.js`. It owns life areas, goals, projects, tasks, subtasks, habits, calendar events, templates, daily metadata, Big Three, and project progress.
- `fs-day:YYYY-MM-DD` stores Daily Ledger records: posture/aim, must-dos, growth rep, phase completion, evening review, and carry-forward review state.
- `journal:YYYY-MM-DD` stores portable plain-text journal body plus gratitude fields.
- `fs:ideas-hub` stores the Ideas Hub pipeline, attachments metadata, conversion links, and completion state.
- `fs-stones` stores Stones records: truths and markers plus resurfacing picks.

## Canonical Project/Task Relationship

The canonical planning relationship is:

`Life Area -> Goal -> Project -> Task -> Subtask -> Calendar Event`

`StewStore` is the source of truth for projects and project tasks. The standalone Projects tab, Dashboard Planning, Task Shelf, and Calendar now read and write the same `fs-stewardship` records.

## Legacy Migration

`StewStore.migrateLegacyProjectTasks(core)` migrates legacy `fs-core.projects` and project-linked `fs-core.tasks` into `fs-stewardship`.

The migration is versioned under:

`fs-stewardship.meta.migrations.legacyProjectsToStewStore.version = 1`

It is intentionally idempotent:

- It preserves legacy project IDs and task IDs where practical.
- It checks both direct IDs and `legacyCoreId` before creating records.
- It preserves project/task titles, completion state, dates as due dates, tags, archive state, and related seed/idea IDs when available.
- It never deletes or rewrites the legacy `fs-core` records.

Scheduling repair logic:

- Legacy project tasks with `timeSlot=timed` and a real `startTime` are converted into linked calendar events.
- Legacy project tasks with `beforeWork`, `duringWork`, `afterWork`, or `eveningShutdown` but no explicit start time are treated as old automatic window defaults and migrated as unscheduled Task Shelf tasks.
- Deleting a calendar event unlinks the task and returns it to unscheduled status; it does not delete the task.

## Sync Behavior

All canonical planning writes persist under `fs-stewardship` and enter the existing cloud sync queue. Startup and cloud pulls run the migration after both `fs-core` and `fs-stewardship` are loaded, so signed-out local mode and signed-in sync mode converge without deleting legacy data.

Cloud safety remains unchanged: the app pulls before pushing after sign-in, and empty local state is guarded from overwriting non-empty cloud state.

## Known Duplicates Kept As Backups

Legacy `fs-core.projects` and legacy project-linked `fs-core.tasks` remain as untouched backup records after migration. They should not be rendered as calendar blocks once corresponding `StewStore` records exist.
