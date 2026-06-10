# services/ml — Python ML/RAG service (placeholder)

Reserved for the backend that will power the real product: localized climate & insurance risk
profiles via a hybrid ML/RAG pipeline (embeddings, vector search, an LLM, and later a fine-tuned
model).

**Not implemented yet.** In step 1 the chat experience is served entirely by `apps/web`
(`/api/chat`) against a deterministic mock LLM.

When this service lands it will likely be:

- **Framework:** FastAPI (async, good for model serving)
- **Tooling:** `uv` for env/deps, Python 3.13+
- **Tests:** `pytest`
- **Contract:** invoked by `apps/web` over HTTP, behind the existing `LLMProvider` seam — so
  bringing it online changes neither the frontend nor the chat API shape.

This directory lives inside the repo but **outside** the npm workspace graph (npm workspaces
manage only JS/TS packages); `uv` will own it independently.
