const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const smallUsd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumSignificantDigits: 2 });
const kilobytes = new Intl.NumberFormat(undefined, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 });
const megabytes = new Intl.NumberFormat(undefined, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });

export const formatCompact = (n: number) => compact.format(n);
export const formatNumber = (n: number) => whole.format(n);
export const formatPercent = (fraction: number) => percent.format(fraction);
export const formatUsd = (n: number) => (Math.abs(n) < 0.01 ? smallUsd : usd).format(n);
export const formatMultiplier = (n: number) => `${n.toFixed(1)}×`;

/** A file size: "12 kB", "3.4 MB". */
export function formatBytes(bytes: number) {
  const mb = 1024 * 1024;
  return bytes < mb ? kilobytes.format(Math.max(1, Math.round(bytes / 1024))) : megabytes.format(bytes / mb);
}

/** Share of tokens saved, 0 to 1. */
export function savedFraction(withTokens: number, withoutTokens: number) {
  return withoutTokens > 0 ? (withoutTokens - withTokens) / withoutTokens : 0;
}

/** "−38%" when something was saved, "0%" otherwise. */
export function formatSaving(fraction: number) {
  return fraction >= 0.005 ? `−${formatPercent(fraction)}` : formatPercent(0);
}
