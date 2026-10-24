// App-wide IPC contract: settings, API key, stats, and the preload API the UI sees.
import type {
  SendMessageRequest,
  SendMessageResult,
  TokenEvent,
  UpgradeMessageRequest,
  UpgradeMessageResult,
} from './chat';

export const STATS_WEEKLY = 'stats:weekly';
export const SETTINGS_SAVE_API_KEY = 'settings:saveApiKey';
export const SETTINGS_CHECK_API_KEY = 'settings:checkApiKey';
export const SETTINGS_GET_CONFIG = 'settings:getConfig';
export const SETTINGS_SET_CONFIG = 'settings:setConfig';

// Each technique has an on/off flag. translateThroughEnglish can change meaning, so it is off.
export interface AppConfig {
  languageSavings: {
    englishSystemPrompts: boolean;
    promptTrimming: boolean;
    autoSummarizeLongChats: boolean;
    translateThroughEnglish: boolean;
  };
  routing: { enabled: boolean };
}

export const DEFAULT_CONFIG: AppConfig = {
  languageSavings: {
    englishSystemPrompts: true,
    promptTrimming: true,
    autoSummarizeLongChats: true,
    translateThroughEnglish: false,
  },
  routing: { enabled: true },
};

export type ConfigPatch = {
  languageSavings?: Partial<AppConfig['languageSavings']>;
  routing?: Partial<AppConfig['routing']>;
};

export interface CheckApiKeyResult {
  valid: boolean;
  error?: string;
}

// What the preload bridge exposes as window.api. The renderer never sees the key.
// Stats is typed loosely here to avoid importing main-process types into the UI; the
// shape is WeeklyStats in src/main/usage/types.ts.
export interface OptimaizeApi {
  sendMessage(req: SendMessageRequest): Promise<SendMessageResult>;
  upgradeMessage(req: UpgradeMessageRequest): Promise<UpgradeMessageResult>;
  onToken(listener: (event: TokenEvent) => void): () => void;
  getWeeklyStats(): Promise<unknown>;
  saveApiKey(key: string): Promise<{ ok: true }>;
  checkApiKey(key?: string): Promise<CheckApiKeyResult>;
  getConfig(): Promise<AppConfig>;
  setConfig(patch: ConfigPatch): Promise<AppConfig>;
}
