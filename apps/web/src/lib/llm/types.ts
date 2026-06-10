/** Who authored a turn in the conversation. */
export type ChatRole = 'user' | 'assistant';

/** A single turn in a chat conversation. */
export interface Message {
  role: ChatRole;
  content: string;
}

/**
 * The seam between the chat API and whatever produces replies.
 *
 * Step 1 ships a deterministic mock. The real fine-tuned model — or a call out to
 * the future Python ML service — will implement this same interface, so neither the
 * route nor the UI changes when it lands.
 */
export interface LLMProvider {
  /**
   * Produce an assistant reply for a conversation.
   *
   * @param messages Full conversation so far, oldest first.
   * @returns The assistant's reply text.
   */
  generate(messages: Message[]): Promise<string>;
}
