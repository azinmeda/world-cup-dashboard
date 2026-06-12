// charts.js
// Thin wrappers around Chart.js, themed for the dark "Broadcast Editorial" look.
// Each renderer destroys its previous chart before re-drawing, so charts update
// cleanly when filters change. Chart.js is global (window.Chart) via the CDN.

import * as calc from "./calculations.js";

const C = {
  gold:  "#f1c45a",
  green: "#25d07f",
  light: "#c3ccd8",
  muted: "#7f8b9c",
  grid:  "rgba(255,255,255,0.06)",
  surface: "#12171f",
};
// Vivid categorical set that reads well on near-black.
const SERIES = ["#f1c45a", "#25d07f", "#5aa9ff", "#ef7d54", "#b98cff", "#19c6c6", "#ff6b9d", "#9bd64a"];

const charts = {};

function render(canvasId, config) {
  if (typeof window.Chart === "undefined") { console.warn("[charts] Chart.js not loaded yet."); return; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new window.Chart(canvas.getContext("2d"), config);
}

// Global defaults for fonts/colors on dark.
function applyDefaults() {
  if (typeof window.Chart === "undefined") return;
  window.Chart.defaults.color = C.muted;
  window.Chart.defaults.font.family = "'Hanken Grotesk', system-ui, sans-serif";
  window.Chart.defaults.font.weight = 600;
}

const baseOptions = (extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0c1017",
      borderColor: "rgba(255,255,255,.12)",
      borderWidth: 1,
      titleColor: C.light,
      bodyColor: C.light,
      padding: 10,
      cornerRadius: 8,
    },
  },
  ...extra,
});

const vScales = () => ({
  x: { grid: { display: false, drawBorder: false }, ticks: { color: C.muted, font: { size: 11 } } },
  y: { beginAtZero: true, ticks: { precision: 0, color: C.muted }, grid: { color: C.grid, drawBorder: false } },
});
const hScales = () => ({
  x: { beginAtZero: true, ticks: { precision: 0, color: C.muted }, grid: { color: C.grid, drawBorder: false } },
  y: { grid: { display: false, drawBorder: false }, ticks: { color: C.light, font: { size: 11 } } },
});

/* ----------------------- Team Performance ----------------------- */
export function renderGoalsByTeam(matches, teams) {
  const data = calc.goalsByTeam(matches, teams).filter((d) => d.goals_for > 0);
  render("chart-goals-team", {
    type: "bar",
    data: { labels: data.map((d) => d.team), datasets: [{ data: data.map((d) => d.goals_for), backgroundColor: C.gold, borderRadius: 4, maxBarThickness: 34 }] },
    options: baseOptions({ scales: vScales() }),
  });
}

export function renderPointsByTeam(matches, teams) {
  const data = calc.pointsByTeam(matches, teams).filter((d) => d.points > 0);
  render("chart-points-team", {
    type: "bar",
    data: { labels: data.map((d) => d.team), datasets: [{ data: data.map((d) => d.points), backgroundColor: C.green, borderRadius: 4, maxBarThickness: 34 }] },
    options: baseOptions({ scales: vScales() }),
  });
}

/* -------------------------- Goal Analysis ----------------------- */
export function renderGoalsByGroup(matches) {
  const obj = calc.goalsByGroup(matches);
  const labels = Object.keys(obj).sort();
  render("chart-goals-group", {
    type: "bar",
    data: { labels: labels.map((g) => "Grp " + g), datasets: [{ data: labels.map((g) => obj[g]), backgroundColor: C.gold, borderRadius: 4, maxBarThickness: 30 }] },
    options: baseOptions({ scales: vScales() }),
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
        borderColor: C.green,
        backgroundColor: "rgba(37,208,127,.14)",
        fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: C.green, pointBorderColor: "#0c1017", borderWidth: 2.5,
      }],
    },
    options: baseOptions({ scales: vScales() }),
  });
}

export function renderMatchesByStage(matches) {
  const obj = calc.matchesByStage(matches);
  const labels = Object.keys(obj);
  render("chart-stage", {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map((s) => obj[s]), backgroundColor: SERIES, borderWidth: 3, borderColor: C.surface }] },
    options: baseOptions({ cutout: "60%", plugins: { legend: { display: true, position: "bottom", labels: { color: C.light, font: { size: 11 }, boxWidth: 12, padding: 12 } } } }),
  });
}

/* ------------------------- Historical --------------------------- */
export function renderTitlesByCountry(historical) {
  const obj = calc.titlesByCountry(historical);
  const labels = Object.keys(obj);
  render("chart-titles", {
    type: "bar",
    data: { labels, datasets: [{ data: labels.map((c) => obj[c]), backgroundColor: C.gold, borderRadius: 4, maxBarThickness: 26 }] },
    options: baseOptions({ indexAxis: "y", scales: hScales() }),
  });
}

/* --------------------------- Venues ----------------------------- */
export function renderMatchesByVenue(matches) {
  const data = calc.matchesByVenue(matches);
  render("chart-venues", {
    type: "bar",
    data: { labels: data.map((d) => d.venue), datasets: [{ data: data.map((d) => d.count), backgroundColor: C.green, borderRadius: 4, maxBarThickness: 22 }] },
    options: baseOptions({ indexAxis: "y", scales: { x: hScales().x, y: { grid: { display: false, drawBorder: false }, ticks: { color: C.light, font: { size: 10 } } } } }),
  });
}

/** Re-render every chart from the current (filtered) match set. */
export function renderAllCharts({ matches, teams, historical }) {
  applyDefaults();
  renderGoalsByTeam(matches, teams);
  renderPointsByTeam(matches, teams);
  renderGoalsByGroup(matches);
  renderGoalsByDate(matches);
  renderMatchesByStage(matches);
  renderMatchesByVenue(matches);
  renderTitlesByCountry(historical);
}
