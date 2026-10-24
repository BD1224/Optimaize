import type { Message, Model, Usage } from "../api/types";
import { formatNumber, formatSaving, formatUsd, savedFraction } from "../lib/format";
import { ModelBadge } from "./ModelBadge";
import { UpgradeButton } from "./UpgradeButton";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  models: Model[];
  /** Open every "Sent as" disclosure instead of keeping them collapsed. */
  showSentAs: boolean;
  onUpgrade: (messageId: string, modelId: string) => void;
}

export function MessageList({ messages, models, showSentAs, onUpgrade }: MessageListProps) {
  return messages.map((message) =>
    message.role === "user" ? (
      <UserMessage key={message.id} message={message} showSentAs={showSentAs} />
    ) : (
      <div key={message.id}>
        <p className={styles.reply} lang={message.language}>
          {message.text}
        </p>
        {message.usage && (
          <Receipt usage={message.usage} models={models} onUpgrade={(modelId) => onUpgrade(message.id, modelId)} />
        )}
      </div>
    ),
  );
}

/** The user's message while it's being sent. */
export function PendingMessage({ text }: { text: string }) {
  return (
    <>
      <div className={styles.userMessage}>
        <div className={styles.bubble}>{text}</div>
      </div>
      <p className={styles.pending}>Sending…</p>
    </>
  );
}

function UserMessage({ message, showSentAs }: { message: Message; showSentAs: boolean }) {
  return (
    <div className={styles.userMessage}>
      <div className={styles.bubble} lang={message.language}>
        {message.text}
      </div>
      {message.sentAs && (
        <details className={styles.sentAs} open={showSentAs}>
          <summary>Sent as</summary>
          <p lang="en">{message.sentAs}</p>
        </details>
      )}
    </div>
  );
}

function Receipt({ usage, models, onUpgrade }: { usage: Usage; models: Model[]; onUpgrade: (modelId: string) => void }) {
  const fraction = savedFraction(usage.tokensWith, usage.tokensWithout);

  return (
    <div className={styles.receipt}>
      <span>
        <strong>{formatNumber(usage.tokensWith)}</strong> tokens vs {formatNumber(usage.tokensWithout)} without
        Optimaize
      </span>
      {fraction > 0 ? (
        <span className={styles.saved}>
          {formatSaving(fraction)}, {formatUsd(usage.costWithout - usage.costWith)} saved
        </span>
      ) : (
        <span>No savings on this one</span>
      )}
      <ModelBadge modelId={usage.model} models={models} />
      <UpgradeButton modelId={usage.model} models={models} onUpgrade={onUpgrade} />
    </div>
  );
}
