# World Cup 2026 Dashboard

A clean, responsive web dashboard for FIFA World Cup 2026 — KPI cards, match
results & fixtures, live-computed group standings, team performance, goal trends,
historical context, and venue info.

**Phase 1 (this MVP):** a self-contained static site (vanilla HTML/CSS/JS +
Chart.js) driven by local sample JSON. No build step, no backend.

![sections](https://img.shields.io/badge/sections-7-0a8754) ![stack-vanilla-js](https://img.shields.io/badge/stack-vanilla%20JS-2f6fed)

---

## Run locally

The dashboard loads JSON via `fetch()`, so it must be served over HTTP (opening
`index.html` directly with `file://` will be blocked by the browser). From this
folder:

```bash
# Python (any version 3.x)
python -m http.server 8000
```

Then open <http://localhost:8000>. Any static server works (`npx serve`,
VS Code "Live Server", etc.).

---

## Project structure

```text
world-cup-dashboard/
├── index.html              # layout + section markup
├── assets/
│   ├── css/styles.css      # dashboard styling
│   └── js/
│       ├── data-loader.js  # fetch JSON + data validation
│       ├── calculations.js # pure KPI / standings math (no DOM)
│       ├── charts.js       # Chart.js render wrappers
│       ├── tables.js       # table rendering + click-to-sort
│       ├── filters.js      # filter state + match filtering
│       └── app.js          # orchestration / wiring
├── data/                   # sample JSON (edit to update the dashboard)
│   ├── matches.json
│   ├── teams.json
│   ├── venues.json
│   ├── historical_world_cup.json
│   └── groups.json         # optional seed; standings are computed from matches
└── scripts/                # Phase 2 — API refresh (not used by the MVP)
    ├── fetch_api_data.py
    ├── clean_data.py
    └── requirements.txt
```

### Design note: standings are computed, not stored

Group tables, points, goal difference, and every KPI are derived **from
`matches.json`** at runtime (`assets/js/calculations.js`). To update the
dashboard you only edit match results — the standings follow automatically. This
removes a whole class of data drift and keeps everything internally consistent.

---

## Updating the data (static)

Edit the files in `data/`. The schema each file uses:

- **matches.json** — one object per match: `match_id, date, time, stage, group,
  home_team, away_team, home_score, away_score, status, venue, city, country`.
  Use `"status": "Complete"` with integer scores for played matches, and
  `"status": "Scheduled"` with `null` scores for upcoming ones.
- **teams.json** — `team_id, team_name, group, confederation, flag`.
- **venues.json** — `venue_id, venue, city, country, capacity`.
- **historical_world_cup.json** — `year, host, champion, runner_up, total_goals,
  matches, attendance`.

The loader runs **data-quality validation** on load (duplicate fixtures, invalid
dates, scores on scheduled matches, unknown teams/venues, wrong group, negative
scores). Warnings appear in the browser console and in the header status badge;
they are non-blocking so a typo never blanks the page.

---

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder's contents.
2. In **Settings → Pages**, set **Source = Deploy from a branch**, branch `main`,
   folder `/ (root)` (or `/docs` if you move the site there).
3. Your dashboard goes live at `https://<user>.github.io/<repo>/`.

It's a static site, so it also drops straight onto Netlify, Vercel, or Cloudflare
Pages with no configuration.

---

## Phase 2 — live API refresh (optional, not wired into the MVP)

`scripts/` contains a ready-to-use refresh pipeline against
[football-data.org](https://www.football-data.org/) (free tier, World Cup
coverage).

```bash
cd scripts
pip install -r requirements.txt
cp ../.env.example ../.env        # then edit ../.env and add your key
python fetch_api_data.py          # writes data/matches.json from the live API
```

`fetch_api_data.py` pulls competition/matches/standings, saves the raw responses
to `scripts/_raw/` (gitignored), and `clean_data.py` transforms them into the
dashboard's `matches.json` schema. The dashboard then recomputes everything else.

### Automating with GitHub Actions (Phase 2)

Add the API key as a repo secret (**Settings → Secrets → Actions →
`FOOTBALL_DATA_API_KEY`**) and create `.github/workflows/refresh-data.yml` to run
the script on a schedule, commit refreshed `data/matches.json`, and let Pages
redeploy. A daily cron is plenty pre-tournament; tighten to every 15–60 min on
match days if your API plan allows.

---

## Security

**API keys must never appear in frontend files** (`index.html`, any file under
`assets/`) or in committed data. The key lives only in:

- a local `.env` (gitignored — see `.env.example`), or
- a GitHub Actions / Netlify / Vercel secret.

The static dashboard ships only preprocessed JSON, so nothing sensitive reaches
the browser.

---

## Roadmap

- **Phase 1 (done):** static MVP — KPIs, match center, standings, team
  performance, goal analysis, history, venues.
- **Phase 2:** football-data.org refresh + scheduled GitHub Action.
- **Phase 3:** richer live data (SportMonks / API-Football) — live scores,
  lineups, xG, player stats; knockout bracket; full 48-team field.
