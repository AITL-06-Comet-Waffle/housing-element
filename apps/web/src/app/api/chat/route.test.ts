import { describe, it, expect } from 'vitest';
import { POST } from './route';
import type { Message } from '@/lib/llm/types';

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  it('returns the mock reply for the latest user message', async () => {
    const messages: Message[] = [{ role: 'user', content: 'hi there' }];
    const res = await POST(postRequest({ messages }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ reply: 'You said: "hi there"' });
  });

  it('rejects an empty messages array with 400', async () => {
    const res = await POST(postRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects a body missing the messages field with 400', async () => {
    const res = await POST(postRequest({ not: 'messages' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unparseable body with 400', async () => {
    const res = await POST(
      new Request('http://localhost/api/chat', { method: 'POST', body: 'not json' }),
    );
    expect(res.status).toBe(400);
  });
});
