// calculations.js
// Pure functions (no DOM access) that derive every number shown on the dashboard
// from the raw match data. Keeping these side-effect free makes them easy to test
// and to reuse once the live API replaces the sample JSON.

/** A match counts as "played" only when it is complete and has both scores. */
export function isComplete(match) {
  return (
    String(match.status).toLowerCase() === "complete" &&
    match.home_score !== null && match.home_score !== undefined &&
    match.away_score !== null && match.away_score !== undefined
  );
}

export const completedMatches = (matches) => matches.filter(isComplete);
export const scheduledMatches = (matches) => matches.filter((m) => !isComplete(m));
export const totalMatches = (matches) => matches.length;

/** Sum of every goal scored across completed matches. */
export function totalGoals(matches) {
  return completedMatches(matches).reduce(
    (sum, m) => sum + m.home_score + m.away_score,
    0
  );
}

/** Average goals per completed match (0 when nothing has been played yet). */
export function avgGoalsPerMatch(matches) {
  const played = completedMatches(matches).length;
  return played === 0 ? 0 : totalGoals(matches) / played;
}

/**
 * Build per-team aggregate stats from completed matches.
 * Returns a Map keyed by team name.
 */
export function computeTeamStats(matches, teams) {
  const stats = new Map();
  const init = (name, group) => ({
    team: name,
    group: group ?? "",
    played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
    clean_sheets: 0,
  });

  // Seed every known team so teams that haven't played still appear (with zeros).
  for (const t of teams) stats.set(t.team_name, init(t.team_name, t.group));

  for (const m of completedMatches(matches)) {
    for (const side of ["home", "away"]) {
      const name = side === "home" ? m.home_team : m.away_team;
      if (!stats.has(name)) stats.set(name, init(name, m.group));
    }
    const home = stats.get(m.home_team);
    const away = stats.get(m.away_team);

    home.played++; away.played++;
    home.goals_for += m.home_score; home.goals_against += m.away_score;
    away.goals_for += m.away_score; away.goals_against += m.home_score;
    if (m.away_score === 0) home.clean_sheets++;
    if (m.home_score === 0) away.clean_sheets++;

    if (m.home_score > m.away_score) {
      home.wins++; home.points += 3; away.losses++;
    } else if (m.home_score < m.away_score) {
      away.wins++; away.points += 3; home.losses++;
    } else {
      home.draws++; away.draws++; home.points += 1; away.points += 1;
    }
  }

  for (const s of stats.values()) {
    s.goal_difference = s.goals_for - s.goals_against;
    s.avg_goals = s.played ? s.goals_for / s.played : 0;
  }
  return stats;
}

/** Comparator implementing the MVP tiebreaker order: points → GD → goals for. */
function byRanking(a, b) {
  return (
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    a.team.localeCompare(b.team)
  );
}

/**
 * Compute group standings tables from match results.
 * Returns an object keyed by group letter → sorted array of team rows.
 */
export function computeStandings(matches, teams) {
  const stats = computeTeamStats(matches, teams);
  const groups = {};
  for (const row of stats.values()) {
    const g = row.group || "?";
    (groups[g] ??= []).push(row);
  }
  for (const g of Object.keys(groups)) {
    groups[g].sort(byRanking);
  }
  return groups;
}

/** Flat, ranking-sorted list of all team rows (for the team performance table). */
export function teamStandingsList(matches, teams) {
  return [...computeTeamStats(matches, teams).values()].sort(byRanking);
}

export function topScoringTeam(matches, teams) {
  const list = [...computeTeamStats(matches, teams).values()];
  if (!list.length) return null;
  return list.reduce((best, t) => (t.goals_for > best.goals_for ? t : best));
}

export function bestDefensiveTeam(matches, teams) {
  // Among teams that have played, fewest goals against.
  const list = [...computeTeamStats(matches, teams).values()].filter((t) => t.played > 0);
  if (!list.length) return null;
  return list.reduce((best, t) => (t.goals_against < best.goals_against ? t : best));
}

export function highestScoringMatch(matches) {
  const played = completedMatches(matches);
  if (!played.length) return null;
  return played.reduce((best, m) =>
    (m.home_score + m.away_score) > (best.home_score + best.away_score) ? m : best
  );
}

/** Group letter → leading team name. */
export function groupLeaders(matches, teams) {
  const standings = computeStandings(matches, teams);
  const leaders = {};
  for (const [g, rows] of Object.entries(standings)) {
    if (rows.length) leaders[g] = rows[0].team;
  }
  return leaders;
}

/** { groupLetter: totalGoals } across completed matches. */
export function goalsByGroup(matches) {
  const out = {};
  for (const m of completedMatches(matches)) {
    out[m.group] = (out[m.group] ?? 0) + m.home_score + m.away_score;
  }
  return out;
}

/** Array of { team, goals_for } sorted descending — for the goals-by-team chart. */
export function goalsByTeam(matches, teams) {
  return [...computeTeamStats(matches, teams).values()]
    .map((t) => ({ team: t.team, goals_for: t.goals_for }))
    .sort((a, b) => b.goals_for - a.goals_for);
}

/** Array of { team, points } sorted descending — for the points-by-team chart. */
export function pointsByTeam(matches, teams) {
  return [...computeTeamStats(matches, teams).values()]
    .map((t) => ({ team: t.team, points: t.points }))
    .sort((a, b) => b.points - a.points);
}

/** Chronological [{ date, goals }] of goals scored per match-day date. */
export function goalsByDate(matches) {
  const out = new Map();
  for (const m of completedMatches(matches)) {
    out.set(m.date, (out.get(m.date) ?? 0) + m.home_score + m.away_score);
  }
  return [...out.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, goals]) => ({ date, goals }));
}

/** { stage: matchCount } across all matches — for the donut chart. */
export function matchesByStage(matches) {
  const out = {};
  for (const m of matches) out[m.stage] = (out[m.stage] ?? 0) + 1;
  return out;
}

/** Array of { venue, count } sorted descending — for the venue chart/table. */
export function matchesByVenue(matches) {
  const out = new Map();
  for (const m of matches) out.set(m.venue, (out.get(m.venue) ?? 0) + 1);
  return [...out.entries()]
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count);
}

/** { country: titleCount } from the historical dataset. */
export function titlesByCountry(historical) {
  const out = {};
  for (const t of historical) out[t.champion] = (out[t.champion] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(out).sort((a, b) => b[1] - a[1])
  );
}
