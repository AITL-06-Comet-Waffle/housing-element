# Implementation Plan — CA Address-Risk Assessment

> Plan-of-record for pivoting Housing Element from a fire-only, county-level RAG chat shell
> to a **California address-risk assessment** tool: enter an address, get a forward-looking,
> per-hazard climate-risk profile (structured data + a natural-language evaluation).
>
> Derived from a design interview (the "grill"). Decisions and their rationale are summarized
> below; the phased build follows.

## What this is (MVP scope)

A buyer enters a **California street address** and receives a **forward-looking risk profile** for
three hazards — **wildfire, flood, earthquake** — each at its native scale, plus a grounded
natural-language safety evaluation. No composite score, no fabricated numbers.

**Out of scope for the MVP** (deferred — see end): insurance-viability + water scarcity hazards,
ZIP / natural-language *discovery* search, conversational follow-up, a trained ML model, a runtime
Python service, national coverage.

## Architecture

```
address (form)
  → Census geocode  → precision gate  (Q5: only rooftop/parcel → full answer)
  → PostGIS point-in-polygon  (FHSZ / NFHL / USGS + Alquist-Priolo)   ← the risk FACTS (tool-use)
  → [Pinecone DINS retrieval]                                          ← narrative COLOR (vector RAG)
  → LLM grounded narration                                             ← never invents numbers
  → { riskProfile, narrative, citations }
UI renders per-hazard cards from riskProfile (graceful degradation if the LLM call fails).
```

**Two retrieval modes, distinct jobs (Q2, Q13):**
- **Structured / tool-use → the facts.** PostGIS spatial joins against authoritative layers are the
  single source of truth for every risk value. Deterministic and unit-testable.
- **Vector RAG (Pinecone) → color.** Retrieves unstructured DINS post-fire narrative as supplementary
  context for the LLM. **Never** the source of a rating.
- **LLM → grounded generation.** Narrates the structured facts + woven-in color; hard numbers always
  come from the structured side. This RAG + tool-use pipeline is the graded "AI element."

**Seams (sacred):** all model access behind `LLMProvider`; all risk access behind a new
`RiskProvider`. The geocoder sits behind its own small interface so the free Census provider can be
swapped for Mapbox/Smarty later without ripples.

## Decisions ledger (the "why")

| # | Decision |
|---|---|
| 1 | Product answers **forward-looking risk**, not historical record. DINS demoted to supplementary. |
| 2 | **Structured-first hybrid:** PostGIS = quantitative spine; Pinecone = unstructured color; LLM = narrator. Vector search is *not* the primary retrieval. |
| 3–4 | **Address-only input; assessment, not discovery.** ZIP/NL discovery deferred. Geocoding is critical-path. |
| 5 | **US Census Geocoder** (free, no key, returns census geographies); **mandatory precision gate**. Provider swappable behind a seam. `extractAddress` regex retired. |
| 6 | **California-only** (best layers — FHSZ, CA DOI — are CA-specific; CA is the strongest demo for all hazards). |
| 7 | **Tier-1 MVP = wildfire (FHSZ) + flood (NFHL) + earthquake (USGS PGA + Alquist-Priolo).** Insurance + water = phase 2. |
| 8 | **Pre-ingest layers into PostGIS** (offline Python ETL); not live upstream APIs (layers are ~static; reliability/latency/testability win). |
| 9 | **Node-direct runtime** behind a `RiskProvider` seam; Python offline-only for ingest; FastAPI `services/ml` deferred until ML needs it (one-file swap thanks to the seam). |
| 10 | **Per-hazard native scales** (no fake composite; optional transparent worst-driven rollup). **LLM narrates computed values only — never invents/adjusts numbers.** |
| 11 | **Pivot to address-form → risk-report** via new **`POST /api/risk`** → `{ riskProfile, narrative, citations }`. Cards render from structured data → **graceful degradation** if the LLM fails. `/api/chat` demoted to phase-1.5 follow-up. |
| 12 | **No LLM fine-tuning.** DINS structure-vulnerability classifier (`fire risk ≈ FHSZ zone hazard × structure vulnerability`) = phase-2 ML stretch. |
| 13 | **AI element = RAG + tool-use** (PostGIS facts + Pinecone color + LLM generation). DINS = primary RAG corpus. Flood/quake embeddings are *not* used to determine risk (redundant with structured layers). |

## Pre-reqs & conventions

**Dependencies to add**
- Node (`apps/web`): `pg` + `@types/pg`. (`@pinecone-database/pinecone` already present.)
- Python (`scripts/ingest/`): `geopandas`, `psycopg2-binary`, `shapely`, `requests` (`python-dotenv`
  already used). `GDAL/ogr2ogr` as the loader. Managed with `uv`.

**Infra:** the `homebuyer_data` Postgres (port 5433) already exists. Enable extensions:
`CREATE EXTENSION postgis; CREATE EXTENSION postgis_raster;`

**Conventions:** TDD with tests colocated (`*.test.ts[x]`); mock-by-default so the suite runs offline;
secrets in `apps/web/.env.local` (never committed). The stateful ETL/DB scripts are run by a human
(network + creds + large downloads), not in tests.

**Testing geospatial code:** unit-test adapters by mocking `pg` results (fast, offline, deterministic);
add a thin integration suite against a real PostGIS (docker) that validates the actual SQL on a handful
of known points. Bulk stays offline; SQL is verified separately.

---

