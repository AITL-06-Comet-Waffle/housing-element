# APR Housing Data Integration Guide & Next Steps

This document outlines the progress made in integrating the California Housing Element Annual Progress Report (APR) data into the application, adhering to the project's hybrid RAG architecture (Structured Facts in Postgres + Unstructured Color in Pinecone).

## Phase 1: Completed Work

1. **Data Aggregation & Feature Engineering (`scripts/ca_apr_data_exploration/explore_apr.py`)**
   - Merged the future development pipeline (Table A) with the active construction and affordability metrics (Table A2).
   - Generated a clean, unified dataset: `jurisdiction_housing_summary.csv` grouped by `JURIS_NAME` and `YEAR`.

2. **Structured Facts Ingestion (`scripts/ingest/apr_housing.py`)**
   - Defined the PostgreSQL schema (`scripts/ingest/sql/apr.sql`) with optimization indices for text-based lookups on the jurisdiction name.
   - Successfully loaded 4,012 aggregated rows into the `homebuyer_data` Postgres database under the `housing_apr_summary` table.

3. **Unstructured Narrative Extraction (`scripts/pinecone/process_notes.py`)**
   - Extracted 123,851 rows containing qualitative, "boots on the ground" city planner comments (`NOTES`) from the dataset.
   - Formatted these into a line-delimited JSONL payload (`scripts/pinecone/apr_notes.jsonl`) tagged with metadata (`JURIS_NAME`, `YEAR`, `PROJECT_NAME`).

4. **Data Visualization**
   - Discovered key statewide insights: massive growth in affordable housing permits (doubling since 2018) and steady year-over-year growth in completed units.

---

## Phase 2: Next Steps for Full Implementation

To fully surface this data to the end user in the web app, the following steps must be completed:

### 1. Execute the Pinecone Upsert
We have the JSONL payload, but it needs to be uploaded to the cloud database.
- **Action:** Write an upsert script (e.g., `scripts/pinecone/upsert_apr_to_pinecone.py`) that reads `apr_notes.jsonl`, generates text embeddings for the notes, and pushes them to the Pinecone index with their metadata.

### 2. Update the Backend Risk Provider (`lib/risk/`)
The app needs to pull the structured numbers from Postgres when an address is searched.
- **Action:** Create `lib/risk/hazards/housing.ts` to run a SQL `SELECT` query against the `housing_apr_summary` table, filtering by the `city` returned from the Census Geocoder.
- **Action:** Add this new lookup to the concurrent `Promise.all` in `lib/risk/risk-provider.ts` and update the `RiskProfile` TypeScript definitions.

### 3. Update the RAG Retriever (`lib/rag/`)
The LLM needs the qualitative notes to tell a compelling story about the neighborhood.
- **Action:** Update `lib/rag/build-color.ts` to perform an additional vector search in Pinecone using the city name, returning the top historical housing project notes to be injected into the LLM context.

### 4. Update the LLM System Prompt (`lib/llm/system-prompt.ts`)
The LLM must be instructed on how to talk about housing data.
- **Action:** Modify the prompt to instruct the narrator to discuss housing supply, affordability trends, and local development difficulties without hallucinating the hard numbers retrieved from Postgres.

### 5. Frontend UI Enhancements (`components/`)
The user needs a place to view these metrics.
- **Action:** Build a new `HousingMarketCard.tsx` (similar to the `HazardCard.tsx`) to display the structured Postgres numbers (e.g., "New Units Built Last Year", "Affordable vs Market Rate").

---

## Troubleshooting

### PostgreSQL Connection Refused
If you encounter a `Connection refused` error when running any of the ingestion scripts, it is likely because the Postgres Docker container is not running or is mapped to a different port.
- **Tip:** Run `docker ps` in your terminal to verify that the `homebuyer-pg` container is actively running and to check which port it is bound to (it should be `0.0.0.0:5433->5432/tcp`). If it is not running, start it using the instructions in the main README.
