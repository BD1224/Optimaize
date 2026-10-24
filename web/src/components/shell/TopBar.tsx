"use client";

import Link from "next/link";
import { formatCompact } from "@/lib/format";
import { useApp } from "@/lib/store";
import styles from "./shell.module.css";

export function TopBar({ title }: { title?: string }) {
  const { models, model, setModel, weekStats } = useApp();

  return (
    <header className={styles.topBar}>
      {title && <h1 className={styles.topTitle}>{title}</h1>}
      <select className={styles.select} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <span className={styles.spacer} />
      {weekStats && (
        <Link href="/savings" className={styles.pill}>
          <span className={styles.pillValue}>{formatCompact(weekStats.tokensWithout - weekStats.tokensWith)}</span> saved
          this week
        </Link>
      )}
    </header>
  );
}
