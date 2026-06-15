// data-loader.js
// Responsible for fetching the dashboard's JSON data files and validating them.
// All functions return Promises. Fetch failures are caught and logged so a single
// missing file degrades gracefully instead of crashing the whole dashboard.

const DATA_DIR = "data";

/**
 * Shared fetch helper. Loads and parses a JSON file from the /data folder.
 * Returns the parsed value, or `fallback` (default []) if the request fails.
 */
async function loadJSON(filename, fallback = []) {
  try {
    const response = await fetch(`${DATA_DIR}/${filename}`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.warn(`[data-loader] Could not load ${filename}:`, err.message);
    return fallback;
  }
}

export const loadMatches = () => loadJSON("matches.json");
export const loadTeams = () => loadJSON("teams.json");
export const loadGroups = () => loadJSON("groups.json");
export const loadVenues = () => loadJSON("venues.json");
export const loadHistoricalWorldCup = () => loadJSON("historical_world_cup.json");
export const loadScorers = () => loadJSON("scorers.json");
export const loadMeta = () => loadJSON("meta.json", {});

/** Load every dataset in parallel. */
export async function loadAll() {
  const [matches, teams, groups, venues, historical, scorers, meta] = await Promise.all([
    loadMatches(),
    loadTeams(),
    loadGroups(),
    loadVenues(),
    loadHistoricalWorldCup(),
    loadScorers(),
    loadMeta(),
  ]);
  return { matches, teams, groups, venues, historical, scorers, meta };
}

/**
 * Validate the core datasets against the spec's Data Quality Rules.
 * Returns an array of human-readable warning strings (empty = clean).
 * Warnings are non-blocking: the dashboard still renders so a typo in the data
 * never produces a blank page.
 */
export function validateData(matches, teams, venues) {
  const warnings = [];
  const teamNames = new Set(teams.map((t) => t.team_name));
  const teamGroup = new Map(teams.map((t) => [t.team_name, t.group]));
  const venueNames = new Set(venues.map((v) => v.venue));
  const seenPairs = new Set();

  for (const m of matches) {
    const id = m.match_id ?? "(no id)";
    const complete = String(m.status).toLowerCase() === "complete";
    const hasTeams = Boolean(m.home_team && m.away_team);

    // Missing team names — only an error for completed matches. Knockout
    // fixtures are legitimately "TBD" until the bracket fills in.
    if (complete && !hasTeams) {
      warnings.push(`Match ${id}: missing team name.`);
    }

    // Unknown teams
    if (m.home_team && !teamNames.has(m.home_team)) {
      warnings.push(`Match ${id}: unknown home team "${m.home_team}".`);
    }
    if (m.away_team && !teamNames.has(m.away_team)) {
      warnings.push(`Match ${id}: unknown away team "${m.away_team}".`);
    }

    // Team assigned to wrong group
    if (m.group && teamGroup.has(m.home_team) && teamGroup.get(m.home_team) !== m.group) {
      warnings.push(`Match ${id}: ${m.home_team} is not in group ${m.group}.`);
    }
    if (m.group && teamGroup.has(m.away_team) && teamGroup.get(m.away_team) !== m.group) {
      warnings.push(`Match ${id}: ${m.away_team} is not in group ${m.group}.`);
    }

    // Invalid date
    if (m.date && isNaN(Date.parse(m.date))) {
      warnings.push(`Match ${id}: invalid date "${m.date}".`);
    }

    // Status / score consistency
    const hasScores = m.home_score !== null && m.home_score !== undefined &&
      m.away_score !== null && m.away_score !== undefined;

    if (complete && !hasScores) {
      warnings.push(`Match ${id}: marked Complete but missing scores.`);
    }
    if (!complete && hasScores) {
      warnings.push(`Match ${id}: has scores but status is "${m.status}".`);
    }

    // Negative scores
    if (hasScores && (m.home_score < 0 || m.away_score < 0)) {
      warnings.push(`Match ${id}: negative score.`);
    }

    // Inconsistent venue names
    if (m.venue && !venueNames.has(m.venue)) {
      warnings.push(`Match ${id}: venue "${m.venue}" not found in venues.json.`);
    }

    // Duplicate fixtures (same two teams, same date) — only checked once both
    // teams are known, so TBD knockout slots aren't falsely flagged.
    if (hasTeams) {
      const pairKey = [m.home_team, m.away_team, m.date].join("|");
      if (seenPairs.has(pairKey)) {
        warnings.push(`Match ${id}: possible duplicate fixture.`);
      }
      seenPairs.add(pairKey);
    }
  }

  if (warnings.length) {
    console.warn(`[data-loader] Validation found ${warnings.length} issue(s):`);
    warnings.forEach((w) => console.warn("  • " + w));
  } else {
    console.info("[data-loader] Data validation passed with no issues.");
  }
  return warnings;
}
