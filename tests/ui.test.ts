// The UI-facing backend API on top of the real composed app and an in-memory database.
// Only the paid API calls are faked.
import { composeApp } from '../src/main/compose';
import { openDatabase } from '../src/main/db';
import { createBackendApi, registerBackendApi } from '../src/main/ipc/ui';
import type { Complete, StreamReply } from '../src/main/providers/anthropic';
import type { Keystore } from '../src/main/security/keystore';
import { BACKEND_METHODS, backendChannel } from '../src/shared/api';
import { AUTO_MODEL, type Attachment, type SendMessageInput } from '../src/shared/types';

const HAIKU = 'claude-haiku-5-5';
const SONNET = 'claude-sonnet-5-5';
const OPUS = 'claude-opus-5-5';

function setup(o: { countTokens?: (t: string) => Promise<number>; keyed?: boolean } = {}) {
  let tick = 1_700_000_000_000;
  const now = () => ++tick;
  const prompts: string[] = [];
  const complete: Complete = async () => ({
    json: { category: 'chat', difficulty: 'easy' },
    usage: { inputTokens: 150, outputTokens: 10 },
  });
  const streamReply: StreamReply = async ({ model, messages }) => {
    prompts.push(messages[messages.length - 1].content);
    return { text: `from ${model}`, usage: { inputTokens: 1000, outputTokens: 500 } };
  };
  const app = composeApp({ db: openDatabase(), getApiKey: () => 'sk', complete, streamReply, now });
  let key: string | null = o.keyed ? 'sk' : null;
  const keystore: Keystore = {
    save: (k) => { key = k; }, get: () => key, has: () => key !== null, clear: () => { key = null; },
  };
  const api = createBackendApi({ app, keystore, countTokens: o.countTokens, now });
  const input = (text: string, extra: Partial<SendMessageInput> = {}): SendMessageInput => ({
    text, translate: false, model: AUTO_MODEL, attachments: [], ...extra,
  });
  return { api, app, prompts, input, keystore };
}

describe('models and profile', () => {
  it('lists the three models with real names and prices', async () => {
    const models = await setup().api.listModels();
    expect(models.map((m) => m.name)).toEqual(['Haiku 5.5', 'Sonnet 5.5', 'Opus 5.5']);
    expect(models.map((m) => m.id)).toEqual([HAIKU, SONNET, OPUS]);
    expect(models[0].inputPrice < models[2].inputPrice).toBe(true);
  });

  it('returns a default profile and keeps updates', async () => {
    const { api } = setup();
    expect((await api.getProfile()).translateByDefault).toBe(false);
    await api.updateProfile({ name: 'Dom', languages: ['es', 'en'] });
    expect(await api.getProfile()).toMatchObject({ name: 'Dom', languages: ['es', 'en'] });
  });
});

