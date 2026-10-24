// Shapes the UI expects from the backend over IPC. Move these to src/shared/types.ts once the backend team
// agrees on them.

export type LanguageCode = "en" | "es" | "pt" | "fr" | "ht" | "hi" | "ml";

/** Pass as the model to let the backend's router pick the cheapest model that can handle the message. */
export const AUTO_MODEL = "auto";

export interface Model {
  id: string;
  name: string;
  /** USD per million input tokens. */
  inputPrice: number;
  /** USD per million output tokens. */
  outputPrice: number;
}

export interface Usage {
  model: string;
  /** Total tokens with Optimaize, including the tokens spent translating and rewriting. */
  tokensWith: number;
  /** Tokens the same exchange would have used if sent as typed. */
  tokensWithout: number;
  costWith: number;
  costWithout: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  language: LanguageCode;
  /** User messages only, when translation was on: the English prompt that was actually sent to Claude. */
  sentAs?: string;
  /** Assistant messages only. */
  usage?: Usage;
  createdAt: number;
}

export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  /** Share of tokens saved across the whole chat, 0 to 1. */
  savedFraction: number;
}

export interface Chat extends ChatSummary {
  messages: Message[];
}

export interface Estimate {
  language: LanguageCode;
  tokensAsTyped: number;
  /** Tokens if translated through English, including the translation step itself. */
  tokensTranslated: number;
}

export interface LanguageStat {
  language: LanguageCode;
  messages: number;
  tokensWith: number;
  tokensWithout: number;
  /** Tokens in this language per token of the same content in English. */
  taxMultiplier: number;
}

export interface ModelStat {
  model: string;
  messages: number;
  tokensWith: number;
  tokensWithout: number;
}

export interface Stats {
  tokensWith: number;
  tokensWithout: number;
  costWith: number;
  costWithout: number;
  byLanguage: LanguageStat[];
  byModel: ModelStat[];
}

export interface Profile {
  name: string;
  plan: string;
  /** First entry is the user's main language (used for the greeting and starters). */
  languages: LanguageCode[];
  /**
   * Translate messages through English before sending (the team's `translateThroughEnglish`).
   * Off unless the user turns it on, because translating can change meaning.
   */
  translateByDefault: boolean;
  /** Open the "Sent as" disclosure on every message instead of keeping it collapsed. */
  showSentAs: boolean;
}

export interface SendMessageInput {
  /** Omit to start a new chat. */
  chatId?: string;
  text: string;
  /** Translate this message through English before sending it. */
  translate: boolean;
  /** A model id, or AUTO_MODEL. */
  model: string;
}
