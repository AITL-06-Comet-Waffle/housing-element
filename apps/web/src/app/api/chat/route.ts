import { getProvider } from '@/lib/llm/get-provider';
import type { Message } from '@/lib/llm/types';

/**
 * Chat endpoint. Accepts the full conversation and returns the assistant's reply.
 *
 * Request body: `{ messages: Message[] }`
 * Response: `{ reply: string }` on success, `{ error: string }` with status 400 on
 * malformed input.
 *
 * The reply comes from whichever provider {@link getProvider} selects — the
 * deterministic mock by default, OpenAI when LLM_PROVIDER=openai. Both implement
 * the same seam, so this contract is unchanged regardless.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: 'Request body must include a non-empty "messages" array.' },
      { status: 400 },
    );
  }

  const reply = await getProvider().generate(messages as Message[]);
  return Response.json({ reply });
}
