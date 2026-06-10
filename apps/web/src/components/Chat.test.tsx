import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chat } from './Chat';

describe('Chat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the conversation and renders the assistant reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reply: 'You said: "hi"' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // The user's message appears immediately, the reply after the request resolves.
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(await screen.findByText('You said: "hi"')).toBeInTheDocument();

    // The full conversation was POSTed to the chat API.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('shows an error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
