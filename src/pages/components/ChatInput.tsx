import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "../api/client";
import type { Estimate } from "../api/types";
import { formatNumber, formatPercent, savedFraction } from "../lib/format";
import { LANGUAGES } from "../lib/languages";
import { useApp } from "../lib/store";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  placeholder: string;
  onSend: (text: string, translate: boolean) => Promise<void>;
}

export function ChatInput({ placeholder, onSend }: ChatInputProps) {
  const { profile } = useApp();
  const [text, setText] = useState("");
  // null = follow the user's default from Settings.
  const [translateOverride, setTranslateOverride] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [sending, setSending] = useState(false);

  const translate = translateOverride ?? profile?.translateByDefault ?? false;
  const trimmed = text.trim();
  const current = trimmed ? estimate : null;
  const language = current?.language;

  // Re-estimate shortly after typing stops.
  useEffect(() => {
    if (!trimmed) return;
    const timer = setTimeout(() => {
      api.estimate(trimmed).then(setEstimate);
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  async function send() {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed, translate);
      setText("");
      setEstimate(null);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Skip Enter while an input method (e.g. for Hindi) is still composing a character.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div>
      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          lang={language}
          rows={2}
        />
        <div className={styles.row}>
          <button type="button" className={styles.attach} disabled title="Attachments are coming later" aria-label="Attach file">
            +
          </button>
          {language && (
            <span className={styles.chip}>
              {LANGUAGES[language].native}
              {translate && language !== "en" ? " → EN" : ""}
            </span>
          )}
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={translate}
            onClick={() => setTranslateOverride(!translate)}
          >
            Translate to English: {translate ? "on" : "off"}
          </button>
          <button
            type="button"
            className={styles.send}
            onClick={() => void send()}
            disabled={!trimmed || sending}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
      <p className={styles.estimate} aria-live="polite">
        {current && describeEstimate(current, translate)}
      </p>
    </div>
  );
}

function describeEstimate(estimate: Estimate, translate: boolean) {
  const asTyped = `~${formatNumber(estimate.tokensAsTyped)} tokens as typed`;
  if (estimate.language === "en") return `${asTyped}. Already in English, nothing to translate.`;
  const saving = formatPercent(savedFraction(estimate.tokensTranslated, estimate.tokensAsTyped));
  if (!translate) {
    return `${asTyped}. Translating to English would use ~${formatNumber(estimate.tokensTranslated)} (−${saving}), but can change meaning. Estimate.`;
  }
  return `${asTyped} → ~${formatNumber(estimate.tokensTranslated)} translated (−${saving}), estimate`;
}
