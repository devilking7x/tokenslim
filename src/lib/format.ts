export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtPct(frac: number): string {
  return `${(frac * 100).toFixed(1)}%`;
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/** Cost for a token volume at a per-1M price. */
export function costFor(tokens: number, per1M: number): number {
  return (tokens / 1_000_000) * per1M;
}
