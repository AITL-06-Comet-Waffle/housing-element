# Housing Element — California Address Risk Assessment

Enter a California street address and get a **forward-looking, per-hazard climate-risk
profile** — **wildfire, flood, earthquake** — each at its native scale, as structured data
plus a grounded, plain-English safety evaluation.

Risk ratings come from authoritative geospatial layers via point-in-polygon queries (the LLM
never invents a number); a language model explains them and recommends next steps, optionally
weaving in **real historical events** — past fires, floods, and quakes near the address —
retrieved from a vector store, with source citations.

**Example** — a Malibu address returns:

- **Wildfire:** Very High (CAL FIRE FHSZ)
- **Flood:** Minimal — Zone X (FEMA NFHL)
- **Earthquake:** ≥ 0.6 g peak ground acceleration; not in an Alquist-Priolo fault zone
- a grounded narrative (noting, e.g., the 2025 Palisades fire nearby) + a Sources list

## How it works

```
address ─▶ US Census geocode ─▶ PostGIS point-in-polygon              ← the risk FACTS (tool-use)
                                 (FHSZ · NFHL · USGS PGA · Alquist-Priolo)
                             └─▶ Pinecone × 3 (past fires/floods/quakes)  ← historical COLOR (RAG)
                             └─▶ LLM narration (explains codes, never invents numbers)
        ─▶ POST /api/risk ─▶ { riskProfile, narrative, citations }
UI renders per-hazard cards from riskProfile (degrades gracefully if the LLM call fails).
```

The graded **AI element = RAG + tool-use + LLM**: PostGIS spatial joins are the authoritative
source of every risk value (tool-use); Pinecone supplies unstructured historical color (RAG);
the LLM narrates — grounded, never fabricating a rating.

## Prerequisites

- **Node 20+** and **npm 10+**
- **Docker** — runs the PostGIS database
- **[uv](https://docs.astral.sh/uv/)** (Python 3.13+) — runs the one-time hazard-data load
- _Optional:_ an **OpenAI API key** — richer LLM narration (without it, a deterministic
  grounded template narrative is used)
- _Optional:_ a **Pinecone** account with three hazard indexes — historical color (without it,
  the assessment + narration still work, just without cited past events)

## Quick start (run locally)

Run everything from the repo root.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

The defaults run a fully local app (mock narration, no color); `DATABASE_URL` already points at
the database you start in step 3. See [Optional features](#optional-features) to turn on OpenAI
narration and Pinecone color.

### 3. Start the PostGIS database (Docker)

```bash
docker run -d --name homebuyer-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=homebuyer_data \
  -p 5433:5432 postgis/postgis:16-3.4

# wait until it accepts connections (a few seconds; longer on first image pull)
until docker exec homebuyer-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
```

Later: `docker stop homebuyer-pg` / `docker start homebuyer-pg`. (On Apple Silicon the image
runs under emulation — slightly slower first boot, otherwise fine.)

### 4. Load the hazard layers into PostGIS (one-time)

These scripts download public data (CAL FIRE, FEMA, USGS) and write it to the database. Each
prints a row count and a known-point sanity check on success. Flood is the heaviest (~120k CA
polygons — a few minutes).

```bash
UVDEPS="--with geopandas --with sqlalchemy --with geoalchemy2 --with psycopg2-binary --with requests --with python-dotenv"

uv run $UVDEPS python scripts/ingest/fire_fhsz.py    # wildfire — CAL FIRE FHSZ (SRA + LRA)
uv run $UVDEPS python scripts/ingest/flood_nfhl.py   # flood — FEMA NFHL  (heaviest)
uv run $UVDEPS python scripts/ingest/quake_ap.py     # fault rupture — CGS Alquist-Priolo
uv run $UVDEPS python scripts/ingest/quake_pga.py    # ground shaking — USGS PGA grid
```

### 5. Run the app

```bash
npm run dev
```

Open **http://localhost:3000** and enter a California street address — e.g.
`6295 Skyway, Paradise, CA 95969` or `23000 Pacific Coast Hwy, Malibu, CA 90265`.

## Optional features

**OpenAI narration** — in `apps/web/.env.local`:

```ini
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...        # .env.local is gitignored — never commit a key
OPENAI_MODEL=gpt-4o-mini     # optional
```

Without this, the narrative is a deterministic, grounded template built from the risk values.

**Historical color (Pinecone RAG)** — needs three Pinecone indexes of past CA events (fire =
CAL FIRE DINS, flood = NOAA Storm Events, quake = USGS ComCat). In `apps/web/.env.local`:

```ini
RAG_ENABLED=true
PINECONE_API_KEY=...
# plus the six index/namespace vars in .env.example, pointing at your indexes
```

Without this, the assessment + narration still work; the narrative just won't cite nearby
historical events. (The fire index can be built/inspected from `scripts/pinecone/`.)

## Testing & quality

```bash
npm test         # Vitest — fully offline (mocked DB + network), deterministic
npm run lint     # eslint
npm run build    # production build (also type-checks)
```

Tests never touch the database, the network, or a real LLM, so the suite is deterministic and
runs without any of the setup above.

## Project structure

```
apps/web/src/
  app/api/risk/route.ts     POST { address } → { riskProfile, narrative, citations }
  lib/geocode/census.ts     address → point (US Census geocoder, CA-only)
  lib/risk/                 types, pg pool, RiskProvider, hazard adapters (fire/flood/quake)
  lib/llm/                  narration (deterministic template + OpenAI), system prompt
  lib/rag/                  Pinecone historical color + county lookup
  lib/risk/citations.ts     structured-layer provenance + retrieved sources
  components/               AddressForm · RiskReport · HazardCard
scripts/ingest/             Python ETL — load hazard layers into PostGIS (run by hand)
scripts/pinecone/           build / inspect the Pinecone color corpora
services/ml/                placeholder for a future runtime ML service
```

## Data sources

| Hazard | Risk rating (PostGIS) | Historical color (Pinecone) |
| --- | --- | --- |
| Wildfire | CAL FIRE Fire Hazard Severity Zones (SRA + LRA) | CAL FIRE DINS post-fire damage |
| Flood | FEMA National Flood Hazard Layer | NOAA Storm Events |
| Earthquake | USGS PGA (2% in 50 yr) + CGS Alquist-Priolo zones | USGS ComCat historical events |

Geocoding: US Census Geocoder (no key). All risk values are mapped, forward-looking ratings —
confirm with the seller's natural-hazard disclosure, a flood-insurance quote, and a licensed
inspector before purchase.

## Status

California-only, Tier-1 hazards (fire / flood / quake). The structured assessment, grounded
narration, and RAG color are complete and tested. The legacy `/api/chat` chat shell is **parked**
(kept for a future conversational mode, not deleted). Deferred: result caching, insurance /
water-scarcity hazards, a DINS structure-vulnerability ML model, and national coverage.
