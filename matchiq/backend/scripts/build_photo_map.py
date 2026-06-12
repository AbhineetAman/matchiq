"""One-shot builder for data/player_photos.json.

Resolves player photos from Wikidata (P18 → Wikimedia Commons) by exact
label match, disambiguated by citizenship vs the squad nationality.
Commons thumbnails are hotlinkable and free to use. Re-run whenever
squads change; existing entries are kept unless --refresh is passed.

Usage:  python scripts/build_photo_map.py [--refresh]
"""

import json
import os
import sys
import time

import httpx
from dotenv import load_dotenv

_BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _BACKEND)
load_dotenv(os.path.join(_BACKEND, ".env"))  # live squads need the API token

from services.football_api import api  # noqa: E402
from services.photos import norm  # noqa: E402

SPARQL = "https://query.wikidata.org/sparql"
UA = "MatchIQ/1.0 (https://github.com/AbhineetAman/matchiq; player photo enrichment)"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "player_photos.json")
CHUNK = 120
# squad nationality (football-data.org) → Wikidata citizenship label where they differ
COUNTRY_ALIASES = {
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "IR Iran": "Iran",
    "Cabo Verde": "Cape Verde",
    "Congo DR": "Democratic Republic of the Congo",
    "USA": "United States of America",
    "Türkiye": "Turkey",
}


def build_query(names):
    values = " ".join(json.dumps(n) + "@en" for n in names)
    return f"""
SELECT ?label ?image ?citizenLabel WHERE {{
  VALUES ?label {{ {values} }}
  ?p rdfs:label ?label ; wdt:P106 wd:Q937857 ; wdt:P18 ?image .
  OPTIONAL {{ ?p wdt:P27 ?citizen . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
"""


def main(refresh: bool = False):
    players = api.players()
    print(f"{len(players)} players loaded")

    existing = {}
    if os.path.exists(OUT) and not refresh:
        existing = json.load(open(OUT, encoding="utf-8"))

    wanted = {}  # exact name → (norm key, nationality)
    for p in players:
        if norm(p["name"]) not in existing:
            wanted[p["name"]] = (norm(p["name"]), p.get("nationality") or "")

    names = sorted(wanted)
    print(f"{len(names)} to resolve ({len(existing)} cached)")

    found = dict(existing)
    ambiguous = 0
    for i in range(0, len(names), CHUNK):
        chunk = names[i:i + CHUNK]
        try:
            resp = httpx.get(
                SPARQL,
                params={"query": build_query(chunk), "format": "json"},
                headers={"User-Agent": UA},
                timeout=90,
            )
            resp.raise_for_status()
            rows = resp.json()["results"]["bindings"]
        except Exception as exc:
            print(f"chunk {i // CHUNK}: FAILED {exc}")
            time.sleep(5)
            continue

        # group candidate images per name, preferring citizenship matches
        by_name = {}
        for r in rows:
            label = r["label"]["value"]
            image = r["image"]["value"]
            citizen = r.get("citizenLabel", {}).get("value", "")
            by_name.setdefault(label, []).append((citizen, image))
        for label, candidates in by_name.items():
            key, nationality = wanted[label]
            target = COUNTRY_ALIASES.get(nationality, nationality)
            preferred = [img for cit, img in candidates if cit and target and cit == target]
            distinct_imgs = {img for _, img in candidates}
            if preferred:
                img = preferred[0]
            elif len(distinct_imgs) == 1:
                img = next(iter(distinct_imgs))
            else:
                ambiguous += 1
                continue  # several different people, none matching nationality — skip
            # normalize to a sized Commons thumbnail
            filename = img.rsplit("/", 1)[-1]
            found[key] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=640"
        print(f"chunk {i // CHUNK + 1}/{-(-len(names) // CHUNK)}: total resolved {len(found)}")
        time.sleep(1.5)

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(found, fh, ensure_ascii=False, indent=0, sort_keys=True)
    print(f"wrote {len(found)} photos → {OUT} (skipped {ambiguous} ambiguous)")


if __name__ == "__main__":
    main(refresh="--refresh" in sys.argv)
