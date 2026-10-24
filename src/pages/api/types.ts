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

/** File types the attach button accepts: images, PDFs and plain text. */
export const ACCEPTED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
];

/** Largest file the attach button accepts, in bytes (10 MB). The backend can refuse smaller ones if Claude does. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A file shown on a message: its name, type and size. */
export interface AttachedFile {
  name: string;
  /** MIME type, e.g. "image/png" or "application/pdf". */
  type: string;
  /** Size in bytes. */
  size: number;
}

/** A file going to the backend with a message. Carries the bytes because Electron's IPC can't send File objects. */
export interface Attachment extends AttachedFile {
  data: ArrayBuffer;
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
  /** User messages only: files sent with it. */
  files?: AttachedFile[];
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
  /** Files attached to this message (empty when none). The backend sends them to Claude with the prompt. */
  attachments: Attachment[];
}

/** Shortest password sign up accepts. The backend checks it too. */
export const MIN_PASSWORD_LENGTH = 8;

/** The logged-in person. The UI never sees passwords or session tokens; the backend keeps those. */
export interface User {
  /** The backend's id for this account. Also used to give each user fresh app data (App.tsx). */
  id: string;
  /** Shown in Settings under Account. */
  email: string;
}

export interface SignUpInput {
  /** Stored as the profile name, used for the greeting. */
  name: string;
  email: string;
  /** At least MIN_PASSWORD_LENGTH characters. The backend stores only a hash of it. */
  password: string;
}

export interface LogInInput {
  email: string;
  /** Checked against the stored hash by the backend. Never kept by the UI. */
  password: string;
}

/**
 * Why sign up or log in failed. Returned as a value rather than thrown, because a thrown error's details
 * don't survive Electron's IPC.
 */
export type AuthError = "invalid_email" | "weak_password" | "email_taken" | "wrong_credentials";

export type AuthResult = { ok: true; user: User } | { ok: false; error: AuthError };
