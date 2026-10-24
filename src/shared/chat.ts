// Chat IPC contract shared by main, preload, and pages

export const CHAT_SEND = 'chat:send';
export const CHAT_UPGRADE = 'chat:upgrade';
export const CHAT_TOKEN = 'chat:token';

export type Role = 'user' | 'assistant';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Category = 'chat' | 'writing' | 'code' | 'analysis' | 'design' | 'math';

export interface ChatMessage {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface SendMessageRequest {
  chatId: string;
  text: string;
  // Language the user wrote in (e.g. 'fr'); recorded so the dashboard can break usage down by language
  language?: string;
}

// Re-run an answer on the next model up. The UI has all of this from the earlier SendMessageResult.
export interface UpgradeMessageRequest {
  chatId: string;
  userMessageId: string;
  replyMessageId: string;
  fromModel: string;
  category: Category;
  difficulty: Difficulty;
  language?: string;
}

export interface UpgradeMessageResult {
  reply: ChatMessage;
  model: string;
  fromModel: string;
  usage: TokenUsage;
  costUsd: number;
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  reply: ChatMessage;
  model: string;
  difficulty: Difficulty;
  category: Category;
  usage: TokenUsage;
  // Reply cost plus the router's classifier call
  costUsd: number;
  // Set when the chat was summarized and continues in a fresh chat
  continuedInChatId?: string;
}

// Streamed to the UI while the reply is being generated
export interface TokenEvent {
  chatId: string;
  delta: string;
}
