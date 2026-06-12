"""Build data/match_venues.json from Wikipedia's official WC2026 schedule.

The football-data.org free feed carries no venue information, but FIFA fixed
every match's stadium before the draw and the per-group Wikipedia articles
carry the schedule in {{football box}} templates with FIFA team codes.

Group-stage matches are keyed by the (unordered) pair of team codes — each
pairing occurs exactly once. Knockout slots have no teams yet, so they are
keyed by exact UTC kickoff instead. Re-run this script after each knockout
round is drawn to keep venues complete:

    python scripts/build_venue_map.py
"""

import json
import os
import re
import subprocess
import time
import urllib.parse
from datetime import datetime, timedelta, timezone

UA = "MatchIQ/1.0 (venue enrichment script)"
PAGES = [f"2026 FIFA World Cup Group {c}" for c in "ABCDEFGHIJKL"] + ["2026 FIFA World Cup knockout stage"]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "match_venues.json")

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"])}


def fetch(page: str) -> str:
    url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(page.replace(" ", "_")) + "?action=raw"
    out = subprocess.run(["curl", "-s", "-m", "30", "-A", UA, url], capture_output=True, text=True, check=True)
    if not out.stdout:
        raise RuntimeError("empty response")
    return out.stdout


def strip_links(s: str) -> str:
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    return s.replace("'''", "").strip(" ,")


def parse_date(raw: str):
    sm = re.search(r"\{\{[Ss]tart date\|(\d{4})\|(\d{1,2})\|(\d{1,2})", raw)
    if sm:
        return f"{sm.group(1)}-{int(sm.group(2)):02d}-{int(sm.group(3)):02d}"
    dm = re.search(r"([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})", raw)
    if dm and dm.group(1) in MONTHS:
        return f"{dm.group(3)}-{MONTHS[dm.group(1)]:02d}-{int(dm.group(2)):02d}"
    dm = re.search(r"(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})", raw)
    if dm and dm.group(2) in MONTHS:
        return f"{dm.group(3)}-{MONTHS[dm.group(2)]:02d}-{int(dm.group(1)):02d}"
    return None


def parse_utc(date_iso: str, time_raw: str):
    """'1:00 p.m. UTC−6' on 2026-06-11 → exact UTC ISO instant."""
    if not date_iso:
        return None
    tm = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(?:&nbsp;|\s)*([ap])\.?m\.?", time_raw, re.I)
    om = re.search(r"UTC\s*[−\-–]\s*(\d{1,2})", time_raw) or re.search(r"UTC\s*\+\s*(\d{1,2})", time_raw)
    if not tm or not om:
        return None
    hour = int(tm.group(1)) % 12 + (12 if tm.group(3).lower() == "p" else 0)
    minute = int(tm.group(2) or 0)
    sign = -1 if re.search(r"[−\-–]", om.group(0)) else 1
    offset = sign * int(om.group(1))
    local = datetime.fromisoformat(date_iso).replace(hour=hour, minute=minute, tzinfo=timezone(timedelta(hours=offset)))
    return local.astimezone(timezone.utc).isoformat()


def team_code(raw: str):
    m = re.search(r"\{\{#invoke:flag\|fb(?:-rt)?\|([A-Z]{3})", raw) or re.search(r"\{\{fb(?:-rt)?\|([A-Z]{3})", raw)
    return m.group(1) if m else None


def parse_boxes(text: str):
    out = []
    for m in re.finditer(r"\{\{#invoke:football box\|main|\{\{[Ff]ootball\s?box", text):
        chunk = text[m.start():m.start() + 3000]
        fields = {}
        for line in chunk.split("\n"):
            lm = re.match(r"\s*\|\s*(date|time|team1|team2|stadium)\s*=\s*(.*)", line)
            if lm:
                fields.setdefault(lm.group(1), lm.group(2))
        if "stadium" not in fields or "date" not in fields:
            continue
        stadium_full = strip_links(fields["stadium"])
        stadium, _, city = stadium_full.rpartition(", ")
        if not stadium:
            stadium, city = stadium_full, ""
        date_iso = parse_date(fields["date"])
        out.append(
            {
                "date": date_iso,
                "utc": parse_utc(date_iso, fields.get("time", "")),
                "codes": sorted(c for c in (team_code(fields.get("team1", "")), team_code(fields.get("team2", ""))) if c) or None,
                "stadium": stadium,
                "city": city,
            }
        )
    return out


def main():
    entries = []
    for page in PAGES:
        try:
            boxes = parse_boxes(fetch(page))
        except Exception as exc:
            print(f"{page}: FAILED {exc}")
            continue
        entries.extend(boxes)
        print(f"{page}: {len(boxes)} matches")
        time.sleep(0.5)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, ensure_ascii=False, indent=1)
    paired = sum(1 for e in entries if e["codes"] and len(e["codes"]) == 2)
    print(f"wrote {len(entries)} venues ({paired} with team pairs) → {OUT}")


if __name__ == "__main__":
    main()
