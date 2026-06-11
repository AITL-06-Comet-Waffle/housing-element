import os

from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "postfire-damage")
NAMESPACE = os.getenv("PINECONE_NAMESPACE", "calfire-dins-summary-v1")

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
index = pc.Index(INDEX_NAME)

query = "Palisades fire damage summary in Los Angeles County"

results = index.search(
    namespace=NAMESPACE,
    query={
        "inputs": {"text": query},
        "top_k": 10,
        "filter": {
            "county": {"$eq": "Los Angeles"}
        },
    },
    fields=[
        "chunk_text",
        "incident_name",
        "county",
        "city",
        "incident_year",
        "inspection_count",
        "destroyed_count",
        "major_count",
        "minor_count",
        "no_damage_count",
    ],
)

for hit in results["result"]["hits"]:
    print("=" * 80)
    print("score:", hit["_score"])
    print("id:", hit["_id"])

    fields = hit.get("fields", {})
    print("incident:", fields.get("incident_name"))
    print("county:", fields.get("county"))
    print("city:", fields.get("city"))
    print("year:", fields.get("incident_year"))
    print("inspections:", fields.get("inspection_count"))
    print("destroyed:", fields.get("destroyed_count"))
    print("major:", fields.get("major_count"))
    print("minor:", fields.get("minor_count"))
    print("no damage:", fields.get("no_damage_count"))
    print()
    print(fields.get("chunk_text", "")[:1000])