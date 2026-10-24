// Chat IPC contract shared by main, preload, and pages

export const CHAT_SEND = 'chat:send';
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
