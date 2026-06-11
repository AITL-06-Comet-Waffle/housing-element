import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from pinecone import Pinecone
from tqdm import tqdm

load_dotenv()

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "postfire-damage")
NAMESPACE = os.getenv("PINECONE_NAMESPACE", "calfire-dins-summary-v1")
JSONL_PATH = Path("postfire_pinecone_aggregates.jsonl")

BATCH_SIZE = 96
SLEEP_SECONDS_BETWEEN_BATCHES = 0.5

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
index = pc.Index(INDEX_NAME)


def count_lines(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for _ in f)


def iter_records(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue

            raw = json.loads(line)
            metadata = raw.get("metadata") or {}

            record = {
                "_id": raw["_id"],
                "chunk_text": raw["chunk_text"],
                **metadata,
            }

            # Pinecone metadata cannot contain nulls.
            record = {
                key: value
                for key, value in record.items()
                if value is not None
            }

            yield record


def batched(iterator, batch_size):
    batch = []

    for item in iterator:
        batch.append(item)

        if len(batch) >= batch_size:
            yield batch
            batch = []

    if batch:
        yield batch


def main():
    if not JSONL_PATH.exists():
        raise FileNotFoundError(f"Could not find {JSONL_PATH}")

    total_records = count_lines(JSONL_PATH)
    total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"Index: {INDEX_NAME}")
    print(f"Namespace: {NAMESPACE}")
    print(f"JSONL: {JSONL_PATH}")
    print(f"Records: {total_records}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Batches: {total_batches}")

    for batch in tqdm(
        batched(iter_records(JSONL_PATH), BATCH_SIZE),
        total=total_batches,
    ):
        for attempt in range(1, 6):
            try:
                index.upsert_records(namespace=NAMESPACE, records=batch)
                break
            except Exception as exc:
                message = str(exc)

                if "RESOURCE_EXHAUSTED" in message or "429" in message:
                    wait_seconds = 30 * attempt
                    print(f"Rate limited. Waiting {wait_seconds}s before retry...")
                    time.sleep(wait_seconds)
                    continue

                if attempt == 5:
                    raise

                wait_seconds = 5 * attempt
                print(f"Upsert failed on attempt {attempt}: {exc}")
                print(f"Retrying in {wait_seconds}s...")
                time.sleep(wait_seconds)

        time.sleep(SLEEP_SECONDS_BETWEEN_BATCHES)

    print("Done.")
    print(index.describe_index_stats())


if __name__ == "__main__":
    main()