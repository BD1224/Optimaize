import type { LanguageCode } from './types';

/** Very rough guess from scripts and common words. Replace with proper detection later. */
export function detectLanguage(text: string): LanguageCode {
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const t = ` ${text.toLowerCase().replace(/[¿?¡!.,;:]/g, ' ')} `;
  if (/[ñ]/.test(t) || /\s(el|los|las|qué|cómo|hago|está|una|por qué)\s/.test(t)) return 'es';
  if (/[ãõ]/.test(t) || /\s(você|não|uma|devo|é|quais)\s/.test(t)) return 'pt';
  if (/\s(mwen|nou|yo|ki|pou|kijan|kòman|poukisa)\s/.test(t)) return 'ht';
  if (/\s(le|les|est|je|vous|une|pour|avec|peux|tu)\s/.test(t)) return 'fr';
  if (/[¿¡]/.test(text)) return 'es';
  return 'en';
}
