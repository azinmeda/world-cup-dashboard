// tables.js
// Render helpers for every <table> on the dashboard. These build HTML strings and
// inject them; sortable tables wire up click-to-sort on their numeric columns.

import * as calc from "./calculations.js";

// Lookup helpers shared across renderers ---------------------------------------
let TEAM_INDEX = new Map(); // team_name -> team object (for flags)
export function indexTeams(teams) {
  TEAM_INDEX = new Map(teams.map((t) => [t.team_name, t]));
}
function flag(name) {
  const t = TEAM_INDEX.get(name);
  return t && t.flag ? `<span class="flag">${t.flag}</span>` : "";
}
function teamCell(name) {
  if (!name) return `<span class="tbd">TBD</span>`;
  return `${flag(name)}${name}`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function emptyRow(cols, msg = "No matches for the current filters.") {
  return `<tr class="empty-row"><td colspan="${cols}">${msg}</td></tr>`;
}

/* ----------------------- Match Center tables -------------------- */
export function renderCompletedMatches(matches) {
  const rows = calc.completedMatches(matches)
    .slice()
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const body = rows.length
    ? rows.map((m) => `
        <tr>
          <td>${esc(m.date)}</td>
          <td>${esc(m.group)}</td>
          <td>${teamCell(m.home_team)}</td>
          <td class="num score">${m.home_score} – ${m.away_score}</td>
          <td>${teamCell(m.away_team)}</td>
          <td>${esc(m.venue)}</td>
        </tr>`).join("")
    : emptyRow(6);
  document.getElementById("completed-table").innerHTML = `
    <thead><tr><th>Date</th><th>Grp</th><th>Home</th><th class="num">Score</th><th>Away</th><th>Venue</th></tr></thead>
    <tbody>${body}</tbody>`;
}

export function renderUpcomingMatches(matches) {
  const rows = calc.scheduledMatches(matches)
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const body = rows.length
    ? rows.map((m) => `
        <tr>
          <td>${esc(m.date)}</td>
          <td>${esc(m.time)}</td>
          <td>${esc(m.group)}</td>
          <td>${teamCell(m.home_team)}</td>
          <td class="num">v</td>
          <td>${teamCell(m.away_team)}</td>
          <td>${esc(m.venue)}</td>
        </tr>`).join("")
    : emptyRow(7);
  document.getElementById("upcoming-table").innerHTML = `
    <thead><tr><th>Date</th><th>Time</th><th>Grp</th><th>Home</th><th></th><th>Away</th><th>Venue</th></tr></thead>
    <tbody>${body}</tbody>`;
}

/* ----------------------- Group standings ------------------------ */
export function renderStandings(matches, teams) {
  const standings = calc.computeStandings(matches, teams);
  const groups = Object.keys(standings).sort();
  const grid = document.getElementById("standings-grid");

  if (!groups.length) {
    grid.innerHTML = `<p class="section-sub">No standings for the current filters.</p>`;
    return;
  }

  grid.innerHTML = groups.map((g) => {
    const rows = standings[g];
    const lastIdx = rows.length - 1;
    const body = rows.map((r, i) => {
      // Leader highlighted gold, runner-up green (qualification), last red (at risk).
      let cls = "";
      if (i === 0) cls = "row-leader";
      else if (i === 1) cls = "row-qualify";
      else if (i === lastIdx && rows.length > 2) cls = "row-risk";
      return `
        <tr class="${cls}">
          <td><span class="pos-badge">${i + 1}</span> ${teamCell(r.team)}</td>
          <td class="num">${r.played}</td>
          <td class="num">${r.wins}</td>
          <td class="num">${r.draws}</td>
          <td class="num">${r.losses}</td>
          <td class="num">${r.goals_for}</td>
          <td class="num">${r.goals_against}</td>
          <td class="num">${r.goal_difference > 0 ? "+" : ""}${r.goal_difference}</td>
          <td class="num"><strong>${r.points}</strong></td>
        </tr>`;
    }).join("");
    return `
      <div class="group-card">
        <h3>Group ${g}</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">D</th>
              <th class="num">L</th><th class="num">GF</th><th class="num">GA</th><th class="num">GD</th><th class="num">Pts</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");
}

/* ---------------------- Team stats (sortable) ------------------- */
export function renderTeamStats(matches, teams) {
  const rows = calc.teamStandingsList(matches, teams);
  const columns = [
    { key: "team", label: "Team", num: false },
    { key: "group", label: "Grp", num: false },
    { key: "played", label: "P", num: true },
    { key: "wins", label: "W", num: true },
    { key: "draws", label: "D", num: true },
    { key: "losses", label: "L", num: true },
    { key: "goals_for", label: "GF", num: true },
    { key: "goals_against", label: "GA", num: true },
    { key: "goal_difference", label: "GD", num: true },
    { key: "clean_sheets", label: "CS", num: true },
    { key: "points", label: "Pts", num: true },
  ];
  renderSortableTable("team-stats-table", columns, rows, {
    formatCell: (row, col) => {
      if (col.key === "team") return teamCell(row.team);
      if (col.key === "goal_difference") return `${row.goal_difference > 0 ? "+" : ""}${row.goal_difference}`;
      return esc(row[col.key]);
    },
    initialSort: { key: "points", dir: "desc" },
  });
}

/* ----------------------- Top scorers ---------------------------- */
export function renderScorers(scorers) {
  const table = document.getElementById("scorers-table");
  if (!table) return;

  // Assign competition-style ranks (ties share a rank).
  let rank = 0, prevGoals = null;
  const rows = (scorers || []).map((s, i) => {
    if (s.goals !== prevGoals) { rank = i + 1; prevGoals = s.goals; }
    return { ...s, rank };
  });
  const maxGoals = rows.length ? rows[0].goals : 0;

  const body = rows.length
    ? rows.map((r) => `
        <tr class="${r.goals === maxGoals && maxGoals > 0 ? "row-leader" : ""}">
          <td class="num"><span class="pos-badge">${r.rank}</span></td>
          <td>${esc(r.player)}</td>
          <td>${teamCell(r.team)}</td>
          <td class="num score">${r.goals}</td>
        </tr>`).join("")
    : emptyRow(4, "No goals scored yet.");

  table.innerHTML = `
    <thead><tr><th class="num">#</th><th>Player</th><th>Team</th><th class="num">Goals</th></tr></thead>
    <tbody>${body}</tbody>`;
}

/* ----------------------- Historical table ----------------------- */
export function renderHistorical(historical) {
  const rows = historical.slice().sort((a, b) => b.year - a.year);
  const columns = [
    { key: "year", label: "Year", num: true },
    { key: "host", label: "Host", num: false },
    { key: "champion", label: "Champion", num: false },
    { key: "runner_up", label: "Runner-up", num: false },
    { key: "total_goals", label: "Goals", num: true },
    { key: "matches", label: "Matches", num: true },
  ];
  renderSortableTable("historical-table", columns, rows, {
    initialSort: { key: "year", dir: "desc" },
  });
}

/* ------------------------- Venues table ------------------------- */
export function renderVenues(venues, matches) {
  const counts = new Map(calc.matchesByVenue(matches).map((d) => [d.venue, d.count]));
  const rows = venues.map((v) => ({ ...v, matches_hosted: counts.get(v.venue) ?? 0 }));
  const columns = [
    { key: "venue", label: "Stadium", num: false },
    { key: "city", label: "City", num: false },
    { key: "country", label: "Country", num: false },
    { key: "capacity", label: "Capacity", num: true },
    { key: "matches_hosted", label: "Matches", num: true },
  ];
  renderSortableTable("venues-table", columns, rows, {
    formatCell: (row, col) => {
      if (col.key === "capacity") return row.capacity == null ? "—" : Number(row.capacity).toLocaleString();
      return esc(row[col.key]);
    },
    initialSort: { key: "matches_hosted", dir: "desc" },
  });
}

/* ----------------- Generic sortable table builder --------------- */
// Holds current sort state per table id so header clicks toggle direction.
const sortState = {};

function renderSortableTable(tableId, columns, rows, opts = {}) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const formatCell = opts.formatCell || ((row, col) => esc(row[col.key]));

  if (!sortState[tableId] && opts.initialSort) sortState[tableId] = { ...opts.initialSort };
  const state = sortState[tableId];

  const sorted = rows.slice();
  if (state) {
    const { key, dir } = state;
    const factor = dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }

  const head = columns.map((c) => {
    let cls = "sortable" + (c.num ? " num" : "");
    if (state && state.key === c.key) cls += state.dir === "asc" ? " sort-asc" : " sort-desc";
    return `<th class="${cls}" data-key="${c.key}">${c.label}</th>`;
  }).join("");

  const body = sorted.length
    ? sorted.map((row) => "<tr>" + columns.map((c) =>
        `<td class="${c.num ? "num" : ""}">${formatCell(row, c)}</td>`).join("") + "</tr>").join("")
    : emptyRow(columns.length, "No data.");

  table.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;

  // Wire header clicks → toggle sort and re-render in place.
  table.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      const cur = sortState[tableId];
      const dir = cur && cur.key === key && cur.dir === "desc" ? "asc" : "desc";
      sortState[tableId] = { key, dir };
      renderSortableTable(tableId, columns, rows, opts);
    });
  });
}
