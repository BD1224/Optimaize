import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { api } from "../api/client";
import { MAX_FILE_BYTES, type Attachment, type Estimate } from "../api/types";
import { ACCEPT, canAttach, fileKind, toAttachment } from "../lib/files";
import { formatBytes, formatNumber, formatPercent, savedFraction } from "../lib/format";
import { LANGUAGES } from "../lib/languages";
import { useApp } from "../lib/store";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  placeholder: string;
  onSend: (text: string, translate: boolean, attachments: Attachment[]) => Promise<void>;
}

export function ChatInput({ placeholder, onSend }: ChatInputProps) {
  const { profile } = useApp();
  // PROMPT: the message the user is typing. Send passes it (trimmed) to onSend in chat/ChatPage.tsx.
  const [text, setText] = useState("");
  // FILES: the files the user attached with the + button. Sent with the prompt as `attachments` (chat/ChatPage.tsx).
  const [files, setFiles] = useState<File[]>([]);
  // FILES: why a picked file was refused (wrong type or too big). Empty means no problem.
  const [fileError, setFileError] = useState("");
  // The hidden file picker that the + button opens.
  const fileInput = useRef<HTMLInputElement>(null);
  // null = follow the user's default from Settings.
  const [translateOverride, setTranslateOverride] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [sending, setSending] = useState(false);

  // BACKEND: "Translate to English" on/off for this message (the team's translateThroughEnglish). Sent with the prompt.
  const translate = translateOverride ?? profile?.translateByDefault ?? false;
  const trimmed = text.trim();
  const current = trimmed ? estimate : null;
  const language = current?.language;
  // A message can be text, files, or both.
  const canSend = (trimmed !== "" || files.length > 0) && !sending;

  // Re-estimate shortly after typing stops.
  useEffect(() => {
    if (!trimmed) return;
    const timer = setTimeout(() => {
      // BACKEND: live token count while typing: detected language, tokens as typed, tokens if translated.
      api.estimate(trimmed).then(setEstimate);
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      // FILES: each file's name, type, size and contents, read just before sending.
      const attachments = await Promise.all(files.map(toAttachment));
      await onSend(trimmed, translate, attachments);
      setText("");
      setFiles([]);
      setFileError("");
      setEstimate(null);
    } finally {
      setSending(false);
    }
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    // Clear the picker so choosing the same file again still counts as a change.
    event.target.value = "";
    const refused = picked.filter((f) => !canAttach(f));
    setFileError(
      refused.length > 0
        ? `Couldn't attach ${refused.map((f) => f.name).join(", ")}. Images, PDFs and text files up to ${formatBytes(MAX_FILE_BYTES)} only.`
        : "",
    );
    const isSame = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
    setFiles((current) => [
      ...current,
      ...picked.filter((f) => canAttach(f) && !current.some((c) => isSame(c, f))),
    ]);
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
        {files.length > 0 && (
          <ul className={styles.files} aria-label="Attached files">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.file}>
                <span className={styles.fileMeta}>{fileKind(file)}</span>
                <span className={styles.fileName} title={file.name}>
                  {file.name}
                </span>
                <span className={styles.fileMeta}>{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
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
          <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={addFiles} />
          <button
            type="button"
            className={styles.attach}
            onClick={() => fileInput.current?.click()}
            title="Attach files"
            aria-label="Attach files"
          >
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
          <button type="button" className={styles.send} onClick={() => void send()} disabled={!canSend} aria-label="Send">
            ↑
          </button>
        </div>
      </div>
      {fileError && (
        <p className={styles.fileError} role="alert">
          <span aria-hidden>⚠</span> {fileError}
        </p>
      )}
      <p className={styles.estimate} aria-live="polite">
        {current && describeEstimate(current, translate)}
        {current && files.length > 0 && " Attached files aren't counted."}
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
