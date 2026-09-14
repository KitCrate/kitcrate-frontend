const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an already-decimal, human-readable amount (e.g. "5.00") as
 * "5.00 <symbol>". Pass values that are NOT in the token's smallest unit:
 * listing amounts (Listing.dailyRentalAmount, Listing.depositAmount, stored
 * as plain decimals in the backend listings table) and user-entered amounts
 * (e.g. the claim form input). For raw on-chain values in the token's
 * smallest unit, use formatRawTokenAmount instead.
 *
 * `symbol` is the escrow token's real, live-read symbol (see
 * lib/token.ts's getTokenSymbolCached), not a hardcoded guess -- an
 * earlier version of this function hardcoded "USDC" unconditionally,
 * which silently went wrong once the deployed contract's token turned out
 * to be native XLM.
 */
export function formatCurrency(amount: string, symbol: string): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ${symbol}`;
  return `${currencyFormatter.format(value)} ${symbol}`;
}

/**
 * Stellar SEP-41 tokens use 7 decimal places (this repo's current
 * deployment, native XLM, included), so raw values are divided by
 * 10_000_000 here. See apps/web/lib/token.ts's TOKEN_DECIMALS for the
 * same assumption and its own caveat about confirming it live.
 */
const TOKEN_DECIMALS = 7;

/**
 * Formats a raw on-chain amount, in the token's smallest unit (matching the
 * RentalEscrow contract's i128 storage), as a human-readable "90.00
 * <symbol>" string. Use this for agreement amounts (Agreement.rentalAmount,
 * Agreement.depositAmount) as served by the indexer API, which are raw
 * values not yet divided down. For already-decimal values (listings, user
 * input), use formatCurrency instead. See formatCurrency's doc comment for
 * what `symbol` should be.
 */
export function formatRawTokenAmount(rawAmount: string, symbol: string): string {
  const raw = Number(rawAmount);
  if (Number.isNaN(raw)) return `${rawAmount} ${symbol}`;
  const value = raw / 10 ** TOKEN_DECIMALS;
  return `${currencyFormatter.format(value)} ${symbol}`;
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
