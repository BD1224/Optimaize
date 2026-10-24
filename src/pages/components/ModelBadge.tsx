import type { Model } from "../api/types";
import styles from "./ui.module.css";

/** Shows which model answered a message. */
export function ModelBadge({ modelId, models }: { modelId: string; models: Model[] }) {
  return <span className={styles.modelBadge}>{models.find((m) => m.id === modelId)?.name ?? modelId}</span>;
}
