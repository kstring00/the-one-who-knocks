# Manual QA Checklist

## Data And Migration

- Open the app with existing `fs-core.projects` and confirm the Projects tab shows migrated projects.
- Reload twice and confirm projects/tasks are not duplicated.
- Confirm legacy `fs-core` data still exists in localStorage.
- Complete a project task in Projects and confirm Dashboard Planning reflects the same completion/progress.

## Scheduling

- Create a task without a time and confirm it stays in Task Shelf.
- Confirm no unscheduled task appears at 6 AM, 6:30 AM, 8 AM, 9 AM, noon, or `beforeWork`.
- Use Schedule on a task, cancel the drawer/prompt, and confirm no calendar event is created.
- Schedule with explicit date/time and confirm the event links to the task.
- Delete the event and confirm the task remains in Task Shelf.

## Daily Planning

- Switch Today/Tomorrow with the segmented control and confirm the exact date header changes.
- Confirm Tomorrow uses the amber Planning Tomorrow treatment.
- Mark Evening complete and confirm the “Want to set tomorrow up for success?” prompt appears.
- Choose Yes and confirm unfinished tasks carry forward once, open Tomorrow, and land on Morning Setup.

## Journal

- Type continuously for one minute and confirm the cursor does not jump.
- Use H1/H2/H3, bold, italic, bullet, numbered list, checklist, and quote toolbar actions.
- Type `[] ` at the start of a line and confirm it becomes a checklist item.
- Search across at least 100 entries and confirm results navigate to the entry.

## Ideas

- Confirm Spark Board is gone.
- Confirm the redundant Voice/Camera/Quick Note card is gone.
- Complete and reopen an idea from the card menu.
- Convert an idea to a task and confirm it appears in Task Shelf.
- Convert an idea to a project and confirm it appears in Projects.

## General

- Confirm the automatic top guidance bar does not appear.
- Confirm the Guide tab and help button still open guidance intentionally.
- Confirm Day, Agenda, and Planning are the only Dashboard toolbar views.
- Check console for uncaught errors and missing static assets.
