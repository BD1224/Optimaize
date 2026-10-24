"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api/client";
import type { Stats } from "@/lib/api/types";
import { formatCompact, formatMultiplier, formatNumber, formatPercent, formatUsd, savedFraction } from "@/lib/format";
import { LANGUAGES } from "@/lib/languages";
import { useApp } from "@/lib/store";
import styles from "@/components/ui/page.module.css";

const DAY = 24 * 60 * 60 * 1000;
const RANGES = [
  { label: "This week", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: null },
];

export function SavingsScreen() {
  const { chats, models } = useApp();
  const [days, setDays] = useState<number | null>(7);
  const [stats, setStats] = useState<Stats | null>(null);

  // `chats` changes whenever a message is sent, so the numbers stay current.
  useEffect(() => {
    api.getStats(days === null ? 0 : Date.now() - days * DAY).then(setStats);
  }, [days, chats]);

  const modelName = (id: string) => models.find((m) => m.id === id)?.name ?? id;

  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <div className={styles.content}>
          <div>
            <h1 className={styles.title}>Your savings</h1>
            <p className={styles.lede}>
              Every number compares what you spent with Optimaize against sending the same messages as typed, after
              subtracting the tokens spent on translating. All figures are estimates until the backend is connected.
            </p>
          </div>

          <div className={styles.tabs} role="group" aria-label="Time range">
            {RANGES.map((range) => (
              <button
                key={range.label}
                type="button"
                className={styles.tab}
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>

          {stats && (
            <>
              <div className={styles.kpis}>
                <StatCard
                  label="Tokens saved"
                  value={formatCompact(stats.tokensWithout - stats.tokensWith)}
                  delta={{ text: `−${formatPercent(savedFraction(stats.tokensWith, stats.tokensWithout))} vs. as typed`, tone: "good" }}
                />
                <StatCard label="Without Optimaize" value={formatCompact(stats.tokensWithout)} unit="tokens" />
                <StatCard label="With Optimaize" value={formatCompact(stats.tokensWith)} unit="tokens" />
                <StatCard
                  label="Money saved"
                  value={formatUsd(stats.costWithout - stats.costWith)}
                  delta={{ text: `of ${formatUsd(stats.costWithout)} without Optimaize` }}
                />
              </div>

              <section>
                <h2 className={styles.heading}>By language</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th className={styles.num}>Replies</th>
                        <th className={styles.num}>Without</th>
                        <th className={styles.num}>With</th>
                        <th className={styles.num}>Saved</th>
                        <th className={styles.num}>Language tax (est.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byLanguage.map((row) => (
                        <tr key={row.language}>
                          <td lang={row.language}>{LANGUAGES[row.language].native}</td>
                          <td className={styles.num}>{formatNumber(row.messages)}</td>
                          <td className={styles.num}>{formatNumber(row.tokensWithout)}</td>
                          <td className={styles.num}>{formatNumber(row.tokensWith)}</td>
                          <td className={styles.num}>{formatPercent(savedFraction(row.tokensWith, row.tokensWithout))}</td>
                          <td className={styles.num}>{formatMultiplier(row.taxMultiplier)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h2 className={styles.heading}>By model</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className={styles.num}>Replies</th>
                        <th className={styles.num}>Without</th>
                        <th className={styles.num}>With</th>
                        <th className={styles.num}>Saved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byModel.map((row) => (
                        <tr key={row.model}>
                          <td>{modelName(row.model)}</td>
                          <td className={styles.num}>{formatNumber(row.messages)}</td>
                          <td className={styles.num}>{formatNumber(row.tokensWithout)}</td>
                          <td className={styles.num}>{formatNumber(row.tokensWith)}</td>
                          <td className={styles.num}>{formatPercent(savedFraction(row.tokensWith, row.tokensWithout))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.note}>A chart of savings over time comes next.</p>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
