# With Little

*faithful with very little — Luke 16:10*

A local-first personal stewardship app built around one question: **"How do I faithfully steward today?"**

The **Stewardship Calendar** is the hub — focused Day, Agenda, and Planning views where goals, projects, tasks, subtasks, habits, prayer, Scripture, and reflections all connect back to the day. Around it: the daily ledger, weekly and monthly reviews, journal, prayer log, ideas hub, projects, and mentorship notes — all in a single static page.

## The calendar

- **Day view** — today's theme and prayer, Scripture, Today's Big Three, the Faithfulness Ring, a time-blocked schedule (Morning/Midday/Evening), habit checklist with streaks, the Task Shelf, and an evening reflection.
- **Faithfulness Ring** — three gentle rings (plan kept · habits · Big Three) averaged into a stewardship score. An empty day is an invitation, not a zero.
- **Planning view** — Life Areas → Goals → Projects → Tasks → Subtasks, with milestones, progress, templates, habit management, and links to the weekly/monthly reviews.
- **Event blocks** link to a goal, project, tasks, subtasks, and habits; completing a block sweeps its linked work with it and prompts a short reflection.
- **Quick add** understands natural language: `Workout tomorrow 5pm 45m #health !high`.
- Drag tasks from the inbox onto any hour; drag blocks to reschedule. Existing data (Daily Ledger must-dos, Dashboard tasks, scheduled Ideas, recurring blocks) is merged into the same timeline.

## Running

Serve the folder with any static file server and open `index.html`:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Data is stored in `localStorage`. Signing in (Settings → Cloud sync) backs data up to Supabase and syncs across devices; everything works offline without an account.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | App shell, design tokens/styles, view routing, sync + daily/weekly/monthly boards |
| `faithfulness-store.js` | Core data store (tasks, anchors, categories, principles) |
| `stewardship-store.js` | Calendar data layer: goals → projects → tasks → subtasks, habits, events, templates, day meta (theme/prayer/Big Three/reflection), ring math |
| `calendar-ui.js` | Stewardship Calendar — home dashboard (Day/Week/Month/Agenda/Planning + event drawer) |
| `daily-ui.js` | Daily Ledger view |
| `ideas-hub.js` | Ideas Hub (embedded `IdeasStore` + UI) |
| `journal-ui.js`, `projects-ui.js`, `tags-ui.js` | Journal, Projects, and tag-lens views |
| `mentorship-ui.js` | Mentorship principles view |

## Design tokens

The palette lives in the `:root` block at the top of `index.html`. Text colors meet WCAG AA (≥4.5:1) on every background token; `--gold` is decorative (fills, borders, icons) while `--gold-text` is the type-safe variant.

## Tests

Open `index.html?test=store` to run the FaithfulnessStore test suite in the browser (also available standalone in `test-faithfulness-store.html`).
