import type { LanguageCode } from "../api/types";

export const LANGUAGES: Record<LanguageCode, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  es: { name: "Spanish", native: "Español" },
  pt: { name: "Portuguese", native: "Português" },
  fr: { name: "French", native: "Français" },
  ht: { name: "Haitian Creole", native: "Kreyòl ayisyen" },
  hi: { name: "Hindi", native: "हिन्दी" },
  ml: { name: "Malayalam", native: "മലയാളം" },
};

// "Hello" in each language, for the greeting on the new-chat screen.
export const HELLO: Record<LanguageCode, string> = {
  en: "Hello",
  es: "Hola",
  pt: "Olá",
  fr: "Bonjour",
  ht: "Bonjou",
  hi: "नमस्ते",
  ml: "നമസ്കാരം",
};
