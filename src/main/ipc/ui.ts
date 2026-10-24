// The backend API the UI calls (see shared/api.ts). Built on the composed app, so it only
// translates between the UI's shapes and the backend's; no Electron imports.
import type { BackendApi } from '../../shared/api';
import { backendChannel, BACKEND_METHODS } from '../../shared/api';
import { detectLanguage } from '../../shared/language';
import {
  AUTO_MODEL,
  type Attachment,
  type Chat,
  type ChatSummary,
  type Estimate,
  type LanguageCode,
  type LanguageStat,
  type Message,
  type Model,
  type ModelStat,
  type SendMessageInput,
  type Stats,
  type Usage,
} from '../../shared/types';
import type { ChatRow } from '../db/chats';
import type { StoredMessage } from '../db/messages';
import type { composeApp } from '../compose';
import type { CountTokens } from '../providers/anthropic';
import type { Keystore } from '../security/keystore';
import { DEFAULT_PRICES } from '../usage/pricing';
import { groupExchanges, sumTotals } from '../usage/exchanges';
import type { Difficulty, ModelId } from '../usage/types';
import { upgradeMessage } from './upgradeMessage';
import { sendMessage } from './sendMessage';
import type { IpcMainLike } from './settings';

export interface BackendDeps {
  app: ReturnType<typeof composeApp>;
  keystore: Keystore;
  // Real token counts for the "while typing" estimate; falls back to a rough guess without it
  countTokens?: CountTokens;
  now?: () => number;
}

// Text attachments are sent inline after the prompt; this marker lets getChat hide them again
const FILE_MARKER = '\n\n<<<file ';
const noop = () => {};

const titleFrom = (text: string) => {
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 40 ? `${firstLine.slice(0, 40).trimEnd()}…` : firstLine;
};

const savedFraction = (withTokens: number, withoutTokens: number) =>
  withoutTokens > 0 ? (withoutTokens - withTokens) / withoutTokens : 0;

const modelName = (apiId: string) => {
  const [, family, major, minor] = apiId.split('-');
  return `${family[0].toUpperCase()}${family.slice(1)} ${major}.${minor}`;
};

// What the UI shows for an attachment in the prompt. Images and PDFs need content blocks the
// provider does not send yet, so refuse them clearly instead of silently dropping them.
function inlineAttachments(attachments: Attachment[]): string {
  return attachments
    .map((a) => {
      if (!a.type.startsWith('text/')) {
        throw new Error(`Attaching ${a.type || 'this kind of file'} is not supported yet. Text files only.`);
      }
      return `${FILE_MARKER}name="${a.name}">>>\n${new TextDecoder().decode(a.data)}\n<<<end file>>>`;
    })
    .join('');
}

