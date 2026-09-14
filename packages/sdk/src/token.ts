import { rpc } from "@stellar/stellar-sdk";
import { decodeScVal } from "./xdr";

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

export interface GetTokenMetadataConfig {
  tokenContractId: string;
  rpcUrl: string;
}

/**
 * Reads a SEP-41 token's name/symbol/decimals directly from its own
 * contract instance storage, under the "METADATA" key every Stellar Asset
 * Contract (and SEP-41-compliant token) stores it at. Confirmed live
 * against the deployed escrow token, and cross-checked against `stellar
 * contract read`'s raw output: METADATA lives inside the single
 * ContractInstance ledger entry's own storage vec (same place a
 * RentalEscrow-style contract's Admin/Arbiter/Token instance keys live),
 * not as a separate persistent contract-data entry -- getContractData
 * (keyed lookups against separate persistent/temporary entries) 404s on
 * it; getContractInstance is the correct call. A plain ledger-state read
 * either way -- no transaction, no source account, no signature, unlike a
 * real contract invocation.
 *
 * Exists so the app never has to hardcode a token symbol: an earlier
 * version of the frontend assumed "USDC" unconditionally, which silently
 * went wrong once the deployed contract's escrow token turned out to be
 * native XLM (whose own symbol() reports "native", not "XLM" -- this
 * function returns that real value as-is, it does not relabel it).
 */
export async function getTokenMetadata(config: GetTokenMetadataConfig): Promise<TokenMetadata> {
  const server = new rpc.Server(config.rpcUrl);
  const instance = await server.getContractInstance(config.tokenContractId);
  const storage = instance.storage() ?? [];
  const metadataEntry = storage.find((entry) => decodeScVal(entry.key()) === "METADATA");
  const decoded = metadataEntry
    ? decodeScVal<Record<string, unknown>>(metadataEntry.val())
    : {};
  return {
    name: typeof decoded.name === "string" ? decoded.name : "",
    symbol: typeof decoded.symbol === "string" ? decoded.symbol : "",
    decimals: typeof decoded.decimal === "number" ? decoded.decimal : 7,
  };
}
