"""
clean_data.py  —  Phase 2 (not used by the static MVP).

Transforms raw football-data.org API payloads into the dashboard JSON schema
used by /data (matches.json, etc.). Standings are intentionally NOT exported as
a maintained file — the dashboard recomputes group tables from matches.json — so
this module focuses on producing a clean, validated matches.json.

This file is import-safe: it does no network I/O and can be unit tested with
sample payloads.
"""

from __future__ import annotations

import json
from pathlib import Path


def _status(api_status: str) -> tuple[str, bool]:
    """Map a football-data.org match status to (label, is_complete)."""
    s = (api_status or "").upper()
    if s in {"FINISHED", "AWARDED"}:
        return "Complete", True
    return "Scheduled", False


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
                "stage": (m.get("stage") or "Group Stage").replace("_", " ").title(),
                "group": (m.get("group") or "").replace("GROUP_", "").strip(),
                "home_team": (m.get("homeTeam") or {}).get("name"),
                "away_team": (m.get("awayTeam") or {}).get("name"),
                "home_score": score.get("home") if complete else None,
                "away_score": score.get("away") if complete else None,
                "status": label,
                "venue": m.get("venue") or "",
                "city": "",
                "country": "",
            }
        )
    return out


def transform_and_export(api_matches: dict, api_standings: dict, data_dir: Path) -> None:
    """Write dashboard-ready JSON files into data_dir."""
    data_dir.mkdir(parents=True, exist_ok=True)
    matches = transform_matches(api_matches)
    (data_dir / "matches.json").write_text(
        json.dumps(matches, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  • matches.json — {len(matches)} matches")
    # teams.json / venues.json / historical_world_cup.json are curated and not
    # overwritten here; extend this function if you want to derive them from the API.
