// Condenses a long chat into a summary to seed a fresh context window.
import { randomUUID } from 'node:crypto';
import type { ChatMessage, Role, TokenUsage } from '../../shared/chat';
import type { Complete } from '../providers/anthropic';
import { CLASSIFIER_MODEL } from '../router/models';

export const MAX_CONTEXT_TOKENS = 20_000;

// Rough on purpose: non-English text costs more tokens per character, so assume 3 chars/token
export const estimateTokens = (messages: ChatMessage[]): number =>
  Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 3);

// Always English, whatever language the chat is in
const SYSTEM_PROMPT = `You condense a conversation so it can continue in a fresh chat.
Write the summary in the same language the user wrote in. Keep decisions, facts, names, numbers,
open questions and the user's preferences. Drop greetings and repetition. Reply with JSON only.`;

const SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};

export interface ContextDeps {
  messages: {
    getMessages(chatId: string): ChatMessage[];
    saveMessage(chatId: string, role: Role, content: string): ChatMessage;
  };
  complete: Complete;
  isEnabled: () => boolean;
  // Called with the summary call's own usage so it shows up as overhead
  onSummaryUsage: (call: { model: string; usage: TokenUsage }) => void;
  newChatId?: () => string;
  maxTokens?: number;
}

export function createContext(deps: ContextDeps) {
  const newChatId = deps.newChatId ?? randomUUID;
  const maxTokens = deps.maxTokens ?? MAX_CONTEXT_TOKENS;

  return {
    // Messages to send to the model. When the chat is too long it is summarized and the
    // conversation continues in a fresh chat seeded from the summary.
    async prepare(chatId: string): Promise<{ chatId: string; messages: ChatMessage[]; rolledOver: boolean }> {
      const messages = deps.messages.getMessages(chatId);
      if (!deps.isEnabled() || messages.length < 2 || estimateTokens(messages) <= maxTokens) {
        return { chatId, messages, rolledOver: false };
      }

      // The newest message is the one being answered; it carries over as is
      const latest = messages[messages.length - 1];
      const history = messages.slice(0, -1);
      const transcript = history.map((m) => `${m.role}: ${m.content}`).join('\n\n');

      try {
        const { json, usage } = await deps.complete({
          model: CLASSIFIER_MODEL,
          system: SYSTEM_PROMPT,
          user: transcript,
          schema: SCHEMA,
          maxTokens: 1024,
          timeoutMs: 30_000,
        });
        deps.onSummaryUsage({ model: CLASSIFIER_MODEL, usage });

        const summary = (json as { summary?: unknown } | null)?.summary;
        if (typeof summary !== 'string' || !summary.trim()) throw new Error('Empty summary');

        const freshId = newChatId();
        const seed = deps.messages.saveMessage(freshId, 'user', `Summary of our conversation so far:\n${summary}`);
        const carried = deps.messages.saveMessage(freshId, latest.role, latest.content);
        return { chatId: freshId, messages: [seed, carried], rolledOver: true };
      } catch {
        // A failed summary must never block the message: send the full history
        return { chatId, messages, rolledOver: false };
      }
    },
  };
}
