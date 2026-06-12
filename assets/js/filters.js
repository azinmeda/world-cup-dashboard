// filters.js
// Owns the filter UI state and the logic that narrows the match list. The filtered
// match set is the single source of truth that KPIs, charts and tables read from,
// so every view stays consistent when filters change.

const state = { group: "", team: "", stage: "", status: "", date: "" };

/** Populate the filter <select> options from the loaded data. */
export function populateFilters({ matches, teams }) {
  const groupSel = document.getElementById("filter-group");
  const teamSel = document.getElementById("filter-team");
  const stageSel = document.getElementById("filter-stage");

  const groups = [...new Set(teams.map((t) => t.group))].sort();
  const teamNames = [...new Set(teams.map((t) => t.team_name))].sort();
  const stages = [...new Set(matches.map((m) => m.stage))].sort();

  for (const g of groups) groupSel.add(new Option(`Group ${g}`, g));
  for (const t of teamNames) teamSel.add(new Option(t, t));
  for (const s of stages) stageSel.add(new Option(s, s));
}

/** Apply the current filter state to a match array. */
export function applyFilters(matches) {
  return matches.filter((m) => {
    if (state.group && m.group !== state.group) return false;
    if (state.team && m.home_team !== state.team && m.away_team !== state.team) return false;
    if (state.stage && m.stage !== state.stage) return false;
    if (state.status && String(m.status).toLowerCase() !== state.status.toLowerCase()) return false;
    if (state.date && m.date !== state.date) return false;
    return true;
  });
}

export function getState() {
  return { ...state };
}

/**
 * Wire all filter controls. `onChange` is called whenever any filter changes,
 * after the internal state is updated.
 */
export function initFilters(onChange) {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
      state[key] = el.value;
      onChange();
    });
  };
  bind("filter-group", "group");
  bind("filter-team", "team");
  bind("filter-stage", "stage");
  bind("filter-status", "status");
  bind("filter-date", "date");

  document.getElementById("filter-reset").addEventListener("click", () => {
    Object.keys(state).forEach((k) => (state[k] = ""));
    ["filter-group", "filter-team", "filter-stage", "filter-status", "filter-date"]
      .forEach((id) => (document.getElementById(id).value = ""));
    onChange();
  });
}
