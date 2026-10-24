"use client";

import Link from "next/link";
import { formatCompact, formatPercent, savedFraction } from "@/lib/format";
import { useApp } from "@/lib/store";
import styles from "./shell.module.css";

export function SavingsMeter() {
  const { weekStats } = useApp();
  if (!weekStats) return null;

  const fraction = savedFraction(weekStats.tokensWith, weekStats.tokensWithout);
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <Link href="/savings" className={styles.meterCard}>
      <div className={styles.meterHead}>
        <span>Saved this week</span>
        <span>{formatPercent(fraction)}</span>
      </div>
      <div
        className={styles.meterTrack}
        role="meter"
        aria-label="Share of tokens saved this week"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={styles.meterFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.meterValue}>{formatCompact(weekStats.tokensWithout - weekStats.tokensWith)} tokens</div>
    </Link>
  );
}
