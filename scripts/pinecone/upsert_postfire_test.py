import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "postfire-damage")
NAMESPACE = os.getenv("PINECONE_NAMESPACE", "calfire-dins-v1")
JSONL_PATH = Path("postfire_pinecone_records.jsonl")

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
index = pc.Index(INDEX_NAME)

records = []

with JSONL_PATH.open("r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i >= 10:
            break

        raw = json.loads(line)
        metadata = raw.get("metadata") or {}

        record = {
            "_id": raw["_id"],
            "chunk_text": raw["chunk_text"],
            **metadata,
        }

        record = {
            key: value
            for key, value in record.items()
            if value is not None
        }

        records.append(record)

index.upsert_records(namespace=NAMESPACE, records=records)

print(f"Upserted {len(records)} test records into namespace {NAMESPACE}")
print(index.describe_index_stats())