export function createBackendApi(deps: BackendDeps): BackendApi {
  const { app, keystore } = deps;
  const { messages, chats, logger, profile } = app;
  const now = deps.now ?? Date.now;
  const modelOf = (id: ModelId) => DEFAULT_PRICES[id].apiId;

  function usageOf(m: StoredMessage): Usage | undefined {
    if (m.role !== 'assistant' || !m.replyTo) return undefined;
    const ex = groupExchanges(logger.forExchange(m.replyTo))[0];
    if (!ex?.final) return undefined;
    return {
      model: modelOf(ex.final.model),
      tokensWith: ex.tokensWith,
      tokensWithout: ex.tokensWithout,
      costWith: ex.costWith,
      costWithout: ex.costWithout,
    };
  }

  function toMessage(m: StoredMessage): Message {
    return {
      id: m.id,
      role: m.role,
      text: m.content.split(FILE_MARKER)[0],
      language: (m.language ?? 'en') as LanguageCode,
      files: m.files ?? undefined,
      usage: usageOf(m),
      createdAt: m.createdAt,
    };
  }

  function summaryOf(row: ChatRow, msgs: Message[]): ChatSummary {
    let withTokens = 0;
    let withoutTokens = 0;
    for (const m of msgs) {
      withTokens += m.usage?.tokensWith ?? 0;
      withoutTokens += m.usage?.tokensWithout ?? 0;
    }
    return { ...row, savedFraction: savedFraction(withTokens, withoutTokens) };
  }

  function getChat(id: string): Chat | null {
    const row = chats.get(id);
    if (!row) return null;
    const msgs = messages.getStored(id).map(toMessage);
    return { ...summaryOf(row, msgs), messages: msgs };
  }

  return {
    async getProfile() {
      return profile.get();
    },
    async updateProfile(patch) {
      return profile.set(patch);
    },
    async listModels(): Promise<Model[]> {
      return (Object.keys(DEFAULT_PRICES) as ModelId[]).map((id) => ({
        id: DEFAULT_PRICES[id].apiId,
        name: modelName(DEFAULT_PRICES[id].apiId),
        inputPrice: DEFAULT_PRICES[id].inputPerMTok,
        outputPrice: DEFAULT_PRICES[id].outputPerMTok,
      }));
    },
    async listChats() {
      return chats.list().map((row) => summaryOf(row, messages.getStored(row.id).map(toMessage)));
    },
    async getChat(id) {
      return getChat(id);
    },
    async updateChat(id, patch) {
      chats.update(id, patch);
    },
    async deleteChat(id) {
      messages.deleteChatMessages(id);
      chats.remove(id);
    },

    async estimate(text): Promise<Estimate> {
      const language = detectLanguage(text);
      let tokens = Math.ceil(text.length / 3); // rough guess when there is no key or no network
      if (deps.countTokens && text.trim()) {
        try {
          tokens = await deps.countTokens(text);
        } catch {
          // keep the guess
        }
      }
      // Translating through English is not built yet, so there is no separate count for it
      return { language, tokensAsTyped: tokens, tokensTranslated: tokens };
    },

    async sendMessage(input: SendMessageInput) {
      const files = input.attachments.map(({ name, type, size }) => ({ name, type, size }));
      const fullText = input.text + inlineAttachments(input.attachments);
      const row =
        (input.chatId ? chats.get(input.chatId) : null) ??
        chats.create(titleFrom(input.text || input.attachments[0]?.name || 'New chat'));

      const result = await sendMessage(
        app.chatDeps,
        {
          chatId: row.id,
          text: fullText,
          language: detectLanguage(input.text),
          model: input.model === AUTO_MODEL ? undefined : input.model,
          files,
        },
        noop,
      );

      // A long chat was summarized: the conversation continues in a fresh chat with the same title
      const chatId = result.continuedInChatId ?? row.id;
      if (chatId !== row.id) chats.create(row.title, chatId);
      chats.touch(chatId);
      return getChat(chatId)!;
    },

    async upgradeMessage(messageId, modelId) {
      const answer = messages.getMessage(messageId);
      if (!answer || answer.role !== 'assistant' || !answer.replyTo) return null;
      const final = groupExchanges(logger.forExchange(answer.replyTo))[0]?.final;
      if (!final) return null;

      const result = await upgradeMessage(
        app.chatDeps,
        {
          chatId: answer.chatId,
          userMessageId: answer.replyTo,
          replyMessageId: answer.id,
          fromModel: modelOf(final.model),
          category: answer.category ?? 'chat',
          difficulty: (final.difficulty ?? 'medium') as Difficulty,
          language: answer.language ?? undefined,
          toModel: modelId,
        },
        noop,
      );

      // The new answer replaces the old one in the conversation; the old attempt stays in the usage log
      messages.deleteMessage(answer.id);
      chats.touch(result.reply.chatId);
      return getChat(result.reply.chatId);
    },

    async getStats(since): Promise<Stats> {
      const exchanges = groupExchanges(logger.list(since, now() + 1));
      const byLanguage = new Map<LanguageCode, LanguageStat>();
      const byModel = new Map<string, ModelStat>();

      for (const ex of exchanges) {
        if (!ex.final) continue;
        const language = (ex.final.language ?? 'en') as LanguageCode;
        const lang = byLanguage.get(language) ?? {
          language, messages: 0, tokensWith: 0, tokensWithout: 0,
          taxMultiplier: 1, // not measured yet: needs the tokenizer comparison
        };
        lang.messages += 1;
        lang.tokensWith += ex.tokensWith;
        lang.tokensWithout += ex.tokensWithout;
        byLanguage.set(language, lang);

        const model = modelOf(ex.final.model);
        const m = byModel.get(model) ?? { model, messages: 0, tokensWith: 0, tokensWithout: 0 };
        m.messages += 1;
        m.tokensWith += ex.tokensWith;
        m.tokensWithout += ex.tokensWithout;
        byModel.set(model, m);
      }

      const saved = (s: { tokensWith: number; tokensWithout: number }) => s.tokensWithout - s.tokensWith;
      return {
        ...sumTotals(exchanges),
        byLanguage: [...byLanguage.values()].sort((a, b) => saved(b) - saved(a)),
        byModel: [...byModel.values()].sort((a, b) => saved(b) - saved(a)),
      };
    },

    async saveApiKey(key) {
      keystore.save(key);
    },
    async hasApiKey() {
      return keystore.has();
    },
  };
}

// Registers every UI call as ui:<name>. Errors thrown here reach the UI as rejected promises.
export function registerBackendApi(ipcMain: IpcMainLike, api: BackendApi): void {
  for (const method of BACKEND_METHODS) {
    ipcMain.handle(backendChannel(method), (_event, ...args: unknown[]) =>
      (api[method] as (...a: unknown[]) => unknown)(...args),
    );
  }
}
