import { formatPercent, formatSaving } from "@/lib/format";
import styles from "./ui.module.css";

export function SavingsBadge({ fraction }: { fraction: number }) {
  return (
    <span className={styles.badge} aria-label={`Saved ${formatPercent(Math.max(0, fraction))}`}>
      {formatSaving(fraction)}
    </span>
  );
}
