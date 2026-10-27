# GM-Time-Organizer

A **portable, offline, single-user time organizer** for Windows. Plan your days on an hourly timeline, track recurring tasks and habits, and see where your time actually goes — all from a folder you can carry on a USB stick.

No installer. No account. No cloud. No telemetry. Your data lives in a `data/` folder next to the app, in plain JSON.

---

## Why this exists

Most planner apps want your email, your subscription, and your data on their server. This one wants nothing. Double-click `start.bat` (or `GM-Time-Organizer.exe` if built) and you're planning in 2 seconds. Copy the folder to a USB stick and your whole planner goes with it.

---

## Features

### Planning
- **Day timeline** — hourly grid, current-time line, overlap lanes, click anywhere to create, drag to move and resize
- **Week grid** — 7-column overview, today highlighted, overlap-aware
- **Month calendar** — day grid with mini blocks; click a day to open it
- **Blocks** — four recurrence modes (once / daily / selected days / every-N-weeks custom), date ranges, per-date exceptions, category colors
- **Templates** — capture a good day, apply it to a single date or a whole range with a weekday filter and skip-existing logic

### Productivity
- **Tasks** — grouped sections (Overdue / Today / Upcoming / No date / Done), priority, due date, category, filter, sort, drag-to-reorder
- **Recurring tasks** — advance-on-check; the next occurrence appears automatically
- **Habits** — 7-day grid, streaks that respect scheduled weekdays, click-to-log past and today

### Insight
- **Stats** — planned time, block occurrences, task completion, active streaks, spark chart, category split; Week / Month / Year toggle

### Power features
- **Command palette** — `Ctrl+K` fuzzy search across views, create actions, and all your data
- **Keyboard shortcuts** — `g` + letter navigation, `n` for contextual new, `?` for help
- **Print** — clean light-only day sheet (`Ctrl+P`)

### Craft
- Self-hosted **Fraunces** variable serif for all headings (offline, no Google Fonts call)
- Hand-authored **SVG icon system** — consistent 1.5 stroke, no Unicode glyphs
- One authored **motion moment** — the timeline draws itself in once, then stays quiet
- **Dark / Light theme** — saved to disk, no flash on reload
- **Atomic writes + rotating backups** — every save is crash-safe, last 30 versions per entity

### Portability
- **100% portable** — no installer, no registry, no `%APPDATA%` writes
- **All state in the app folder** — `data/` (your planner) + `profile/` (Chromium cache)
- **Copy folder → move PC → works** — delete folder → nothing left behind

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20+** | Native ESM, zero dependencies |
| Server | **`node:http`** | No Express, no npm install, no supply-chain risk |
| Storage | **Plain JSON files** + atomic `.tmp` → rename | Inspectable, portable, crash-safe |
| Backups | Rotating (last 30 per entity) | Undo any accidental wipe |
| Frontend | **Vanilla ES modules** + plain CSS | No framework, no build step |
| Desktop | **Electron 30** + electron-builder | Native window, portable folder |
| Fonts | **Fraunces** (variable WOFF2, self-hosted) | Editorial character, offline |
| Icons | **Hand-authored SVG** | One stroke weight, scales with text |

**Zero runtime dependencies** in the shipped app. The only `npm install` is `electron` + `electron-builder` for the desktop wrapper.

---

## Quick start

### Option A — Dev mode (server + browser)
1. Install [Node.js 20+](https://nodejs.org) (LTS)
2. Double-click **`start.bat`**
3. Browser opens at `http://127.0.0.1:4777`

### Option B — Desktop app (portable `.exe`)
1. Install [Node.js 20+](https://nodejs.org)
2. In a terminal, from this folder:
   ```
   npm install
   npm run build
   ```
3. Open `dist/win-unpacked/GM-Time-Organizer.exe`
4. Copy `dist/win-unpacked/` anywhere — that's your portable app.

---

## Project structure

```
time-organizer/
├─ start.bat                  Dev launcher (server + browser)
├─ server.js                  Zero-dependency HTTP server
├─ electron-main.js           Desktop entry — 100% portable
├─ package.json               Metadata + build config
├─ README.md
├─ LICENSE                    MIT
├─ lib/
│   ├─ store.js               Atomic writes + rotating backups
│   └─ validate.js            Per-entity schemas
├─ scripts/
│   ├─ test-crud.js           14 CRUD assertions
│   ├─ test-recurrence.mjs    29 recurrence assertions
│   └─ restore-from-backups.js
├─ data/                      Your planner (gitignored)
├─ dist/                      Build output (gitignored)
└─ public/                    Frontend
    ├─ index.html
    ├─ fonts/fraunces-variable.woff2
    ├─ css/                   15 stylesheets
    └─ js/                    18 modules + 11 views
```

---

## Data & privacy

- **All data lives in `data/`** as plain JSON. Readable, editable, versionable.
- **No network calls** after the first build. The app cannot phone home.
- **Every save** writes to a `.tmp` file, renames it (atomic), and first copies the previous version into `data/backups/` — so you can always roll back.
- **Export / Import** — Settings → Data → Export saves the whole planner as a single JSON file with a safety guard that refuses malformed backups.
- **Backup rotation** — last 30 versions per entity.

---

## Keyboard shortcuts

Press `?` anywhere (outside a text field) for the in-app help.

| Keys | Action |
|---|---|
| `Ctrl` `K` | Command palette |
| `g` `d` / `g` `w` / `g` `m` | Today / Week / Month |
| `g` `t` / `g` `h` / `g` `s` | Tasks / Habits / Stats |
| `g` `b` / `g` `c` / `g` `,` | Blocks / Categories / Settings |
| `n` | New item on the current view |
| `?` | Help overlay |
| `Esc` | Close modal / palette |

---

## Development

```bash
# Run tests
node scripts/test-crud.js
node scripts/test-recurrence.mjs

# Start dev server
npm start

# Build portable Electron app
npm run build
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- [Fraunces](https://github.com/undercasetype/Fraunces) by Undercase Type — SIL Open Font License
- [Electron](https://www.electronjs.org/) — MIT
- [electron-builder](https://www.electron.build/) — MIT
