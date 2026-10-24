import { AUTO_MODEL } from "../api/types";
import { formatCompact } from "../lib/format";
import { href } from "../lib/router";
import { useApp } from "../lib/store";
import styles from "./shell.module.css";

export function TopBar({ title }: { title?: string }) {
  const { models, model, setModel, weekStats } = useApp();

  return (
    <header className={styles.topBar}>
      {title && <h1 className={styles.topTitle}>{title}</h1>}
      <select className={styles.select} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
        <option value={AUTO_MODEL}>Auto (cheapest that fits)</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <span className={styles.spacer} />
      {weekStats && (
        <a href={href("/dashboard")} className={styles.pill}>
          <span className={styles.pillValue}>{formatCompact(weekStats.tokensWithout - weekStats.tokensWith)}</span> saved
          this week
        </a>
      )}
    </header>
  );
}
