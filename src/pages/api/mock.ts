// In-memory stand-in for the backend so the UI can be built before the real one exists.
// Token counts, prices and translations here are made up; nothing reflects real tokenizers.

import { AUTO_MODEL } from "./types";
import type {
  AuthResult,
  Chat,
  ChatSummary,
  Estimate,
  LanguageCode,
  LanguageStat,
  LogInInput,
  Model,
  ModelStat,
  Profile,
  SendMessageInput,
  SignUpInput,
  Stats,
  Usage,
  User,
} from "./types";

const MODELS: Model[] = [
  { id: "claude-haiku-5-5", name: "Haiku 5.5", inputPrice: 1, outputPrice: 5 },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5", inputPrice: 3, outputPrice: 15 },
  { id: "claude-opus-5-5", name: "Opus 5.5", inputPrice: 5, outputPrice: 25 },
];

// Rough "language tax": tokens for a sentence in this language per token of the same sentence in English.
const TAX: Record<LanguageCode, number> = { en: 1, es: 1.4, pt: 1.45, fr: 1.45, ht: 1.7, hi: 5, ml: 8 };

// Share of the original tokens spent on the translation step itself.
const TRANSLATE_OVERHEAD = 0.05;

const MOCK_REPLIES: Record<LanguageCode, string> = {
  en: "This is a mock reply. Once the backend is connected, Claude's answer will appear here.",
  es: "Esta es una respuesta de prueba. Cuando el backend esté conectado, aquí aparecerá la respuesta de Claude en español.",
  pt: "Esta é uma resposta de teste. Quando o backend estiver conectado, a resposta do Claude aparecerá aqui em português.",
  fr: "Ceci est une réponse de test. Une fois le backend connecté, la réponse de Claude apparaîtra ici en français.",
  ht: "Sa a se yon repons tès. Lè backend la konekte, repons Claude a ap parèt isit la an kreyòl.",
  hi: "यह एक परीक्षण उत्तर है। बैकएंड जुड़ने के बाद, Claude का उत्तर यहाँ हिंदी में दिखेगा।",
  ml: "ഇതൊരു പരീക്ഷണ മറുപടിയാണ്. ബാക്കെൻഡ് ബന്ധിപ്പിച്ചാൽ Claude-ന്റെ മറുപടി ഇവിടെ മലയാളത്തിൽ കാണാം.",
};

interface Seed {
  title: string;
  language: LanguageCode;
  daysAgo: number;
  prompt: string;
  sentAs?: string;
  reply: string;
  pinned?: boolean;
}

const SEEDS: Seed[] = [
  {
    title: "Receta de pan",
    language: "es",
    daysAgo: 0.04,
    prompt: "¿Cómo hago pan sin levadura?",
    sentAs: "How do I make bread without yeast?",
    reply:
      "Puedes hacer pan sin levadura usando bicarbonato de sodio y un ácido, como yogur o jugo de limón. Mezcla 2 tazas de harina, 1 cucharadita de bicarbonato, una pizca de sal y 1 taza de yogur, y hornea a 200 °C durante 30 minutos.",
  },
  {
    title: "Viagem para Lisboa",
    language: "pt",
    daysAgo: 2,
    pinned: true,
    prompt: "Quais bairros devo visitar em Lisboa em três dias?",
    sentAs: "Which neighborhoods should I visit in Lisbon in three days?",
    reply:
      "Para três dias: Alfama e Baixa no primeiro, Belém no segundo, e Príncipe Real com o Bairro Alto no terceiro.",
  },
  {
    title: "Rapò laboratwa",
    language: "ht",
    daysAgo: 3,
    pinned: true,
    prompt: "Kijan pou m ekri konklizyon yon rapò laboratwa?",
    sentAs: "How do I write the conclusion of a lab report?",
    reply:
      "Kòmanse ak rezilta prensipal la, di si li sipòte ipotèz ou, epi mansyone yon limit ak yon pwochen etap.",
  },
  {
    title: "Matrix help",
    language: "en",
    daysAgo: 1,
    prompt: "How do I find the inverse of a 2x2 matrix?",
    reply:
      "Swap the diagonal entries, negate the off-diagonal ones, and divide everything by the determinant (ad − bc). If the determinant is 0, there's no inverse.",
  },
  {
    title: "CV en français",
    language: "fr",
    daysAgo: 1,
    prompt: "Peux-tu améliorer la description de mon stage dans mon CV ?",
    sentAs: "Can you improve the internship description on my résumé?",
    reply:
      "Commencez chaque ligne par un verbe d'action et ajoutez un résultat chiffré, par exemple : « Automatisé un rapport hebdomadaire, réduisant le temps de préparation de 40 % ».",
  },
  {
    title: "गणित का होमवर्क",
    language: "hi",
    daysAgo: 5,
    prompt: "द्विघात समीकरण कैसे हल करें?",
    sentAs: "How do I solve a quadratic equation?",
    reply: "सूत्र x = (−b ± √(b² − 4ac)) / 2a का उपयोग करें। पहले a, b और c पहचानें, फिर मान रखें।",
  },
  {
    title: "Plan de estudio",
    language: "es",
    daysAgo: 12,
    prompt: "Hazme un plan de estudio para mi examen de química.",
    sentAs: "Make me a study plan for my chemistry exam.",
    reply:
      "Semana 1: estequiometría y enlaces. Semana 2: equilibrio y ácidos y bases. Semana 3: exámenes de práctica cronometrados.",
  },
];

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = MODELS[1];

