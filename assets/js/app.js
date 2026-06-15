// app.js
// Entry point. Loads data, validates it, wires up filters, and orchestrates the
// (re)rendering of KPI cards, charts and tables from the current filtered match set.

import { loadAll, validateData } from "./data-loader.js";
import * as calc from "./calculations.js";
import * as charts from "./charts.js";
import * as tables from "./tables.js";
import { populateFilters, applyFilters, initFilters } from "./filters.js";

// Full datasets, loaded once. Filtering operates on `data.matches`.
let data = { matches: [], teams: [], groups: [], venues: [], historical: [], scorers: [], meta: {} };

/** Compute tournament progress from the season start/end dates (UTC-based). */
function tournamentDay(meta) {
  const start = meta && meta.season_start;
  const end = meta && meta.season_end;
  if (!start || !end) return null;
  const DAY = 86400000;
  const s = Date.parse(start + "T00:00:00Z");
  const e = Date.parse(end + "T00:00:00Z");
  if (isNaN(s) || isNaN(e)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    day: Math.floor((today - s) / DAY) + 1,     // day 1 == start date
    total: Math.round((e - s) / DAY) + 1,        // inclusive length
  };
}

/** Show when the data was last pulled from the API, in the visitor's local time. */
function setUpdated(meta) {
  const el = document.getElementById("last-updated");
  if (!el) return;
  const iso = meta && meta.last_updated;
  if (!iso) { el.textContent = "—"; return; }
  const d = new Date(iso);
  el.setAttribute("datetime", iso);
  el.textContent = d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  el.title = "Data last fetched from football-data.org";
}

/* ------------------------------ KPI cards ----------------------------- */
function kpiCard(label, value, sub = "", variant = "") {
  return `
    <div class="kpi-card ${variant}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
    </div>`;
}

function renderKPIs(matches) {
  const { teams } = data;
  const completed = calc.completedMatches(matches).length;
  const scheduled = calc.scheduledMatches(matches).length;
  const goals = calc.totalGoals(matches);
  const avg = calc.avgGoalsPerMatch(matches);
  const topScorer = calc.topScoringTeam(matches, teams);
  const bestDef = calc.bestDefensiveTeam(matches, teams);
  const highMatch = calc.highestScoringMatch(matches);
  const groupCount = new Set(teams.map((t) => t.group).filter(Boolean)).size;
  const hostCountries = [...new Set(data.venues.map((v) => v.country))];

  // Tournament progress — "Day X of N" from the season start/end dates.
  const td = tournamentDay(data.meta);
  let dayVal = "—", daySub = "tournament dates pending";
  if (td) {
    if (td.day < 1) { dayVal = `${1 - td.day}d`; daySub = "until kickoff"; }
    else if (td.day > td.total) { dayVal = "Done"; daySub = `${td.total}-day tournament complete`; }
    else { dayVal = `Day ${td.day}`; daySub = `of ${td.total} · ${td.total - td.day} to go`; }
  }

  // Golden Boot leader(s) — tournament-wide (not affected by match filters).
  const scorers = data.scorers || [];
  const topGoals = scorers.length ? scorers[0].goals : 0;
  const leaders = scorers.filter((s) => s.goals === topGoals && topGoals > 0);
  const lastName = (n) => (n || "").split(" ").slice(-1)[0];
  let bootSub;
  if (!leaders.length) bootSub = "no goals yet";
  else if (leaders.length === 1) bootSub = `${leaders[0].player} · ${leaders[0].team}`;
  else bootSub = `${leaders.length} tied: ${leaders.slice(0, 3).map((l) => lastName(l.player)).join(", ")}${leaders.length > 3 ? "…" : ""}`;

  const cards = [
    kpiCard("Tournament Day", dayVal, daySub, "accent"),
    kpiCard("Total Matches", matches.length, `${completed} done · ${scheduled} upcoming`, ""),
    kpiCard("Completed", completed, "matches played", "blue"),
    kpiCard("Total Goals", goals, "in completed matches", "accent"),
    kpiCard("Avg Goals / Match", avg.toFixed(2), "scoring rate", ""),
    kpiCard("Top Scoring Team", topScorer && topScorer.goals_for ? topScorer.team : "—",
      topScorer && topScorer.goals_for ? `${topScorer.goals_for} goals` : "no goals yet", "accent"),
    kpiCard("Golden Boot", topGoals || "—", bootSub, ""),
    kpiCard("Best Defense", bestDef ? bestDef.team : "—",
      bestDef ? `${bestDef.goals_against} conceded` : "—", "blue"),
    kpiCard("Highest Scoring Match",
      highMatch ? `${highMatch.home_score + highMatch.away_score} goals` : "—",
      highMatch ? `${highMatch.home_team} ${highMatch.home_score}–${highMatch.away_score} ${highMatch.away_team}` : "—", ""),
    kpiCard("Groups", groupCount, "of 4 teams each", ""),
    kpiCard("Host Countries", hostCountries.length, hostCountries.join(", "), "accent"),
    kpiCard("Stadiums", data.venues.length, "across host nations", "blue"),
  ].join("");

  document.getElementById("kpi-grid").innerHTML = cards;
}

/* --------------------------- Render everything ------------------------ */
// Called on load and on every filter change. Uses the filtered match set so all
// views stay in sync.
function renderAll() {
  const filtered = applyFilters(data.matches);

  renderKPIs(filtered);

  // Tables driven by the filtered matches.
  tables.renderCompletedMatches(filtered);
  tables.renderUpcomingMatches(filtered);
  tables.renderStandings(filtered, data.teams);
  tables.renderTeamStats(filtered, data.teams);
  tables.renderVenues(data.venues, filtered);

  // Charts driven by the filtered matches (historical uses full dataset).
  charts.renderAllCharts({ matches: filtered, teams: data.teams, historical: data.historical });
}

/* -------------------------------- Init -------------------------------- */
function setStatus(text, variant = "") {
  // Status readout is optional — no-op if it's not in the DOM.
  const el = document.getElementById("data-status");
  if (!el) return;
  el.textContent = text;
  el.className = "data-status" + (variant ? " " + variant : "");
}

/** Highlight the section nav link for whichever section is near the top. */
function initSectionNav() {
  const links = [...document.querySelectorAll(".nav-inner a")];
  if (!links.length) return;
  const map = new Map();
  for (const a of links) {
    const sec = document.getElementById(a.getAttribute("href").slice(1));
    if (sec) map.set(sec, a);
  }
  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((l) => l.classList.remove("active"));
        map.get(e.target)?.classList.add("active");
      }
    },
    { rootMargin: "-118px 0px -68% 0px", threshold: 0 }
  );
  for (const sec of map.keys()) obs.observe(sec);
}

async function init() {
  setStatus("Loading data…");
  data = await loadAll();

  if (!data.matches.length) {
    setStatus("No match data found", "warn");
    return;
  }

  setUpdated(data.meta);

  const warnings = validateData(data.matches, data.teams, data.venues);
  setStatus(
    warnings.length ? `Data loaded · ${warnings.length} validation warning(s)` : "Data loaded · validated",
    warnings.length ? "warn" : "ok"
  );

  // Build flag lookups for table rendering and populate filter dropdowns.
  tables.indexTeams(data.teams);
  populateFilters(data);
  initFilters(renderAll);

  // Static tables (not affected by match filters) — render once.
  tables.renderHistorical(data.historical);
  tables.renderScorers(data.scorers);

  initSectionNav();
  renderAll();
}

// Chart.js is loaded with `defer`; wait for full load so window.Chart exists.
window.addEventListener("load", init);
