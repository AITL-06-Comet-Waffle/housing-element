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

## Where the code is today vs. where it's going

**Today (on `main`) — a chat shell + a fire-only RAG layer that is being superseded:**

- Next 16 chat UI → `POST /api/chat` → `getProvider()` → `LLMProvider` (deterministic **mock** by
  default; **OpenAI** when `LLM_PROVIDER=openai`).
- With `RAG_ENABLED=true`, `getProvider()` wraps the provider in `RagProvider`: geocodes the last
  user message via Nominatim → county, vector-searches Pinecone (CAL FIRE DINS post-fire summaries)
  filtered by county, injects the hits as context. **Fire-only, county-level, historical.**
- A Postgres DB (`homebuyer_data`, port 5433) holds **parcel-level** CAL FIRE DINS inspections;
  `scripts/pinecone/` aggregate them to (incident, county, city) summaries for Pinecone.

**Target (the pivot) — per the plan:** address-*assessment*, not chat; *forward-looking* hazard
layers, not historical damage; *structured spatial lookups*, not vector search, for the risk numbers.

```
address (form)
  → Census geocode  → precision gate
  → PostGIS point-in-polygon (FHSZ / NFHL / USGS + Alquist-Priolo)   ← risk FACTS (tool-use)
  → [Pinecone DINS retrieval]                                        ← narrative COLOR (vector RAG)
  → LLM grounded narration                                           ← never invents numbers
  → POST /api/risk → { riskProfile, narrative, citations }
```

The current chat/RAG code is refactored (RAG → color-only) or parked (`/api/chat` → phase 1.5),
**not deleted**. See the plan for the migration.

## Key decisions (summary — full rationale in the plan)

- **Forward-looking risk**, not historical record; DINS demoted to supplementary color.
- **Structured-first hybrid:** PostGIS spatial joins are the source of truth for risk numbers;
  Pinecone is unstructured color; the LLM narrates. Vector search is *not* the primary retrieval.
- **Address-only input; assessment, not discovery.** Geocoding is critical-path — US **Census**
  geocoder (free), with a **mandatory precision gate**. ZIP / natural-language discovery deferred.
- **California-only**, **Tier-1 hazards** (fire / flood / quake). Insurance + water = phase 2.
- **Pre-ingest** hazard layers into **PostGIS** (offline Python ETL); query **Node-direct** behind a
  new **`RiskProvider`** seam. A runtime FastAPI `services/ml` is deferred until a model needs it.
- **Per-hazard native scales**, no fake composite. The LLM narrates computed values only.
- **The graded "AI element" = RAG + tool-use** (PostGIS facts + Pinecone color + LLM generation).
  No LLM fine-tuning; a DINS *structure-vulnerability* classifier is a phase-2 ML stretch.

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

- **The pivot is planned, not built.** Phases 0–5 are tracked tasks; see the plan. The risk features
  (PostGIS spine, `/api/risk`, Census geocode, precision gate, per-hazard cards) **do not exist yet**.
- Current code is fire-only, county-level, Nominatim-geocoded RAG over *historical* DINS data — the
  thing being replaced.
- No persistence, auth, rate limiting, streaming, observability, CI, E2E, or deployment config.
- `README.md` still describes the old chat-shell product and needs the same update (Phase 5).
- 2 moderate npm advisories unreviewed (`npm audit`).

## How we got here (history)

- **Step 1** — npm-workspaces monorepo; Next 16 chat UI; `LLMProvider` seam with a deterministic
  mock; `POST /api/chat` `{messages}→{reply}`; TDD throughout.
- **Step 2** — `OpenAIProvider` (injected client, offline-testable) selected via
  `getProvider()` / `LLM_PROVIDER`.
- **Fire RAG layer** — `RagProvider` + Pinecone DINS + Nominatim geocode (county-level); Postgres
  DINS + `scripts/pinecone/` aggregation. **Superseded by the plan above.**
