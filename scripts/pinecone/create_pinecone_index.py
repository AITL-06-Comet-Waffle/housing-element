import os
import time
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

api_key = os.environ["PINECONE_API_KEY"]
index_name = os.getenv("PINECONE_INDEX_NAME", "postfire-damage")

pc = Pinecone(api_key=api_key)

if not pc.has_index(index_name):
    pc.create_index_for_model(
        name=index_name,
        cloud="aws",
        region="us-east-1",
        embed={
            "model": "llama-text-embed-v2",
            "field_map": {"text": "chunk_text"},
        },
    )

    while not pc.describe_index(index_name).status["ready"]:
        print("Waiting for index to be ready...")
        time.sleep(5)

print(pc.describe_index(index_name))