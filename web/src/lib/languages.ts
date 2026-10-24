import type { LanguageCode } from "./api/types";

export const LANGUAGES: Record<LanguageCode, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  es: { name: "Spanish", native: "Español" },
  pt: { name: "Portuguese", native: "Português" },
  fr: { name: "French", native: "Français" },
  ht: { name: "Haitian Creole", native: "Kreyòl ayisyen" },
  hi: { name: "Hindi", native: "हिन्दी" },
  ml: { name: "Malayalam", native: "മലയാളം" },
};

// Morning, afternoon, evening.
const GREETINGS: Record<LanguageCode, [string, string, string]> = {
  en: ["Good morning", "Good afternoon", "Good evening"],
  es: ["Buenos días", "Buenas tardes", "Buenas noches"],
  pt: ["Bom dia", "Boa tarde", "Boa noite"],
  fr: ["Bonjour", "Bon après-midi", "Bonsoir"],
  ht: ["Bonjou", "Bon apremidi", "Bonswa"],
  hi: ["नमस्ते", "नमस्ते", "नमस्ते"],
  ml: ["നമസ്കാരം", "നമസ്കാരം", "നമസ്കാരം"],
};

export function greeting(language: LanguageCode, hour: number) {
  const [morning, afternoon, evening] = GREETINGS[language];
  return hour < 12 ? morning : hour < 18 ? afternoon : evening;
}

export const STARTERS: Record<LanguageCode, string[]> = {
  en: ["Why is the sky blue?", "Explain photosynthesis in 3 sentences"],
  es: ["¿Por qué el cielo es azul?", "Explícame la fotosíntesis en 3 frases"],
  pt: ["Por que o céu é azul?", "Explique a fotossíntese em 3 frases"],
  fr: ["Pourquoi le ciel est-il bleu ?", "Explique la photosynthèse en 3 phrases"],
  ht: ["Poukisa syèl la ble?", "Eksplike fotosentèz nan 3 fraz"],
  hi: ["आसमान नीला क्यों है?", "प्रकाश संश्लेषण को 3 वाक्यों में समझाइए"],
  ml: ["ആകാശം നീലയായിരിക്കുന്നത് എന്തുകൊണ്ട്?", "പ്രകാശസംശ്ലേഷണം 3 വാക്യങ്ങളിൽ വിശദീകരിക്കുക"],
};
