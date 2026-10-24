import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Attachment, Chat } from "../api/types";
import { ChatInput } from "../components/ChatInput";
import { MessageList, PendingMessage } from "../components/MessageList";
import { TopBar } from "../components/TopBar";
import { formatNumber, formatPercent, savedFraction } from "../lib/format";
import { HELLO } from "../lib/languages";
import { href, navigate } from "../lib/router";
import { useApp } from "../lib/store";
import styles from "./ChatPage.module.css";

/** A new chat when `chatId` is missing, otherwise that conversation. */
export function ChatPage({ chatId }: { chatId?: string }) {
  return chatId ? <Conversation id={chatId} /> : <NewChat />;
}

function NewChat() {
  const { profile, model, refresh } = useApp();
  // The first language picked in Settings. The greeting says hello in it.
  const language = profile?.languages[0] ?? "en";

  async function send(text: string, translate: boolean, attachments: Attachment[]) {
    // PROMPT: the first message of a new chat goes to the backend here, with any attached files.
    const chat = await api.sendMessage({ text, translate, model, attachments });
    await refresh();
    navigate(`/c/${chat.id}`);
  }

  return (
    <>
      <TopBar />
      <div className={styles.home}>
        <div className={styles.center}>
          <h2 className={styles.greeting} lang={language}>
            {profile && `${HELLO[language]}, ${profile.name}`}
          </h2>
          <ChatInput placeholder="Ask anything, in any language…" onSend={send} />
        </div>
      </div>
    </>
  );
}

function Conversation({ id }: { id: string }) {
  const { chats, model, models, profile, refresh } = useApp();
  // undefined while loading, null if the chat doesn't exist.
  const [chat, setChat] = useState<Chat | null | undefined>(undefined);
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // BACKEND: loads one chat's messages and their token receipts.
    api.getChat(id).then(setChat);
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat, pending]);

  // Prefer the sidebar's copy so renames show up here immediately.
  const title = chats.find((c) => c.id === id)?.title ?? chat?.title;

  async function send(text: string, translate: boolean, attachments: Attachment[]) {
    setPending(text || attachments.map((a) => a.name).join(", "));
    try {
      // PROMPT: a reply in an existing chat goes to the backend here, with any attached files.
      setChat(await api.sendMessage({ chatId: id, text, translate, model, attachments }));
      await refresh();
    } finally {
      setPending(null);
    }
  }

  async function upgrade(messageId: string, modelId: string) {
    // BACKEND: asks the same message again on a bigger model (Upgrade button).
    const next = await api.upgradeMessage(messageId, modelId);
    if (!next) return;
    setChat(next);
    await refresh();
  }

  if (chat === null) {
    return (
      <>
        <TopBar />
        <p className={styles.missing}>
          This chat doesn&apos;t exist anymore. <a href={href("/")}>Start a new one</a>
        </p>
      </>
    );
  }

  return (
    <>
      <TopBar title={title} />
      <div className={styles.messages}>
        <div className={styles.column}>
          {chat && (
            <MessageList
              messages={chat.messages}
              models={models}
              showSentAs={profile?.showSentAs ?? false}
              onUpgrade={upgrade}
            />
          )}
          {pending && <PendingMessage text={pending} />}
          <div ref={endRef} />
        </div>
      </div>
      <div className={styles.footer}>
        <ChatInput placeholder="Reply…" onSend={send} />
        {chat && <ConversationTotal chat={chat} />}
      </div>
    </>
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
