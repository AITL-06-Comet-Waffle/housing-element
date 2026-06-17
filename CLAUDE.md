# Housing Element — Project Guide

**Forward-looking California address-risk assessment.** A home buyer enters a CA street address and
gets a per-hazard climate-risk profile — **wildfire, flood, earthquake** — each at its native scale,
as structured data plus a grounded natural-language safety evaluation. Risk numbers come from
authoritative geospatial layers (point-in-polygon); the LLM explains them and never invents them.

> **Plan-of-record: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).** Read it before
> building — it carries the full target architecture, the Q1–Q13 design decisions with rationale,
> and the phased build (tracked as tasks).

> Working in `apps/web`? Heed `apps/web/AGENTS.md`: this is Next.js **16**, newer than older training
> data. The full docs are bundled at `node_modules/next/dist/docs/` — consult them before writing
> Next-specific code (route handlers, config, etc.).

## Current state — the pivot is BUILT (phases 0–5)

The forward-looking address-risk assessment is live and tested; the old chat shell is parked (not
deleted).

```
address (form)
  → Census geocode (CA-only, first match)                              ← lib/geocode/census.ts
  → PostGIS point-in-polygon: FHSZ · NFHL · USGS PGA · Alquist-Priolo  ← risk FACTS (tool-use)
  → Pinecone × 3 (past fires/floods/quakes, distance-keyed)            ← historical COLOR (RAG)
  → LLM grounded narration (template fallback; never invents numbers)  ← lib/llm/narrate.ts
  → POST /api/risk → { ok, matched, riskProfile, narrative, citations }   (cached by address)
UI: AddressForm → RiskReport → 3 HazardCards + narrative + Sources (cards render even if the LLM fails).
```

- **PostGIS** (`homebuyer_data`, :5433) holds four hazard layers — `hazard_fhsz`, `hazard_flood`,
  `hazard_pga`, `hazard_ap_zones` — loaded by `scripts/ingest/*.py`, queried Node-direct behind the
  `RiskProvider` seam (`lib/risk/`).
- **Pinecone** (3 indexes: fire DINS / NOAA floods / USGS quakes) supplies historical color behind
  `RAG_ENABLED` (`lib/rag/hazard-color.ts`). Color is best-effort and never a risk rating.
- **Parked:** `app/api/chat/route.ts` + the chat `RagProvider` / `build-rag-provider` (reserved for a
  Phase-1.5 conversational mode). The risk path does not use them.
- See **`README.md`** for full local setup + run steps.

## Key decisions (summary — full rationale in the plan)

- **Forward-looking risk**, not historical record; DINS demoted to supplementary color.
- **Structured-first hybrid:** PostGIS spatial joins are the source of truth for risk numbers;
  Pinecone is unstructured color; the LLM narrates. Vector search is *not* the primary retrieval.
- **Address-only input; assessment, not discovery.** Geocoding is critical-path — US **Census**
  geocoder (free). *(As built: Census is TIGER street-interpolation with no rooftop/parcel tiers, so
  the "precision gate" reduced to match-count + CA membership — first CA match wins.)* ZIP /
  natural-language discovery deferred.
- **California-only**, **Tier-1 hazards** (fire / flood / quake). Insurance + water = phase 2.
- **Pre-ingest** hazard layers into **PostGIS** (offline Python ETL); query **Node-direct** behind a
  new **`RiskProvider`** seam. A runtime FastAPI `services/ml` is deferred until a model needs it.
- **Per-hazard native scales**, no fake composite. The LLM narrates computed values only.
- **The graded "AI element" = RAG + tool-use** (PostGIS facts + Pinecone color + LLM generation).
  *(As built: color spans all three hazards — fire DINS, NOAA floods, USGS quakes — not fire-only;
  Q13 still holds — flood/quake corpora are color, never a risk source.)* No LLM fine-tuning; a DINS
  *structure-vulnerability* classifier is a phase-2 ML stretch.

## Conventions

- **TDD:** failing test first, then code (Vitest + React Testing Library; tests colocated
  `*.test.ts[x]`). Mock-by-default so the suite runs offline, free, deterministic.
