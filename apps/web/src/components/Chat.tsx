'use client';

import { useState } from 'react';
import { ChatInput } from '@/components/ChatInput';
import { MessageList } from '@/components/MessageList';
import type { Message } from '@/lib/llm/types';

/** Top-level chat experience: holds the conversation in state and talks to /api/chat. */
export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(content: string) {
    const conversation: Message[] = [...messages, { role: 'user', content }];
    setMessages(conversation);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: conversation }),
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

      const { reply } = (await response.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MessageList messages={messages} />
      {isLoading && (
        <p role="status" className="text-gray-500">
          Thinking…
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
