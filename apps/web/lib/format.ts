const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an already-decimal, human-readable amount (e.g. "5.00") as
 * "5.00 USDC". Pass values that are NOT in the token's smallest unit:
 * listing amounts (Listing.dailyRentalAmount, Listing.depositAmount, stored
 * as plain decimals in the backend listings table) and user-entered amounts
 * (e.g. the claim form input). For raw on-chain values in the token's
 * smallest unit, use formatRawTokenAmount instead.
 */
export function formatCurrency(amount: string): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} USDC`;
  return `${currencyFormatter.format(value)} USDC`;
}

/**
 * Stellar SEP-41 tokens (including the native XLM Stellar Asset Contract used
 * as USDC-equivalent in this v1 build) use 7 decimal places, so raw values
 * are divided by 10_000_000 here. The token symbol is assumed to be USDC for
 * v1, since that is the only SEP-41 token this app is configured against
 * (NEXT_PUBLIC_TOKEN_CONTRACT_ID).
 */
const TOKEN_DECIMALS = 7;

/**
 * Formats a raw on-chain amount, in the token's smallest unit (matching the
 * RentalEscrow contract's i128 storage), as a human-readable "90.00 USDC"
 * string. Use this for agreement amounts (Agreement.rentalAmount,
 * Agreement.depositAmount) as served by the indexer API, which are raw
 * values not yet divided down. For already-decimal values (listings, user
 * input), use formatCurrency instead.
 */
export function formatRawTokenAmount(rawAmount: string): string {
  const raw = Number(rawAmount);
  if (Number.isNaN(raw)) return `${rawAmount} USDC`;
  const value = raw / 10 ** TOKEN_DECIMALS;
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