- **Seams are sacred:** all model access through **`LLMProvider`** (via `getProvider()`); all risk
  access through **`RiskProvider`**; the geocoder sits behind its own small interface (so free Census
  → Mapbox/Smarty later is a one-file swap). Don't call a model, the DB, or `services/ml` directly
  from the route or UI — add or extend a provider.
- **API contract (updated):** the new primary contract is **`POST /api/risk`** with `{ address }` →
  `{ riskProfile, narrative, citations }`. The values in `riskProfile` are authoritative and
  deterministic; the UI renders cards from them, so a slow/failed LLM **degrades gracefully**. *(The
  old "fixed `/api/chat` `{messages}→{reply}`" rule is superseded — `/api/chat` is parked for
  conversational follow-up in phase 1.5.)*
- **The LLM never invents risk values.** It explains codes (Zone AE, FHSZ Very High, PGA) and
  recommends next steps, grounded in the structured profile + retrieved color. Never fabricate
  scores, premiums, or statistics.
- **Secrets:** server-only env in `apps/web/.env.local` (gitignored): `LLM_PROVIDER`,
  `OPENAI_API_KEY`, `OPENAI_MODEL`, plus risk/RAG config (`PINECONE_*`, the DB URL). Never commit a
  key; tests always use the mock. No `NEXT_PUBLIC_` for secrets.
- **Stack:** npm-workspaces monorepo (`apps/web`, `services/ml` placeholder, `packages/` reserved);
  Next 16 App Router + TS + Tailwind v4; Prettier (single quotes, 99-width); deps exact-pinned;
  `turbopack.root` pinned to repo.
- **Imports:** TS idiom (named imports) here — the global "import modules, not symbols" rule is
  Python-specific. Otherwise the global style guide applies (2-space, single quotes, ~99 char).
- **Data/ETL is Python**, run by a human (`uv`, Python 3.13+): `scripts/ingest/` loads CA hazard
  layers into PostGIS; `scripts/pinecone/` build the DINS color corpus. These touch the network and
  the DB — never run them from tests.

## Status & gaps

- **Built & tested (phases 0–5):** Census geocode, PostGIS spine + four hazard layers, `RiskProvider`,
  `POST /api/risk`, LLM narration (+ deterministic template fallback), 3-corpus Pinecone color +
  citations, per-hazard cards, and per-address caching. Vitest suite green; `tsc` + ESLint clean;
  `next build` passes.
- **Docs:** `README.md` rewritten with full local setup/run; this guide updated. The plan-of-record is
  now historical — its Q5 precision gate + Q13 fire-only color were simplified/extended (see above).
- **Deferred:** auth, rate limiting, streaming, observability, CI, E2E, deployment; insurance + water
  hazards; a DINS structure-vulnerability ML model; a runtime FastAPI `services/ml`; national coverage;
  ZIP / NL discovery; Phase-1.5 conversational follow-up.
- 2 moderate npm advisories unreviewed (`npm audit`).

## How we got here (history)

- **Step 1** — npm-workspaces monorepo; Next 16 chat UI; `LLMProvider` seam with a deterministic
  mock; `POST /api/chat` `{messages}→{reply}`; TDD throughout.
- **Step 2** — `OpenAIProvider` (injected client, offline-testable) selected via
  `getProvider()` / `LLM_PROVIDER`.
- **Fire RAG layer** — `RagProvider` + Pinecone DINS + Nominatim geocode (county-level); Postgres
  DINS + `scripts/pinecone/` aggregation. **Now parked** (legacy `/api/chat`).
- **The pivot (phases 0–4)** — PostGIS hazard spine + Census geocode + `RiskProvider` + `/api/risk`
  (fire, then +flood/quake) → LLM grounded narration → 3-corpus Pinecone color + citations. Built
  test-first; data loaded into a local PostGIS container.
- **Phase 5** — per-address caching, formally parked `/api/chat`, and truth-in-docs (README + this
  guide rewritten).
