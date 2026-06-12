// charts.js
// Thin wrappers around Chart.js. Each renderer keeps a reference to the chart it
// created and destroys it before re-rendering, so charts update cleanly when the
// filters change. Chart.js is loaded globally from the CDN (window.Chart).

import * as calc from "./calculations.js";

const PALETTE = {
  green: "#0a8754",
  blue: "#2f6fed",
  gold: "#e4b343",
  ink: "#1c2b40",
  slate: "#5b6b80",
};
// A repeating set of distinct colors for categorical charts.
const SERIES = ["#0a8754", "#2f6fed", "#e4b343", "#d65745", "#7d5ba6", "#179e9e", "#e07b39", "#3a86ff"];

// Registry of live charts keyed by canvas id, so we can destroy on re-render.
const charts = {};

function render(canvasId, config) {
  if (typeof window.Chart === "undefined") {
    console.warn("[charts] Chart.js not loaded yet.");
    return;
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new window.Chart(canvas.getContext("2d"), config);
}

const baseOptions = (extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  ...extra,
});

const gridScales = () => ({
  x: { grid: { display: false }, ticks: { color: PALETTE.slate, font: { size: 11 } } },
  y: { beginAtZero: true, ticks: { precision: 0, color: PALETTE.slate }, grid: { color: "#eef1f5" } },
});

/* ----------------------- Team Performance ----------------------- */
export function renderGoalsByTeam(matches, teams) {
  const data = calc.goalsByTeam(matches, teams).filter((d) => d.goals_for > 0);
  render("chart-goals-team", {
    type: "bar",
    data: {
      labels: data.map((d) => d.team),
      datasets: [{ data: data.map((d) => d.goals_for), backgroundColor: PALETTE.green, borderRadius: 5 }],
    },
    options: baseOptions({ scales: gridScales() }),
  });
}

export function renderPointsByTeam(matches, teams) {
  const data = calc.pointsByTeam(matches, teams).filter((d) => d.points > 0);
  render("chart-points-team", {
    type: "bar",
    data: {
      labels: data.map((d) => d.team),
      datasets: [{ data: data.map((d) => d.points), backgroundColor: PALETTE.blue, borderRadius: 5 }],
    },
    options: baseOptions({ scales: gridScales() }),
  });
}

/* -------------------------- Goal Analysis ----------------------- */
export function renderGoalsByGroup(matches) {
  const obj = calc.goalsByGroup(matches);
  const labels = Object.keys(obj).sort();
  render("chart-goals-group", {
    type: "bar",
    data: {
      labels: labels.map((g) => "Group " + g),
      datasets: [{ data: labels.map((g) => obj[g]), backgroundColor: PALETTE.gold, borderRadius: 5 }],
    },
    options: baseOptions({ scales: gridScales() }),
  });
}

export function renderGoalsByDate(matches) {
  const data = calc.goalsByDate(matches);
  render("chart-goals-date", {
    type: "line",
    data: {
      labels: data.map((d) => d.date),
      datasets: [{
        data: data.map((d) => d.goals),
        borderColor: PALETTE.green,
        backgroundColor: "rgba(10,135,84,.12)",
        fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: PALETTE.green,
      }],
    },
    options: baseOptions({ scales: gridScales() }),
  });
}

export function renderMatchesByStage(matches) {
  const obj = calc.matchesByStage(matches);
  const labels = Object.keys(obj);
  render("chart-stage", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: labels.map((s) => obj[s]), backgroundColor: SERIES, borderWidth: 2, borderColor: "#fff" }],
    },
    options: baseOptions({ cutout: "62%", plugins: { legend: { display: true, position: "bottom", labels: { color: PALETTE.slate, font: { size: 11 } } } } }),
  });
}

/* ------------------------- Historical --------------------------- */
export function renderTitlesByCountry(historical) {
  const obj = calc.titlesByCountry(historical);
  const labels = Object.keys(obj);
  render("chart-titles", {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: labels.map((c) => obj[c]), backgroundColor: PALETTE.ink, borderRadius: 5 }],
    },
    options: baseOptions({ indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0, color: PALETTE.slate }, grid: { color: "#eef1f5" } }, y: { grid: { display: false }, ticks: { color: PALETTE.slate } } } }),
  });
}

/* --------------------------- Venues ----------------------------- */
export function renderMatchesByVenue(matches) {
  const data = calc.matchesByVenue(matches);
  render("chart-venues", {
    type: "bar",
    data: {
      labels: data.map((d) => d.venue),
      datasets: [{ data: data.map((d) => d.count), backgroundColor: PALETTE.blue, borderRadius: 5 }],
    },
    options: baseOptions({ indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0, color: PALETTE.slate }, grid: { color: "#eef1f5" } }, y: { grid: { display: false }, ticks: { color: PALETTE.slate, font: { size: 10 } } } } }),
  });
}

/** Re-render every chart from the current (filtered) match set. */
export function renderAllCharts({ matches, teams, historical }) {
  renderGoalsByTeam(matches, teams);
  renderPointsByTeam(matches, teams);
  renderGoalsByGroup(matches);
  renderGoalsByDate(matches);
  renderMatchesByStage(matches);
  renderMatchesByVenue(matches);
  // Historical chart uses the full, unfiltered historical dataset.
  renderTitlesByCountry(historical);
}
