import type { ReactNode } from "react";
import { href as toHref } from "../lib/router";
import styles from "./ui.module.css";

interface StatCardProps {
  label: string;
  value?: string;
  unit?: string;
  /** Comparison line under the value. Use tone "good" only when it states a saving. */
  delta?: { text: string; tone?: "good" | "neutral" };
  /** Page to open when the card is clicked. */
  to?: string;
  children?: ReactNode;
}

export function StatCard({ label, value, unit, delta, to, children }: StatCardProps) {
  const body = (
    <>
      <span className={styles.label}>{label}</span>
      {value && (
        <span className={styles.value}>
          {value}
          {unit && <span className={styles.unit}>{unit}</span>}
        </span>
      )}
      {delta && (
        <span className={styles.delta} data-tone={delta.tone ?? "neutral"}>
          {delta.text}
        </span>
      )}
      {children}
    </>
  );

  return to ? (
    <a href={toHref(to)} className={styles.card}>
      {body}
    </a>
  ) : (
    <div className={styles.card}>{body}</div>
  );
}