let profile: Profile = {
  name: "Dominik",
  plan: "Free",
  languages: ["es", "en"],
  translateByDefault: false,
  showSentAs: false,
};
let chats: Chat[] | null = null;
let apiKeySaved = false;
let nextId = 1;

function newId(prefix: string) {
  return `${prefix}${nextId++}`;
}

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Very rough guess from scripts and common words; the real backend will do proper detection. */
export function detectLanguage(text: string): LanguageCode {
  if (/[ഀ-ൿ]/.test(text)) return "ml";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  const t = ` ${text.toLowerCase().replace(/[¿?¡!.,;:]/g, " ")} `;
  if (/[ñ]/.test(t) || /\s(el|los|las|qué|cómo|hago|está|una|por qué)\s/.test(t)) return "es";
  if (/[ãõ]/.test(t) || /\s(você|não|uma|devo|é|quais)\s/.test(t)) return "pt";
  if (/\s(mwen|nou|yo|ki|pou|kijan|kòman|poukisa)\s/.test(t)) return "ht";
  if (/\s(le|les|est|je|vous|une|pour|avec|peux|tu)\s/.test(t)) return "fr";
  if (/[¿¡]/.test(text)) return "es";
  return "en";
}

function englishTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function tokensIn(text: string, language: LanguageCode) {
  return Math.ceil(englishTokens(text) * TAX[language]);
}

function findModel(id: string) {
  return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}

/** Stand-in for the backend's router: short messages go to the smallest model. */
function routeModel(text: string) {
  return text.length < 80 ? MODELS[0].id : DEFAULT_MODEL.id;
}

function cost(model: Model, input: number, output: number) {
  return (input * model.inputPrice + output * model.outputPrice) / 1_000_000;
}

function usageFor(prompt: string, reply: string, language: LanguageCode, modelId: string, translate: boolean): Usage {
  const model = findModel(modelId);
  const promptWithout = tokensIn(prompt, language);
  const replyWithout = tokensIn(reply, language);
  const tokensWithout = promptWithout + replyWithout;
  const costWithout = cost(model, promptWithout, replyWithout);
  if (!translate || language === "en") {
    return { model: model.id, tokensWith: tokensWithout, tokensWithout, costWith: costWithout, costWithout };
  }
  const promptWith = englishTokens(prompt);
  const replyWith = englishTokens(reply);
  // Translating in and out runs on the smallest model.
  const overhead = Math.ceil(tokensWithout * TRANSLATE_OVERHEAD);
  return {
    model: model.id,
    tokensWith: promptWith + replyWith + overhead,
    tokensWithout,
    costWith: cost(model, promptWith, replyWith) + cost(MODELS[0], overhead, 0),
    costWithout,
  };
}

function updateSavings(chat: Chat) {
  let withTokens = 0;
  let withoutTokens = 0;
  for (const message of chat.messages) {
    if (!message.usage) continue;
    withTokens += message.usage.tokensWith;
    withoutTokens += message.usage.tokensWithout;
  }
  chat.savedFraction = withoutTokens > 0 ? (withoutTokens - withTokens) / withoutTokens : 0;
}

