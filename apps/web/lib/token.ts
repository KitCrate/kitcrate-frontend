/**
 * SEP-41 tokens don't expose their decimals in the indexer's listing/agreement
 * payloads, so this assumes 7 decimals, the standard precision for Stellar
 * Asset Contract tokens (matches XLM). Confirm against the deployed token
 * contract's decimals() before using a token with different precision.
 */
export const TOKEN_DECIMALS = 7;

/** Converts a human decimal amount string (e.g. "65.00") to base units. */
export function toBaseUnits(amount: string): bigint {
  const [whole = "", fraction = ""] = amount.split(".");
  const normalizedWhole = whole === "" ? "0" : whole;
  const paddedFraction = (fraction + "0".repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS);
  return BigInt(normalizedWhole) * 10n ** BigInt(TOKEN_DECIMALS) + BigInt(paddedFraction);
}

/**
 * How long an owner has to raise a claim against the deposit after a rental
 * ends before release_funds becomes callable. Not yet configurable per
 * listing, so every booking uses this platform-wide default.
 */
export const DEFAULT_CLAIM_WINDOW_SECS = 259_200; // 3 days
