"""Read-only inspection of the fire / flood / earthquake hazard Pinecone indexes.

Prints each index's namespace stats, a sample record's full metadata keys (via
fetch), and a text-search sample — so we can design location-keyed color retrieval.
Read-only; safe to run.

  uv run --with pinecone --with python-dotenv python scripts/pinecone/inspect_indexes.py
"""

import os

from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("apps/web/.env.local")  # secrets live in the web app's env file

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])

TARGETS = [
    ("FIRE", os.getenv("PINECONE_INDEX_NAME"), os.getenv("PINECONE_NAMESPACE"), "wildfire structure damage"),
    ("FLOOD", os.getenv("PINECONE_FLOOD_INDEX_NAME"), os.getenv("PINECONE_FLOOD_NAMESPACE"), "flood damage"),
    ("EARTHQUAKE", os.getenv("PINECONE_EARTHQUAKE_INDEX_NAME"), os.getenv("PINECONE_EARTHQUAKE_NAMESPACE"), "earthquake damage"),
]


def as_dict(obj):
    if isinstance(obj, dict):
        return obj
    return getattr(obj, "__dict__", {}) or {}


for label, name, ns, term in TARGETS:
    print("\n" + "=" * 72)
    print(f"{label}: index={name!r} namespace={ns!r}")
    if not name:
        print("  (env var not set — skipping)")
        continue

    index = pc.Index(name)

    try:
        stats = index.describe_index_stats()
        sd = as_dict(stats) or stats
        print("  dimension:", getattr(stats, "dimension", sd.get("dimension") if isinstance(sd, dict) else None))
        nss = getattr(stats, "namespaces", None) or (sd.get("namespaces") if isinstance(sd, dict) else None)
        print("  namespaces:", {k: as_dict(v) for k, v in (nss or {}).items()})
    except Exception as e:
        print("  stats error:", repr(e))

    # Full metadata via list + fetch (reveals all fields regardless of names).
    try:
        page = index.list_paginated(namespace=ns, limit=3)
        raw = getattr(page, "vectors", None) or []
        ids = [getattr(v, "id", None) or (v.get("id") if isinstance(v, dict) else v) for v in raw]
        print("  sample ids:", ids)
        if ids:
            fetched = index.fetch(ids=[i for i in ids if i], namespace=ns)
            vectors = getattr(fetched, "vectors", None) or (fetched.get("vectors") if isinstance(fetched, dict) else {}) or {}
            for vid, rec in list(vectors.items())[:2]:
                md = getattr(rec, "metadata", None) or (rec.get("metadata") if isinstance(rec, dict) else {}) or {}
                print(f"  fetch id={vid}")
                print("    metadata keys:", list(md.keys()))
                print("    metadata:", {k: str(v)[:100] for k, v in list(md.items())[:16]})
    except Exception as e:
        print("  list/fetch error:", repr(e))

    # Text search (confirms integrated embeddings + shows scored content).
    try:
        res = index.search(namespace=ns, query={"inputs": {"text": term}, "top_k": 2})
        hits = res["result"]["hits"]
        print(f"  search('{term}') -> {len(hits)} hits")
        for h in hits:
            fields = h.get("fields", {})
            text = fields.get("chunk_text") or fields.get("text") or ""
            print(f"    id={h['_id']} score={h.get('_score')}")
            print("    field keys:", list(fields.keys()))
            print("    text:", text[:260].replace("\n", " "))
    except Exception as e:
        print("  search error:", repr(e))
