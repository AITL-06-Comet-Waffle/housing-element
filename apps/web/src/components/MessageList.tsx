import type { Message } from '@/lib/llm/types';

interface MessageListProps {
  messages: Message[];
}

/** Renders the conversation, with a hint shown before the first message. */
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <p role="status" className="text-gray-500">
        No messages yet. Ask about a ZIP code or describe an area to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {messages.map((message, index) => (
        <li
          key={index}
          data-role={message.role}
          className={
            message.role === 'user'
              ? 'max-w-[80%] self-end rounded bg-blue-600 px-3 py-2 text-white'
              : 'max-w-[80%] self-start rounded bg-gray-100 px-3 py-2 text-gray-900'
          }
        >
          {message.content}
        </li>
      ))}
    </ul>
  );
}
