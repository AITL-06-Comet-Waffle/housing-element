import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';
import type { Message } from '@/lib/llm/types';

describe('MessageList', () => {
  it('shows an empty-state hint when there are no messages', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/no messages yet/i);
  });

  it('renders each message with its content and role', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Tell me about 90210' },
      { role: 'assistant', content: 'You said: "Tell me about 90210"' },
    ];
    render(<MessageList messages={messages} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Tell me about 90210');
    expect(items[0]).toHaveAttribute('data-role', 'user');
    expect(items[1]).toHaveAttribute('data-role', 'assistant');
  });
});
