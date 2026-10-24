// Detects the language of a message as an ISO 639-1 code ("fr", "es", ...).
import { detectAll } from 'tinyld';

export const UNKNOWN_LANGUAGE = 'und';

// Below this, short or ambiguous text is treated as unknown
const MIN_ACCURACY = 0.5;

export function detectLanguage(text: string): string {
  const best = detectAll(text)[0];
  return best && best.accuracy >= MIN_ACCURACY ? best.lang : UNKNOWN_LANGUAGE;
}
