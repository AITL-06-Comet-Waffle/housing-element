"""One-off: list LA County fire DINS rows by destroyed count (diagnose retrieval)."""

import os

from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("apps/web/.env.local")

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
idx = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

res = idx.search(
    namespace=os.getenv("PINECONE_NAMESPACE"),
    query={
        "inputs": {"text": "wildfire structure damage in Los Angeles County"},
        "top_k": 100,
        "filter": {"county": {"$eq": "Los Angeles"}},
    },
    fields=["incident_name", "incident_year", "destroyed_count", "city"],
)
rows = [h["fields"] for h in res["result"]["hits"]]
print(f"hits: {len(rows)}")
rows.sort(key=lambda f: int(f.get("destroyed_count") or 0), reverse=True)
for f in rows:
    print(
        f"{f.get('incident_year')} | {str(f.get('incident_name')):<26} | "
        f"{str(f.get('city')):<22} | destroyed={f.get('destroyed_count')}"
    )
