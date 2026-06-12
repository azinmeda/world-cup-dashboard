"""
clean_data.py  —  Phase 2 transform.

Turns raw football-data.org API payloads into the dashboard JSON schema in /data:
  • matches.json  — every fixture (group stage + knockouts)
  • teams.json    — all teams with their group (derived from the standings tables)

Standings themselves are NOT exported as a file — the dashboard recomputes group
tables from matches.json — so this module focuses on matches + the team→group map.

Import-safe: no network I/O, so it can be unit tested with sample payloads.
"""

from __future__ import annotations

import json
from pathlib import Path

# football-data.org stage code → friendly label shown on the dashboard.
STAGE_MAP = {
    "GROUP_STAGE": "Group Stage",
    "LAST_32": "Round of 32",
    "LAST_16": "Round of 16",
    "QUARTER_FINALS": "Quarter-finals",
    "SEMI_FINALS": "Semi-finals",
    "THIRD_PLACE": "Third-place",
    "FINAL": "Final",
}


def _status(api_status: str) -> tuple[str, bool]:
    """Map an API match status to (label, is_complete)."""
    s = (api_status or "").upper()
    if s in {"FINISHED", "AWARDED"}:
        return "Complete", True
    return "Scheduled", False


def _group_letter(raw: str | None) -> str:
    """'GROUP_A' / 'Group A' → 'A'; knockouts (None) → ''."""
    if not raw:
        return ""
    return raw.replace("GROUP_", "").replace("Group", "").strip()


def transform_matches(api_matches: dict) -> list[dict]:
    """Convert the API /matches payload into the dashboard's match schema."""
    out: list[dict] = []
    for i, m in enumerate(api_matches.get("matches", []), start=1):
        label, complete = _status(m.get("status"))
        score = (m.get("score") or {}).get("fullTime") or {}
        utc = m.get("utcDate", "") or ""
        date, _, time = utc.partition("T")
        out.append(
            {
                "match_id": str(m.get("id", f"{i:03d}")),
                "date": date,
                "time": time[:5],
                "stage": STAGE_MAP.get(m.get("stage"), (m.get("stage") or "").replace("_", " ").title()),
                "group": _group_letter(m.get("group")),
                "home_team": (m.get("homeTeam") or {}).get("name"),
                "away_team": (m.get("awayTeam") or {}).get("name"),
                "home_score": score.get("home") if complete else None,
                "away_score": score.get("away") if complete else None,
                "status": label,
                "venue": m.get("venue") or "",   # free tier omits venue → blank
                "city": "",
                "country": "",
            }
        )
    return out


def transform_teams(api_standings: dict) -> list[dict]:
    """Build the team→group map from the TOTAL standings tables."""
    teams: list[dict] = []
    seen: set[str] = set()
    for table in api_standings.get("standings", []):
        if table.get("type") != "TOTAL":
            continue
        group = _group_letter(table.get("group"))
        for row in table.get("table", []):
            t = row.get("team", {})
            tid = t.get("tla") or str(t.get("id"))
            if not tid or tid in seen:
                continue
            seen.add(tid)
            teams.append(
                {
                    "team_id": tid,
                    "team_name": t.get("name"),
                    "group": group,
                    "confederation": "",          # not provided by the API
                    "crest": t.get("crest", ""),  # SVG badge URL, for future use
                }
            )
    teams.sort(key=lambda x: (x["group"], x["team_name"] or ""))
    return teams


def transform_and_export(api_matches: dict, api_standings: dict, data_dir: Path) -> None:
    """Write dashboard-ready matches.json and teams.json into data_dir."""
    data_dir.mkdir(parents=True, exist_ok=True)

    matches = transform_matches(api_matches)
    (data_dir / "matches.json").write_text(
        json.dumps(matches, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  • matches.json — {len(matches)} matches")

    teams = transform_teams(api_standings)
    if teams:
        (data_dir / "teams.json").write_text(
            json.dumps(teams, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        groups = sorted({t["group"] for t in teams if t["group"]})
        print(f"  • teams.json   — {len(teams)} teams across {len(groups)} groups ({', '.join(groups)})")
    else:
        print("  • teams.json   — skipped (no standings returned)")

    # venues.json is curated (free tier provides no venue data) and left untouched.
