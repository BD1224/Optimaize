// The backend API the UI calls (through window.api in the Electron app). Same names and
// shapes as the in-memory mock in src/pages/api/mock.ts, so only api/client.ts decides which is used.
import type {
  Chat,
  ChatSummary,
  Estimate,
  Model,
  Profile,
  SendMessageInput,
  Stats,
} from './types';

export interface BackendApi {
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
  listModels(): Promise<Model[]>;
  listChats(): Promise<ChatSummary[]>;
  getChat(id: string): Promise<Chat | null>;
  updateChat(id: string, patch: Partial<Pick<ChatSummary, 'title' | 'pinned'>>): Promise<void>;
  deleteChat(id: string): Promise<void>;
  estimate(text: string): Promise<Estimate>;
  sendMessage(input: SendMessageInput): Promise<Chat>;
  upgradeMessage(messageId: string, modelId: string): Promise<Chat | null>;
  getStats(since: number): Promise<Stats>;
  saveApiKey(key: string): Promise<void>;
  hasApiKey(): Promise<boolean>;
}

export const BACKEND_METHODS = [
  'getProfile', 'updateProfile', 'listModels', 'listChats', 'getChat', 'updateChat', 'deleteChat',
  'estimate', 'sendMessage', 'upgradeMessage', 'getStats', 'saveApiKey', 'hasApiKey',
] as const satisfies readonly (keyof BackendApi)[];

export const backendChannel = (method: keyof BackendApi) => `ui:${method}`;