describe('sendMessage and chats', () => {
  it('creates a chat, titles it from the first line and returns both messages', async () => {
    const { api, input } = setup();
    const chat = await api.sendMessage(input('How do I bake bread?\nWithout yeast'));
    expect(chat.title).toBe('How do I bake bread?');
    expect(chat.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(chat.messages[1].text).toBe(`from ${HAIKU}`);
  });

  it('gives the answer honest usage: classifier overhead counts, routing shows as cost saved', async () => {
    const { api, input } = setup();
    const u = (await api.sendMessage(input('hi'))).messages[1].usage!;
    expect(u.model).toBe(HAIKU);
    expect(u.tokensWithout).toBe(1500);
    expect(u.tokensWith).toBe(1500 + 160); // plus the classifier call
    expect(u.costWithout).toBeGreaterThan(u.costWith);
  });

  it('continues an existing chat', async () => {
    const { api, input } = setup();
    const first = await api.sendMessage(input('one'));
    const second = await api.sendMessage(input('two', { chatId: first.id }));
    expect(second.id).toBe(first.id);
    expect(second.messages.length).toBe(4);
  });

  it('skips the classifier when the user picks a model', async () => {
    const { api, input, app } = setup();
    const chat = await api.sendMessage(input('hi', { model: OPUS }));
    expect(chat.messages[1].usage!.model).toBe(OPUS);
    expect(app.logger.list(0, Date.now() * 2).some((r) => r.kind === 'classifier')).toBe(false);
  });

  it('records the detected language on the messages', async () => {
    const { api, input } = setup();
    const chat = await api.sendMessage(input('¿Cómo hago pan sin levadura?'));
    expect(chat.messages.every((m) => m.language === 'es')).toBe(true);
  });

  it('lists, renames, pins and deletes chats', async () => {
    const { api, input } = setup();
    const a = await api.sendMessage(input('first'));
    const b = await api.sendMessage(input('second'));
    expect((await api.listChats()).map((c) => c.id)).toEqual([b.id, a.id]);
    await api.updateChat(a.id, { title: 'Renamed', pinned: true });
    expect((await api.listChats()).find((c) => c.id === a.id)).toMatchObject({ title: 'Renamed', pinned: true });
    await api.deleteChat(a.id);
    expect(await api.getChat(a.id)).toBeNull();
    expect((await api.listChats()).length).toBe(1);
  });

  it('inlines text attachments, hides them again in the chat, and refuses images and PDFs', async () => {
    const { api, input, prompts } = setup();
    const txt: Attachment = { name: 'notes.txt', type: 'text/plain', size: 5, data: new TextEncoder().encode('hello').buffer as ArrayBuffer };
    const chat = await api.sendMessage(input('summarize', { attachments: [txt] }));
    expect(prompts[0]).toContain('hello');
    expect(chat.messages[0].text).toBe('summarize');
    expect(chat.messages[0].files).toEqual([{ name: 'notes.txt', type: 'text/plain', size: 5 }]);
    const png: Attachment = { name: 'a.png', type: 'image/png', size: 1, data: new ArrayBuffer(1) };
    await expect(api.sendMessage(input('look', { attachments: [png] }))).rejects.toThrow('not supported');
  });
});

describe('upgradeMessage', () => {
  it('replaces the answer with one from the chosen bigger model and counts the first attempt', async () => {
    const { api, input } = setup();
    const chat = await api.sendMessage(input('hard one'));
    const upgraded = (await api.upgradeMessage(chat.messages[1].id, OPUS))!;
    expect(upgraded.messages.length).toBe(2);
    expect(upgraded.messages[1].text).toBe(`from ${OPUS}`);
    const u = upgraded.messages[1].usage!;
    expect(u.model).toBe(OPUS);
    expect(u.tokensWith).toBe(1500 + 1500 + 160); // first attempt, upgrade, classifier
    expect(u.tokensWithout).toBe(1500);
  });

  it('rejects a downgrade and returns null for an unknown message', async () => {
    const { api, input } = setup();
    const chat = await api.sendMessage(input('hi', { model: SONNET }));
    await expect(api.upgradeMessage(chat.messages[1].id, HAIKU)).rejects.toThrow();
    expect(await api.upgradeMessage('nope', OPUS)).toBeNull();
  });
});

describe('getStats', () => {
  it('totals tokens and cost, and breaks them down by model and language', async () => {
    const { api, input } = setup();
    await api.sendMessage(input('¿Cómo hago pan?'));
    await api.sendMessage(input('hello there'));
    const s = await api.getStats(0);
    expect(s.tokensWithout).toBe(3000);
    expect(s.tokensWith).toBe(3000 + 320);
    expect(s.costWithout).toBeGreaterThan(s.costWith);
    expect(s.byModel).toEqual([{ model: HAIKU, messages: 2, tokensWith: 3320, tokensWithout: 3000 }]);
    expect(s.byLanguage.map((l) => l.language).sort()).toEqual(['en', 'es']);
  });

  it('ignores anything before the start date', async () => {
    const { api, input } = setup();
    await api.sendMessage(input('hi'));
    expect((await api.getStats(Date.now() * 2)).tokensWith).toBe(0);
  });
});

describe('estimate, API key', () => {
  it('uses real token counts when available and falls back to a guess when not', async () => {
    const ok = setup({ countTokens: async () => 7 });
    expect(await ok.api.estimate('hola, ¿cómo estás?')).toEqual({ language: 'es', tokensAsTyped: 7, tokensTranslated: 7 });
    const down = setup({ countTokens: async () => { throw new Error('offline'); } });
    expect((await down.api.estimate('abcdef')).tokensAsTyped).toBe(2);
  });

  it('saves and reports the API key', async () => {
    const { api } = setup();
    expect(await api.hasApiKey()).toBe(false);
    await api.saveApiKey('sk-new');
    expect(await api.hasApiKey()).toBe(true);
  });
});

describe('registerBackendApi', () => {
  it('registers one channel per method and forwards arguments', async () => {
    const { api } = setup();
    const handlers = new Map<string, (e: unknown, ...a: unknown[]) => unknown>();
    registerBackendApi({ handle: (c, l) => void handlers.set(c, l) }, api);
    expect([...handlers.keys()].sort()).toEqual(BACKEND_METHODS.map(backendChannel).sort());
    await handlers.get(backendChannel('updateProfile'))!({}, { name: 'Zed' });
    expect((await api.getProfile()).name).toBe('Zed');
  });
});
