# Housing Element

Conversational **Real Estate Discovery** engine — helps home buyers understand localized
climate & insurance liabilities (wildfire, earthquake, insurance availability, water scarcity)
_before_ they buy, through a chat interface over a hybrid ML/RAG backend.

> **Status — Steps 1–2:** a working chat shell that can talk to a real LLM. The frontend
> (Next.js / React) calls an `/api/chat` route which, behind an `LLMProvider` seam, uses a
> **deterministic mock by default** or **OpenAI** when `LLM_PROVIDER=openai`. The fine-tuned
> ML/RAG model and the Python service arrive in later steps. Built test-first (TDD).

## Layout

```
apps/web        Next.js app (React UI + /api/chat route) — the only runnable service today
services/ml     Placeholder for the future Python (FastAPI) ML/RAG service
packages        Reserved for shared TypeScript packages
```

## Prerequisites

- Node 20+ (developed on 25.x) and npm 10+

## Commands (run from the repo root)

```bash
npm install        # install all workspaces
npm test           # run the web test suite (Vitest) once
npm run test:watch # watch mode
npm run dev        # start the dev server (http://localhost:3000)
npm run lint       # eslint
npm run build      # production build
npm run format     # prettier
```

## Enabling the real LLM (OpenAI)

By default the app uses an offline **mock** (no key, no cost). To talk to OpenAI instead:

```bash
cp apps/web/.env.example apps/web/.env.local
# then edit apps/web/.env.local:
#   LLM_PROVIDER=openai
#   OPENAI_API_KEY=sk-...      # your key — .env.local is gitignored, never commit it
#   OPENAI_MODEL=gpt-4o-mini   # optional; any chat model your account can access
npm run dev
```

Tests always use the mock, so the suite stays offline and deterministic regardless of these settings.

## Architecture

- **UI:** a `'use client'` chat component holds the conversation in React state (no persistence yet).
- **Transport:** `POST /api/chat` with `{ messages: [{ role, content }] }` → `{ reply }` (plain JSON).
- **LLM seam:** the route calls `getProvider()`, which returns an `LLMProvider` — the deterministic
  mock by default, or an OpenAI-backed provider when `LLM_PROVIDER=openai`. Adding another provider
  (the fine-tuned model, or a call to `services/ml`) is a one-file change that touches neither the UI
  nor the chat API shape.

## Testing

TDD with **Vitest + React Testing Library**. Tests live next to the code they cover
(`*.test.ts` / `*.test.tsx`).
