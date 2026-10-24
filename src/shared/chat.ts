// Chat IPC contract shared by main, preload, and pages

export const CHAT_SEND = 'chat:send';

export type Role = 'user' | 'assistant';

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
  // Set when the user picks a specific model; skips routing entirely
  modelOverride?: string;
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  reply: ChatMessage;
  // The model that actually answered
  model: string;
  // ISO 639-1 code of the detected language, e.g. "fr"
  language: string;
  usage: TokenUsage;
  // 0 for free models
  costUsd: number;
}
