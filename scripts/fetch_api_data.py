"""
fetch_api_data.py  —  Phase 2 (not used by the static MVP).

Pulls FIFA World Cup data from football-data.org and exports clean JSON files
into ../data that the dashboard already knows how to read.

SECURITY: the API key is read from the FOOTBALL_DATA_API_KEY environment
variable (or a local .env file). It is NEVER written into any file under
assets/ and must never be committed. See README.md.

Usage:
    pip install -r requirements.txt
    export FOOTBALL_DATA_API_KEY=your_key_here     # or put it in .env
    python scripts/fetch_api_data.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests  # type: ignore

API_BASE = "https://api.football-data.org/v4"
# football-data.org competition code for the FIFA World Cup.
COMPETITION = "WC"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = Path(__file__).resolve().parent / "_raw"  # gitignored raw dumps


def load_env() -> None:
    """Load KEY=VALUE pairs from a local .env file if present (no dependency)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def get_api_key() -> str:
    key = os.environ.get("FOOTBALL_DATA_API_KEY")
    if not key:
        sys.exit(
            "ERROR: FOOTBALL_DATA_API_KEY is not set.\n"
            "Set it as an environment variable or in a local .env file "
            "(see README). The key must never be committed."
        )
    return key


def api_get(path: str, key: str) -> dict:
    """GET a football-data.org endpoint with graceful error handling."""
    url = f"{API_BASE}/{path}"
    try:
        resp = requests.get(url, headers={"X-Auth-Token": key}, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        print(f"  ! HTTP {status} for {path}: {e}", file=sys.stderr)
    except requests.RequestException as e:
        print(f"  ! Network error for {path}: {e}", file=sys.stderr)
    return {}


def save_raw(name: str, payload: dict) -> None:
    RAW_DIR.mkdir(exist_ok=True)
    (RAW_DIR / f"{name}.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )


def main() -> int:
    load_env()
    key = get_api_key()

    print("Fetching competition, matches, standings and scorers from football-data.org…")
    competition = api_get(f"competitions/{COMPETITION}", key)
    matches = api_get(f"competitions/{COMPETITION}/matches", key)
    standings = api_get(f"competitions/{COMPETITION}/standings", key)
    scorers = api_get(f"competitions/{COMPETITION}/scorers?limit=25", key)

    if not matches:
        print("No matches returned — aborting without overwriting existing data.")
        return 1

    # Keep the raw responses for debugging / re-processing.
    save_raw("competition", competition)
    save_raw("matches", matches)
    save_raw("standings", standings)
    save_raw("scorers", scorers)

    # Hand the raw payloads to clean_data for transformation into dashboard JSON.
    from clean_data import transform_and_export  # local import keeps deps light

    transform_and_export(matches, standings, scorers, DATA_DIR)

    # Stamp when the data was pulled from the API (UTC ISO-8601).
    from datetime import datetime, timezone
    stamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    (DATA_DIR / "meta.json").write_text(
        json.dumps({"last_updated": stamp, "source": "football-data.org"}, indent=2),
        encoding="utf-8",
    )
    print(f"  • meta.json    — last_updated {stamp}")

    print(f"Done. Dashboard JSON written to {DATA_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
