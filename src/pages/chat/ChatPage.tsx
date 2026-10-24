import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Chat, Stats } from "../api/types";
import { ChatInput } from "../components/ChatInput";
import { MessageList, PendingMessage } from "../components/MessageList";
import { StatCard } from "../components/StatCard";
import { TopBar } from "../components/TopBar";
import {
  formatCompact,
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatUsd,
  savedFraction,
} from "../lib/format";
import { greeting, LANGUAGES, STARTERS } from "../lib/languages";
import { href, navigate } from "../lib/router";
import { useApp } from "../lib/store";
import styles from "./ChatPage.module.css";

/** A new chat when `chatId` is missing, otherwise that conversation. */
export function ChatPage({ chatId }: { chatId?: string }) {
  return chatId ? <Conversation id={chatId} /> : <NewChat />;
}

function NewChat() {
  const { profile, model, weekStats, refresh } = useApp();
  const [hour] = useState(() => new Date().getHours());
  const language = profile?.languages[0] ?? "en";

  async function send(text: string, translate: boolean) {
    const chat = await api.sendMessage({ text, translate, model });
    await refresh();
    navigate(`/c/${chat.id}`);
  }

  return (
    <>
      <TopBar />
      <div className={styles.home}>
        <div className={styles.center}>
          <h2 className={styles.greeting} lang={language}>
            {profile && `${greeting(language, hour)}, ${profile.name}`}
          </h2>
          <ChatInput placeholder="Ask anything, in any language…" onSend={send} />
          {weekStats && <SavingsCards stats={weekStats} />}
          <div className={styles.chips}>
            {STARTERS[language].map((starter) => (
              <button
                key={starter}
                type="button"
                className={styles.chip}
                lang={language}
                onClick={() => void send(starter, profile?.translateByDefault ?? false)}
              >
                {starter}
              </button>
            ))}
            <a href={href("/lessons")} className={styles.chip}>
              See your language tax
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function SavingsCards({ stats }: { stats: Stats }) {
  const taxed = stats.byLanguage.filter((l) => l.language !== "en").slice(0, 3);

  return (
    <div className={styles.cards}>
      <StatCard
        to="/dashboard"
        label="Saved this week"
        value={formatCompact(stats.tokensWithout - stats.tokensWith)}
        unit="tokens"
        delta={{ text: `−${formatPercent(savedFraction(stats.tokensWith, stats.tokensWithout))} vs. sending as typed`, tone: "good" }}
      />
      <StatCard
        to="/dashboard"
        label="Without Optimaize"
        value={formatCompact(stats.tokensWithout)}
        unit="tokens"
        delta={{ text: `${formatUsd(stats.costWithout - stats.costWith)} saved this week` }}
      />
      <StatCard to="/dashboard" label="Your language tax (estimate)">
        <ul className={styles.taxList}>
          {taxed.map((l) => (
            <li key={l.language}>
              <span lang={l.language}>{LANGUAGES[l.language].native}</span>
              <span>{formatMultiplier(l.taxMultiplier)}</span>
            </li>
          ))}
          {taxed.length === 0 && <li>No non-English messages yet</li>}
        </ul>
      </StatCard>
    </div>
  );
}

function Conversation({ id }: { id: string }) {
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

  async function send(text: string, translate: boolean) {
    setPending(text);
    try {
      setChat(await api.sendMessage({ chatId: id, text, translate, model }));
      await refresh();
    } finally {
      setPending(null);
    }
  }

  async function upgrade(messageId: string, modelId: string) {
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
