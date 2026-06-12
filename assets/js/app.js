// app.js
// Entry point. Loads data, validates it, wires up filters, and orchestrates the
// (re)rendering of KPI cards, charts and tables from the current filtered match set.

import { loadAll, validateData } from "./data-loader.js";
import * as calc from "./calculations.js";
import * as charts from "./charts.js";
import * as tables from "./tables.js";
import { populateFilters, applyFilters, initFilters } from "./filters.js";

// Full datasets, loaded once. Filtering operates on `data.matches`.
let data = { matches: [], teams: [], groups: [], venues: [], historical: [] };

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
  const leaders = calc.groupLeaders(matches, teams);
  const venuesUsed = new Set(matches.map((m) => m.venue)).size;
  const hostCountries = [...new Set(data.venues.map((v) => v.country))];

  const leaderText = Object.entries(leaders)
    .map(([g, t]) => `${g}: ${t}`)
    .join(" · ") || "—";

  const cards = [
    kpiCard("Total Matches", matches.length, `${completed} done · ${scheduled} upcoming`, ""),
    kpiCard("Completed", completed, "matches played", "blue"),
    kpiCard("Total Goals", goals, "in completed matches", "accent"),
    kpiCard("Avg Goals / Match", avg.toFixed(2), "scoring rate", ""),
    kpiCard("Top Scoring Team", topScorer && topScorer.goals_for ? topScorer.team : "—",
      topScorer && topScorer.goals_for ? `${topScorer.goals_for} goals` : "no goals yet", "accent"),
    kpiCard("Best Defense", bestDef ? bestDef.team : "—",
      bestDef ? `${bestDef.goals_against} conceded` : "—", "blue"),
    kpiCard("Highest Scoring Match",
      highMatch ? `${highMatch.home_score + highMatch.away_score} goals` : "—",
      highMatch ? `${highMatch.home_team} ${highMatch.home_score}–${highMatch.away_score} ${highMatch.away_team}` : "—", ""),
    kpiCard("Venues Used", venuesUsed, `of ${data.venues.length} stadiums`, ""),
    kpiCard("Host Countries", hostCountries.length, hostCountries.join(", "), "accent"),
    kpiCard("Group Leaders", `${Object.keys(leaders).length}/4`, leaderText, "blue"),
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
  const el = document.getElementById("data-status");
  el.textContent = text;
  el.className = "data-status" + (variant ? " " + variant : "");
}

async function init() {
  setStatus("Loading data…");
  data = await loadAll();

  if (!data.matches.length) {
    setStatus("No match data found", "warn");
    return;
  }

  const warnings = validateData(data.matches, data.teams, data.venues);
  setStatus(
    warnings.length ? `Data loaded · ${warnings.length} validation warning(s)` : "Data loaded · validated",
    warnings.length ? "warn" : "ok"
  );

  // Build flag lookups for table rendering and populate filter dropdowns.
  tables.indexTeams(data.teams);
  populateFilters(data);
  initFilters(renderAll);

  // The historical table is static (not affected by match filters) — render once.
  tables.renderHistorical(data.historical);

  renderAll();
}

// Chart.js is loaded with `defer`; wait for full load so window.Chart exists.
window.addEventListener("load", init);
