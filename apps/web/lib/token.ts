import { getTokenMetadata } from "@kitcrate/sdk";

/**
 * SEP-41 tokens don't expose their decimals in the indexer's listing/agreement
 * payloads, so this assumes 7 decimals, the standard precision for Stellar
 * Asset Contract tokens (matches XLM). Confirm against the deployed token
 * contract's decimals() before using a token with different precision.
 */
export const TOKEN_DECIMALS = 7;

const tokenContractId = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID;
const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;

/**
 * The configured escrow token's real symbol, read live from the token
 * contract's own instance storage rather than assumed. Memoized at module
 * scope: every caller across a given server instance shares the same
 * in-flight or resolved promise instead of re-querying the RPC per
 * request. Falls back to the generic "tokens" if the app isn't configured
 * with a token contract, or if the read fails -- never to a specific,
 * possibly-wrong currency guess.
 *
 * This replaced a hardcoded "USDC" in lib/format.ts that silently drifted
 * out of sync once the deployed contract's escrow token turned out to be
 * native XLM. Note the real value this resolves to for the current
 * deployment is "native" (that token's own self-reported symbol, per
 * SEP-41), not "XLM" -- deliberately not relabeled here, see
 * getTokenMetadata's own doc comment for why.
 */
let symbolPromise: Promise<string> | null = null;

export function getTokenSymbolCached(): Promise<string> {
  if (!symbolPromise) {
    symbolPromise =
      tokenContractId && rpcUrl
        ? getTokenMetadata({ tokenContractId, rpcUrl })
            .then((metadata) => metadata.symbol || "tokens")
            .catch(() => "tokens")
        : Promise.resolve("tokens");
  }
  return symbolPromise;
}

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
