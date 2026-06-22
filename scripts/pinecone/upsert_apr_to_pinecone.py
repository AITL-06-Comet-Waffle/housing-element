import hashlib
import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from pinecone import Pinecone
from tqdm import tqdm

load_dotenv()

# Example index configuration; you may want to set up specific env vars for APR.
INDEX_NAME = os.getenv("PINECONE_APR_INDEX_NAME", "housing-apr")
NAMESPACE = os.getenv("PINECONE_APR_NAMESPACE", "apr-notes-v1")
JSONL_PATH = Path(os.path.join(os.path.dirname(__file__), "apr_notes.jsonl"))

# Lower batch size to reduce tokens per request.
BATCH_SIZE = 24
SLEEP_SECONDS_BETWEEN_BATCHES = 1.5

def count_lines(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for _ in f)

def trim_text(text: str, max_chars: int = 900) -> str:
    if not text:
        return ""
    text = " ".join(text.split())
    return text[:max_chars]

def generate_id(text: str, juris: str, year: str) -> str:
    """Generate a unique ID based on the content and metadata."""
    content_hash = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    return f"apr_{juris.replace(' ', '_').lower()}_{year}_{content_hash}"

def iter_records(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            raw = json.loads(line)
            metadata = raw.get("metadata", {})
            text = trim_text(raw.get("text", ""))
            
            if not text:
                continue
                
            record_id = generate_id(text, metadata.get("JURIS_NAME", "unknown"), metadata.get("YEAR", "unknown"))

            record = {
                "_id": record_id,
                "chunk_text": text,
                **metadata,
            }

            record = {
                key: value
                for key, value in record.items()
                if value is not None and value != ""
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
    if not os.environ.get("PINECONE_API_KEY"):
        print("PINECONE_API_KEY not found in environment.")
        return

    if not JSONL_PATH.exists():
        print(f"JSONL file not found at {JSONL_PATH}")
        return

    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    
    # Check if index exists, else user needs to create it first
    if INDEX_NAME not in pc.list_indexes().names():
        print(f"Index '{INDEX_NAME}' does not exist in Pinecone.")
        print("Please create the index first before running this script.")
        return

    index = pc.Index(INDEX_NAME)

    total_records = count_lines(JSONL_PATH)
    total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"Index: {INDEX_NAME}")
    print(f"Namespace: {NAMESPACE}")
    print(f"Records: {total_records}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Batches: {total_batches}")
    print(f"Sleep between batches: {SLEEP_SECONDS_BETWEEN_BATCHES}s")

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
