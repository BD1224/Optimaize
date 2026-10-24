import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

interface StatCardProps {
  label: string;
  value?: string;
  unit?: string;
  /** Comparison line under the value. Use tone "good" only when it states a saving. */
  delta?: { text: string; tone?: "good" | "neutral" };
  href?: string;
  children?: ReactNode;
}

export function StatCard({ label, value, unit, delta, href, children }: StatCardProps) {
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

  return href ? (
    <Link href={href} className={styles.card}>
      {body}
    </Link>
  ) : (
    <div className={styles.card}>{body}</div>
  );
}
