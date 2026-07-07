# The Faithfulness System

A local-first personal stewardship app: daily ledger, weekly and monthly reviews, journal, prayer log, ideas hub, projects, calendar, and mentorship notes — all in a single static page.

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
| `daily-ui.js` | Daily Ledger view |
| `dashboard-ui.js` | Dashboard view |
| `calendar-ui.js` | Week/month calendar view |
| `ideas-hub.js` | Ideas Hub (embedded `IdeasStore` + UI) |
| `journal-ui.js`, `projects-ui.js`, `tags-ui.js` | Journal, Projects, and tag-lens views |
| `mentorship-seed.js`, `mentorship-ui.js` | Mentorship principles seed data + view |

## Design tokens

The palette lives in the `:root` block at the top of `index.html`. Text colors meet WCAG AA (≥4.5:1) on every background token; `--gold` is decorative (fills, borders, icons) while `--gold-text` is the type-safe variant.

## Tests

Open `index.html?test=store` to run the FaithfulnessStore test suite in the browser (also available standalone in `test-faithfulness-store.html`).
