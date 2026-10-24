import type { Model } from "../api/types";
import styles from "./ui.module.css";

interface UpgradeButtonProps {
  /** Model that wrote the current answer. */
  modelId: string;
  models: Model[];
  onUpgrade: (modelId: string) => void;
}

/** Re-answers the message on a bigger model. The backend learns from these choices. */
export function UpgradeButton({ modelId, models, onUpgrade }: UpgradeButtonProps) {
  const current = models.find((m) => m.id === modelId);
  const bigger = current ? models.filter((m) => m.inputPrice > current.inputPrice) : [];
  if (bigger.length === 0) return null;

  return (
    <select
      className={styles.upgrade}
      value=""
      onChange={(e) => e.target.value && onUpgrade(e.target.value)}
      aria-label="Upgrade this answer to a bigger model"
    >
      <option value="">Upgrade to…</option>
      {bigger.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