function seed(): Chat[] {
  const now = Date.now();
  return SEEDS.map((s) => {
    const at = now - s.daysAgo * DAY;
    const chat: Chat = {
      id: newId("c"),
      title: s.title,
      pinned: s.pinned ?? false,
      updatedAt: at,
      savedFraction: 0,
      messages: [
        { id: newId("m"), role: "user", text: s.prompt, language: s.language, sentAs: s.sentAs, createdAt: at },
        {
          id: newId("m"),
          role: "assistant",
          text: s.reply,
          language: s.language,
          usage: usageFor(s.prompt, s.reply, s.language, DEFAULT_MODEL.id, true),
          createdAt: at + 4000,
        },
      ],
    };
    updateSavings(chat);
    return chat;
  });
}

function db(): Chat[] {
  chats ??= seed();
  return chats;
}

function summarize({ id, title, pinned, updatedAt, savedFraction }: Chat): ChatSummary {
  return { id, title, pinned, updatedAt, savedFraction };
}

function titleFrom(text: string) {
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 40 ? `${firstLine.slice(0, 40).trimEnd()}…` : firstLine;
}

export async function getProfile(): Promise<Profile> {
  await wait();
  return { ...profile };
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  await wait();
  profile = { ...profile, ...patch };
  return { ...profile };
}

export async function listModels(): Promise<Model[]> {
  await wait();
  return MODELS;
}

