import { mockLLMProvider } from '@/lib/llm/mock-provider';
import type { Message } from '@/lib/llm/types';

/**
 * Chat endpoint. Accepts the full conversation and returns the assistant's reply.
 *
 * Request body: `{ messages: Message[] }`
 * Response: `{ reply: string }` on success, `{ error: string }` with status 400 on
 * malformed input.
 *
 * The reply is produced by the {@link mockLLMProvider} seam in step 1; swapping in
 * the real model later does not change this contract.
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

  const reply = await mockLLMProvider.generate(messages as Message[]);
  return Response.json({ reply });
}
