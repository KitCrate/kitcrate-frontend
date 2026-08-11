const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Amounts returned by the indexer API are human-readable decimal strings
 * (e.g. "65.00"), already converted from the token's base units server-side.
 * The token symbol is assumed to be USDC for v1, since that is the only
 * SEP-41 token this app is configured against (NEXT_PUBLIC_TOKEN_CONTRACT_ID).
 */
export function formatCurrency(amount: string): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} USDC`;
  return `${currencyFormatter.format(value)} USDC`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function truncateMiddle(value: string, visible = 4): string {
  if (value.length <= visible * 2 + 3) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
