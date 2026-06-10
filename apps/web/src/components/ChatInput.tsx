'use client';

import { useState, type FormEvent } from 'react';

interface ChatInputProps {
  /** Called with the trimmed, non-empty message text when the user submits. */
  onSend: (text: string) => void;
  /** When true, the field and button are disabled (e.g. while a reply is in flight). */
  disabled?: boolean;
}

/** Text field + send button. Submits trimmed, non-empty messages and clears itself. */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        placeholder="Ask about a ZIP code or describe an area…"
        aria-label="Message"
        className="flex-1 rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
