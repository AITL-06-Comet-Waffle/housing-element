"""Debug: geocode a Malibu address, run the real fire-color query, show candidates by distance."""

import math
import os

import requests
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("apps/web/.env.local")

ADDR = "23000 Pacific Coast Hwy, Malibu, CA 90265"
r = requests.get(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    params={"address": ADDR, "benchmark": "Public_AR_Current", "format": "json"},
    timeout=30,
)
m = r.json()["result"]["addressMatches"][0]
lat, lon = float(m["coordinates"]["y"]), float(m["coordinates"]["x"])
print(f"point: {lat}, {lon} | matched: {m['matchedAddress']}")


def hav(a_lat, a_lon, b_lat, b_lon):
    tr = math.radians
    dla, dlo = tr(b_lat - a_lat), tr(b_lon - a_lon)
    s = math.sin(dla / 2) ** 2 + math.cos(tr(a_lat)) * math.cos(tr(b_lat)) * math.sin(dlo / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(s))


pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
idx = pc.Index(os.getenv("PINECONE_INDEX_NAME"))
res = idx.search(
    namespace=os.getenv("PINECONE_NAMESPACE"),
    query={
        "inputs": {"text": f"wildfire structure damage near {m['matchedAddress']}"},
        "top_k": 50,
        "filter": {"county": {"$eq": "Los Angeles"}},
    },
    fields=["incident_name", "city", "incident_year", "destroyed_count", "latitude", "longitude"],
)
rows = [h["fields"] for h in res["result"]["hits"]]
print(f"candidates: {len(rows)}")
withd = []
for f in rows:
    try:
        d = hav(lat, lon, float(f.get("latitude")), float(f.get("longitude")))
    except (TypeError, ValueError):
        d = float("inf")
    withd.append((d, f))
withd.sort(key=lambda x: x[0])
for d, f in withd[:25]:
    print(
        f"{d:6.1f} km | {f.get('incident_year')} | {str(f.get('incident_name')):<14} | "
        f"{str(f.get('city')):<18} | destroyed={f.get('destroyed_count')}"
    )
print("PALISADES in candidates?", any(str(f.get("incident_name")).startswith("Palisades") for f in rows))
