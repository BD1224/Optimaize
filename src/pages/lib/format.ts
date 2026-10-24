const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const smallUsd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumSignificantDigits: 2 });

export const formatCompact = (n: number) => compact.format(n);
export const formatNumber = (n: number) => whole.format(n);
export const formatPercent = (fraction: number) => percent.format(fraction);
export const formatUsd = (n: number) => (Math.abs(n) < 0.01 ? smallUsd : usd).format(n);
export const formatMultiplier = (n: number) => `${n.toFixed(1)}×`;

/** Share of tokens saved, 0 to 1. */
export function savedFraction(withTokens: number, withoutTokens: number) {
  return withoutTokens > 0 ? (withoutTokens - withTokens) / withoutTokens : 0;
}

/** "−38%" when something was saved, "0%" otherwise. */
export function formatSaving(fraction: number) {
  return fraction >= 0.005 ? `−${formatPercent(fraction)}` : formatPercent(0);
}
