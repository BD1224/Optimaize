"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Composer } from "@/components/composer/Composer";
import { TopBar } from "@/components/shell/TopBar";
import { api } from "@/lib/api/client";
import type { Chat, Message, Model, Usage } from "@/lib/api/types";
import { formatNumber, formatPercent, formatSaving, formatUsd, savedFraction } from "@/lib/format";
import { useApp } from "@/lib/store";
import styles from "./chat.module.css";

export function ChatScreen({ id }: { id: string }) {
  const { chats, model, models, profile, refresh } = useApp();
  // undefined while loading, null if the chat doesn't exist.
  const [chat, setChat] = useState<Chat | null | undefined>(undefined);
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChat(id).then(setChat);
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat, pending]);

  // Prefer the sidebar's copy so renames show up here immediately.
  const title = chats.find((c) => c.id === id)?.title ?? chat?.title;

  async function send(text: string, optimize: boolean) {
    setPending(text);
    try {
      setChat(await api.sendMessage({ chatId: id, text, optimize, model }));
      await refresh();
    } finally {
      setPending(null);
    }
  }

  async function rerun(messageId: string, modelId: string) {
    const next = await api.rerun(messageId, modelId);
    if (!next) return;
    setChat(next);
    await refresh();
  }

  if (chat === null) {
    return (
      <>
        <TopBar />
        <p className={styles.missing}>
          This chat doesn&apos;t exist anymore. <Link href="/">Start a new one</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <TopBar title={title} />
      <div className={styles.messages}>
        <div className={styles.column}>
          {chat?.messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} message={message} openSentAs={profile?.showSentAs ?? false} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                models={models}
                onRerun={(modelId) => rerun(message.id, modelId)}
              />
            ),
          )}
          {pending && (
            <>
              <div className={styles.userMessage}>
                <div className={styles.bubble}>{pending}</div>
              </div>
              <p className={styles.pending}>Optimizing and sending…</p>
            </>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <div className={styles.footer}>
        <Composer placeholder="Reply…" onSend={send} />
        {chat && <ConversationTotal chat={chat} />}
      </div>
    </>
  );
}

function UserMessage({ message, openSentAs }: { message: Message; openSentAs: boolean }) {
  return (
    <div className={styles.userMessage}>
      <div className={styles.bubble} lang={message.language}>
        {message.text}
      </div>
      {message.sentAs && (
        <details className={styles.sentAs} open={openSentAs}>
          <summary>Sent as</summary>
          <p lang="en">{message.sentAs}</p>
        </details>
      )}
    </div>
  );
}

function AssistantMessage({
  message,
  models,
  onRerun,
}: {
  message: Message;
  models: Model[];
  onRerun: (modelId: string) => void;
}) {
  return (
    <div>
      <p className={styles.reply} lang={message.language}>
        {message.text}
      </p>
      {message.usage && <Receipt usage={message.usage} models={models} onRerun={onRerun} />}
    </div>
  );
}

function Receipt({ usage, models, onRerun }: { usage: Usage; models: Model[]; onRerun: (modelId: string) => void }) {
  const fraction = savedFraction(usage.tokensWith, usage.tokensWithout);
  const current = models.find((m) => m.id === usage.model);
  const bigger = current ? models.filter((m) => m.inputPrice > current.inputPrice) : [];

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
      <span>{current?.name ?? usage.model}</span>
      {bigger.length > 0 && (
        <select
          className={styles.rerun}
          value=""
          onChange={(e) => e.target.value && onRerun(e.target.value)}
          aria-label="Rerun on a bigger model"
        >
          <option value="">Rerun on…</option>
          {bigger.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ConversationTotal({ chat }: { chat: Chat }) {
  let withTokens = 0;
  let withoutTokens = 0;
  for (const message of chat.messages) {
    withTokens += message.usage?.tokensWith ?? 0;
    withoutTokens += message.usage?.tokensWithout ?? 0;
  }
  if (withoutTokens === 0) return null;

  return (
    <p className={styles.total}>
      This chat: {formatNumber(withTokens)} tokens, saved {formatNumber(withoutTokens - withTokens)} (
      {formatPercent(savedFraction(withTokens, withoutTokens))})
    </p>
  );
}
