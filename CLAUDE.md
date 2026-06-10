# Housing Element — Project Guide

Conversational **Real Estate Discovery** engine: home buyers search by ZIP code or natural-language
prompt and get localized climate/insurance risk profiles, insurance-viability warnings, and
natural-language safety evaluations from a hybrid ML/RAG backend.

**Current state — Step 1: the chat shell.** A Next.js chat UI talks to `/api/chat`, which returns
replies from a deterministic **mock** behind a swappable `LLMProvider` interface. The real model,
RAG, and the product's risk features come later. Built test-first. See `README.md` to run.

> Working in `apps/web`? Heed `apps/web/AGENTS.md`: this is Next.js **16**, newer than older training
> data. The full docs are bundled at `node_modules/next/dist/docs/` — consult them before writing
> Next-specific code (route handlers, config, etc.).

## Decisions made (step 1)

| Area      | Decision                                                                                     | Why                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Scope     | Chat shell only; defer ML/RAG                                                                | Get the conversational skeleton + plumbing right before any model work                                                                    |
| Backend   | Next.js `/api/chat` is the whole backend for now; Python deferred                            | Fewest moving parts; Python arrives later as its own service                                                                              |
| Repo      | npm-workspaces monorepo: `apps/web`, `services/ml` (placeholder), `packages/` reserved       | Structure is ready for the Python service + shared TS with no later migration                                                             |
| Framework | Next 16 App Router + TypeScript + Tailwind v4 + ESLint                                       | Modern stable defaults; Route Handler for the API, Client Component for the chat                                                          |
| LLM seam  | `LLMProvider` interface (`apps/web/src/lib/llm/types.ts`); only impl is a deterministic mock | Swapping in the real/fine-tuned model (or an HTTP call to `services/ml`) is a one-file change — UI, contract, and tests don't move        |
| Transport | Plain request/response JSON: `{ messages } → { reply }`; client-side history; no persistence | "Most basic"; the route is stateless and takes the full `messages[]` (the shape real LLM APIs expect); streaming is a contained later add |
| Testing   | TDD with Vitest + React Testing Library; tests colocated (`*.test.ts[x]`); no E2E yet        | Deterministic, offline, fast; covers provider, route, components, and the send→reply flow                                                 |
| Tooling   | Prettier (single quotes, 99-width); Next pinned exactly; `turbopack.root` pinned to repo     | Consistent style; no version drift; correct workspace boundary (avoids a stray `$HOME` lockfile)                                          |

## Conventions

- **TDD:** write the failing test first, then the code. Tests sit next to what they cover.
- **The seam is sacred:** all model access goes through `LLMProvider`. Don't call a model or
  `services/ml` directly from the route or UI — add or extend a provider implementation.
- **API contract is fixed:** `POST /api/chat` with `{ messages: [{ role, content }] }` → `{ reply }`.
  Keep it stable as the backend grows behind it.
- **Imports:** follow TS idiom (named imports) here — the global "import modules, not symbols" rule is
  Python-specific and unusable with JSX/React. Otherwise the global style guide applies (2-space,
  single quotes, ~99 char).

## Production-oriented decisions

- Stateless `/api/chat` that receives the whole conversation — horizontally scalable and already
  matches real chat-completion APIs, so the real model needs no contract change.
- Provider seam isolates the model; fine-tuning or swapping it never ripples into the UI or contract.
- Boundary validation on the route (400 on empty / missing / unparseable bodies); no defensive bloat
  elsewhere.
- Exact-pinned dependencies and a pinned `turbopack.root` for reproducible builds.
- Deterministic mock so the test suite runs offline, free, and reproducibly (CI-friendly).

## Not production-ready yet (intentional gaps)

- **Mock LLM** — replies just echo; no real intelligence.
- **No persistence** — conversation lives in client React state; a refresh clears it.
- **No auth, rate limiting, or abuse protection** on `/api/chat`.
- **No streaming** — the full reply is returned at once.
- **No observability** — no logging, metrics, or error reporting.
- **2 moderate npm advisories** unreviewed (run `npm audit`).
- **No CI, no E2E tests, no deployment config.**

## Still to implement (roadmap)

1. **`services/ml`** — Python/FastAPI ML-RAG service (`uv`, Python 3.13+, `pytest`).
2. **Real model behind `LLMProvider`** — the fine-tuned model, or an HTTP call to `services/ml`.
3. **RAG over hazard data** — wildfire, earthquake, insurance availability, water scarcity.
4. **Product features** — ZIP + descriptive search, localized risk profiles, insurance-viability
   warnings, natural-language safety evaluations.
5. **Streaming** responses (SSE) behind the same route.
6. **Persistence** — conversations / saved searches (+ a database choice).
7. **Auth** and per-user data.
8. **Rate limiting / API hardening.**
9. **Deployment** — web (e.g. Vercel) + the Python service; secret/key management for the model.
10. **CI** (test + lint + build) and **E2E** (Playwright) once the flows are richer.
