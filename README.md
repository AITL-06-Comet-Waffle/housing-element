# Housing Element

Conversational **Real Estate Discovery** engine — helps home buyers understand localized
climate & insurance liabilities (wildfire, earthquake, insurance availability, water scarcity)
_before_ they buy, through a chat interface over a hybrid ML/RAG backend.

> **Status — Step 1 (scaffold):** a working chat shell. The frontend (Next.js / React) talks to
> an `/api/chat` route backed by a **deterministic mock LLM**. The real fine-tuned ML/RAG model
> and the Python service arrive in later steps. Built test-first (TDD).

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
```

## Architecture (step 1)

- **UI:** a `'use client'` chat component holds the conversation in React state (no persistence yet).
- **Transport:** `POST /api/chat` with `{ messages: [{ role, content }] }` → `{ reply }` (plain JSON).
- **LLM seam:** the route calls an `LLMProvider` interface; today the only implementation is a
  deterministic mock. Swapping in the real model (or a call to `services/ml`) is a one-file change
  that touches neither the UI nor the chat API shape.

## Testing

TDD with **Vitest + React Testing Library**. Tests live next to the code they cover
(`*.test.ts` / `*.test.tsx`).