export async function listChats(): Promise<ChatSummary[]> {
  await wait();
  return db()
    .map(summarize)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChat(id: string): Promise<Chat | null> {
  await wait();
  const chat = db().find((c) => c.id === id);
  return chat ? structuredClone(chat) : null;
}

export async function updateChat(id: string, patch: Partial<Pick<ChatSummary, "title" | "pinned">>): Promise<void> {
  await wait();
  const chat = db().find((c) => c.id === id);
  if (chat) Object.assign(chat, patch);
}

export async function deleteChat(id: string): Promise<void> {
  await wait();
  chats = db().filter((c) => c.id !== id);
}

export async function estimate(text: string): Promise<Estimate> {
  await wait(80);
  const language = detectLanguage(text);
  const tokensAsTyped = tokensIn(text, language);
  const tokensTranslated =
    language === "en" ? tokensAsTyped : englishTokens(text) + Math.ceil(tokensAsTyped * TRANSLATE_OVERHEAD);
  return { language, tokensAsTyped, tokensTranslated };
}

export async function sendMessage(input: SendMessageInput): Promise<Chat> {
  await wait(600);
  const language = detectLanguage(input.text);
  const translate = input.translate && language !== "en";
  const now = Date.now();
  let chat = input.chatId ? db().find((c) => c.id === input.chatId) : undefined;
  if (!chat) {
    const title = titleFrom(input.text || input.attachments[0]?.name || "New chat");
    chat = { id: newId("c"), title, pinned: false, updatedAt: now, savedFraction: 0, messages: [] };
    db().push(chat);
  }
  const reply = MOCK_REPLIES[language];
  const model = input.model === AUTO_MODEL ? routeModel(input.text) : input.model;
  chat.messages.push(
    {
      id: newId("m"),
      role: "user",
      text: input.text,
      language,
      sentAs: translate ? `(mock English version) ${input.text}` : undefined,
      // Only the names, types and sizes come back; the file contents stay with the backend.
      files: input.attachments.length > 0 ? input.attachments.map(({ name, type, size }) => ({ name, type, size })) : undefined,
      createdAt: now,
    },
    {
      id: newId("m"),
      role: "assistant",
      text: reply,
      language,
      usage: usageFor(input.text, reply, language, model, translate),
      createdAt: now + 1,
    },
  );
  chat.updatedAt = now;
  updateSavings(chat);
  return structuredClone(chat);
}

/** Re-answers an assistant message on a bigger model, keeping the same prompt (the Upgrade button). */
export async function upgradeMessage(messageId: string, modelId: string): Promise<Chat | null> {
  await wait(600);
  for (const chat of db()) {
    const index = chat.messages.findIndex((m) => m.id === messageId);
    if (index < 1) continue;
    const prompt = chat.messages[index - 1];
    const answer = chat.messages[index];
    answer.usage = usageFor(prompt.text, answer.text, answer.language, modelId, prompt.sentAs !== undefined);
    updateSavings(chat);
    return structuredClone(chat);
  }
  return null;
}

/** Totals for assistant messages created at or after `since` (epoch ms). */
export async function getStats(since: number): Promise<Stats> {
  await wait();
  const stats: Stats = { tokensWith: 0, tokensWithout: 0, costWith: 0, costWithout: 0, byLanguage: [], byModel: [] };
  const byLanguage = new Map<LanguageCode, LanguageStat>();
  const byModel = new Map<string, ModelStat>();
  for (const chat of db()) {
    for (const message of chat.messages) {
      const usage = message.usage;
      if (!usage || message.createdAt < since) continue;
      stats.tokensWith += usage.tokensWith;
      stats.tokensWithout += usage.tokensWithout;
      stats.costWith += usage.costWith;
      stats.costWithout += usage.costWithout;

      const lang = byLanguage.get(message.language) ?? {
        language: message.language,
        messages: 0,
        tokensWith: 0,
        tokensWithout: 0,
        taxMultiplier: TAX[message.language],
      };
      lang.messages += 1;
      lang.tokensWith += usage.tokensWith;
      lang.tokensWithout += usage.tokensWithout;
      byLanguage.set(message.language, lang);

      const model = byModel.get(usage.model) ?? { model: usage.model, messages: 0, tokensWith: 0, tokensWithout: 0 };
      model.messages += 1;
      model.tokensWith += usage.tokensWith;
      model.tokensWithout += usage.tokensWithout;
      byModel.set(usage.model, model);
    }
  }
  const saved = (s: { tokensWith: number; tokensWithout: number }) => s.tokensWithout - s.tokensWith;
  stats.byLanguage = [...byLanguage.values()].sort((a, b) => saved(b) - saved(a));
  stats.byModel = [...byModel.values()].sort((a, b) => saved(b) - saved(a));
  return stats;
}

export async function saveApiKey(key: string): Promise<void> {
  await wait();
  apiKeySaved = key.trim().length > 0;
}

export async function hasApiKey(): Promise<boolean> {
  await wait();
  return apiKeySaved;
}

// ---------------------------------------------------------------------------------------------------------------
// Log in and sign up: NOT CONNECTED YET. No accounts exist here and nothing is checked, so any email and password
// lets you in and the rest of the app can still be previewed. The backend replaces these four functions;
// their inputs, outputs and errors are in FRONTEND_SCOPE.md section 8.

// AUTH: false while log in isn't connected, so the log in and sign up screens say any email and password works.
// Goes away by itself when client.ts switches from this file to the real backend.
export const authConnected = false;

// Keeps whoever logged in until the preview tab is closed, so a reload doesn't send you back to Log in.
// Only what the user typed is kept. The backend decides how long a real session lasts.
const SESSION_KEY = "optimaize-preview-user";

function remember(user: User | null) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be blocked; you then log in again after a reload.
  }
}

// Backend: return the user still logged in from last time, or null if nobody is.
// Used by: lib/auth.tsx when the app opens.
export async function getSession(): Promise<User | null> {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
}

// Backend: check the email and password rules, refuse an email that is already used ("email_taken"), store a slow
// hash of the password (never the password itself), save the name as the profile name, and log the user in.
// Used by: auth/SignUpPage.tsx.
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const user = { id: input.email, email: input.email };
  profile = { ...profile, name: input.name.trim() };
  remember(user);
  return { ok: true, user };
}

// Backend: check the email and password against the stored hash. Return "wrong_credentials" whether the email or
// the password is wrong, so the screen never reveals who has an account.
// Used by: auth/LogInPage.tsx.
export async function logIn(input: LogInInput): Promise<AuthResult> {
  const user = { id: input.email, email: input.email };
  remember(user);
  return { ok: true, user };
}

// Backend: end the session on this computer.
// Used by: settings/SettingsPage.tsx (Log out button).
export async function logOut(): Promise<void> {
  remember(null);
}