## Phase 0 — Data foundation (fire only)
Prove the ingest → query pipeline on one layer before touching the app.
1. Enable PostGIS on `homebuyer_data`.
2. `scripts/ingest/fire_fhsz.py`: download CA **FHSZ** (CAL FIRE / CGS) → table
   `hazard_fhsz(hazard_class text, geom geometry(MultiPolygon,4326))` + `GIST(geom)` index.
3. Verify by hand:
   ```sql
   SELECT hazard_class FROM hazard_fhsz
   WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(:lon,:lat),4326)) LIMIT 1;
   ```
**Milestone:** a known CA lat/lon returns its fire zone from SQL.

## Phase 1 — Fire risk end-to-end (the spine slice)
One hazard, address → card. Proves geocode + PostGIS + seam + UI together (highest-risk slice).
- `lib/risk/types.ts` — `GeoPoint`, `MatchPrecision`, `FireRisk`, `RiskProfile`.
- `lib/risk/db.ts` — `pg` Pool.
- `lib/risk/hazards/fire.ts` — `getFireZone(point) → FireRisk` (`ST_Contains`).
- `lib/geocode/census.ts` — `geocode(address) → GeocodeResult` + precision gate.
- `lib/risk/risk-provider.ts` — `RiskProvider.assess(point) → RiskProfile`.
- `app/api/risk/route.ts` — `POST {address} → {riskProfile}` (no narrative yet).
- `components/{AddressForm,RiskReport,HazardCard}.tsx`.

Seam type sketch:
```ts
type GeocodeResult =
  | { ok: true; point: GeoPoint; precision: MatchPrecision; matched: string }
  | { ok: false; reason: 'no_match' | 'ambiguous' | 'too_coarse'; candidates?: string[] };
```
**Precision gate (Q5):** branch on Census's match type / single-vs-multiple matches — only
`rooftop|parcel` → full answer; `interpolated|centroid` → caveated; multiple → ask to refine.
**Tests:** geocode (mocked `fetch`), fire adapter (mocked `pg`), route (mocked geocode+risk), `HazardCard`.
**Milestone:** type a CA address → see its fire zone in the UI.

## Phase 2 — Add flood + earthquake
1. Ingest **NFHL** (CA extract → `hazard_flood`), **USGS PGA** (raster → `hazard_pga`, query via
   `ST_Value`), **Alquist-Priolo** (→ `hazard_ap_zones`).
2. `hazards/flood.ts`, `hazards/quake.ts`; extend `RiskProfile` + `RiskProvider` to all three;
   UI renders three cards.
**Tests:** one adapter test per hazard (known points) + extended route.
**Milestone:** full Tier-1 structured profile for any CA address.

## Phase 3 — LLM grounded narration
1. Rewrite `lib/llm/system-prompt.ts` → strict *narrator-over-facts* (explain codes like Zone AE /
   FHSZ Very High / PGA; never invent or adjust numbers; recommend next steps).
2. Narration step in the route: `RiskProfile` → `LLMProvider` → `narrative`. Response →
   `{ riskProfile, narrative }`.
3. **Graceful degradation (Q11):** narration in try/catch — on failure still return `riskProfile`;
   UI shows cards without prose.
**Tests:** deterministic mock narration; route returns both; degradation path.
**Milestone:** structured cards + natural-language safety evaluation.

## Phase 4 — Pinecone RAG color + citations (the graded AI element)
1. Refactor `lib/rag/` → **color-only** retrieval over **DINS**, keyed by location; returns narrative
   snippets (drop county-filter-as-spine).
2. Wire between risk and narration; inject as LLM context (Q13: color, not risk source).
3. `{ citations }`: structured-layer provenance (FHSZ version, FEMA panel, USGS model year) + DINS sources.
**Tests:** color retriever (mocked Pinecone); narration consumes color; citations present.
**Milestone:** RAG + tool-use pipeline complete — the AI element, demonstrable end-to-end.

## Phase 5 — Hardening & truth-in-docs
- Cache geocode + profile by normalized address (data is static — cheap win).
- Precision-gate UX (refine prompt / candidate picker).
- **Rewrite CLAUDE.md + README** to match (forward-looking, address-only assessment, `/api/risk`,
  structured-first, CA / Tier-1).
- Park `/api/chat` + chat-`RagProvider` (keep for 1.5; don't delete).

---

## Target file tree (new / changed)
```
apps/web/src/
  lib/risk/{types,db,risk-provider}.ts
  lib/risk/hazards/{fire,flood,quake}.ts
  lib/geocode/census.ts                 (replaces lib/rag/geocode.ts)
  lib/rag/*                             (refactored → color-only)
  lib/llm/system-prompt.ts              (rewritten)
  app/api/risk/route.ts                 (new primary)
  app/api/chat/route.ts                 (parked → phase 1.5)
  components/{AddressForm,RiskReport,HazardCard}.tsx
scripts/ingest/{fire_fhsz,flood_nfhl,quake_usgs,quake_ap}.py
```

## Deferred

- **Phase 1.5:** conversational follow-up (chat with the risk profile as context), reusing `LLMProvider`.
- **Phase 2:** insurance-viability + water scarcity hazards (ZIP/county-level + explicit caveats);
  DINS **structure-vulnerability ML model** (`damage ~ structure attributes + zone`); national
  expansion; FastAPI `services/ml` once a runtime model justifies it; ZIP/NL discovery + ranking.
