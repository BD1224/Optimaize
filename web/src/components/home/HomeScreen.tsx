"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Composer } from "@/components/composer/Composer";
import { TopBar } from "@/components/shell/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api/client";
import type { Stats } from "@/lib/api/types";
import { formatCompact, formatMultiplier, formatPercent, formatUsd, savedFraction } from "@/lib/format";
import { greeting, LANGUAGES, STARTERS } from "@/lib/languages";
import { useApp } from "@/lib/store";
import styles from "./home.module.css";

// The hour only exists in the browser, so the greeting renders after hydration.
const noSubscription = () => () => {};
const currentHour = () => new Date().getHours();
const noHourOnServer = () => null;

export function HomeScreen() {
  const router = useRouter();
  const { profile, model, weekStats, refresh } = useApp();
  const hour = useSyncExternalStore(noSubscription, currentHour, noHourOnServer);
  const language = profile?.languages[0] ?? "en";

  async function send(text: string, optimize: boolean) {
    const chat = await api.sendMessage({ text, optimize, model });
    await refresh();
    router.push(`/c/${chat.id}`);
  }

  return (
    <>
      <TopBar />
      <div className={styles.home}>
        <div className={styles.center}>
          <h2 className={styles.greeting} lang={language}>
            {profile && hour !== null && `${greeting(language, hour)}, ${profile.name}`}
          </h2>
          <Composer placeholder="Ask anything, in any language…" onSend={send} />
          {weekStats && <SavingsCards stats={weekStats} />}
          <div className={styles.chips}>
            {STARTERS[language].map((starter) => (
              <button
                key={starter}
                type="button"
                className={styles.chip}
                lang={language}
                onClick={() => void send(starter, profile?.optimizeByDefault ?? true)}
              >
                {starter}
              </button>
            ))}
            <Link href="/learn" className={styles.chip}>
              See your language tax
            </Link>
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
        href="/savings"
        label="Saved this week"
        value={formatCompact(stats.tokensWithout - stats.tokensWith)}
        unit="tokens"
        delta={{ text: `−${formatPercent(savedFraction(stats.tokensWith, stats.tokensWithout))} vs. sending as typed`, tone: "good" }}
      />
      <StatCard
        href="/savings"
        label="Without Optimaize"
        value={formatCompact(stats.tokensWithout)}
        unit="tokens"
        delta={{ text: `${formatUsd(stats.costWithout - stats.costWith)} saved this week` }}
      />
      <StatCard href="/savings" label="Your language tax (estimate)">
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
