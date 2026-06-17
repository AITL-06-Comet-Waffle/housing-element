# web — Housing Element (Next.js app)

The Next.js 16 frontend + API for the California address-risk assessment. See the
**[root README](../../README.md)** for what the project does and full local setup (database,
one-time hazard-data load, environment, and running).

```bash
npm run dev      # from the repo root (or: npm run dev -w web) → http://localhost:3000
```

Key paths:

- `src/app/api/risk/route.ts` — `POST { address }` → `{ riskProfile, narrative, citations }`
- `src/lib/{geocode,risk,llm,rag}` — geocoder, PostGIS hazard adapters, narration, Pinecone color
- `src/components/{AddressForm,RiskReport,HazardCard}.tsx` — the UI

Tests are colocated (`*.test.ts[x]`, Vitest) and run offline. **This is Next.js 16** — read
`AGENTS.md` before writing Next-specific code.
