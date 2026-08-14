import { StrKey, xdr } from "@stellar/stellar-sdk";

/**
 * Pure transaction-result and account-auth helpers. This module deliberately
 * imports nothing from this package so it can be unit-tested directly with
 * Node's type-stripping test runner (no build step, no relative imports).
 */

/**
 * Raised when the network rejects a submitted transaction with `txBadAuth`
 * ("signature does not authorize this operation"). For the RentalEscrow flows
 * the overwhelmingly common cause is an account configured as a multisig whose
 * medium threshold exceeds the signature weight of the single connected wallet
 * key. The wallet produces a cryptographically correct signature; the account
 * just requires more signature weight than one key provides.
 */
export class TransactionAuthError extends Error {
  public readonly resultCode: string;

  constructor(resultCode: string, message?: string) {
    super(
      message ??
        "The network rejected this transaction's signature (txBadAuth). The signing " +
          "account is likely configured as a multisig whose signature threshold is higher " +
          "than a single connected wallet key can satisfy. Sign with the account's other " +
          "signers, or lower the account's medium threshold.",
    );
    this.name = "TransactionAuthError";
    this.resultCode = resultCode;
  }
}

/**
 * Extracts the transaction result code name (e.g. `"txBadAuth"`, `"txSuccess"`)
 * from a Soroban RPC `sendTransaction` ERROR response's `errorResult`. The RPC
 * returns the result as a base64 XDR string, but the SDK's types describe it as
 * a parsed `TransactionResult`, so both are accepted. Returns null when the XDR
 * cannot be parsed.
 */
export function transactionResultCode(
  errorResult: string | xdr.TransactionResult,
): string | null {
  try {
    const result =
      typeof errorResult === "string"
        ? xdr.TransactionResult.fromXDR(errorResult, "base64")
        : errorResult;
    return result.result().switch().name;
  } catch {
    return null;
  }
}

/**
 * Returns the signature weight that `address`'s key carries on the account
 * described by `accountEntry`. The account's own key is its master key, whose
 * weight is the first byte of the thresholds array; any additional signers are
 * matched by key. Returns the strongest applicable weight.
 */
export function accountSignatureWeight(
  address: string,
  accountEntry: xdr.AccountEntry,
): number {
  // thresholds() is a 4-byte buffer: [masterWeight, low, med, high]
  const thresholds = accountEntry.thresholds();
  let weight = 0;

  // The master weight only belongs to the account's own key, not to a
  // different address being checked against this account.
  const accountId = StrKey.encodeEd25519PublicKey(
    accountEntry.accountId().ed25519(),
  );
  if (accountId === address) {
    weight = thresholds[0] ?? 0;
  }

  for (const signer of accountEntry.signers() ?? []) {
    const signerKey = signer.key().ed25519();
    if (signerKey && StrKey.encodeEd25519PublicKey(signerKey) === address) {
      weight = Math.max(weight, signer.weight());
    }
  }
  return weight;
}

/**
 * The account configuration that matters for authorizing a Soroban invocation:
 * the medium threshold (invocations require the medium threshold) and the
 * weight a given address's key can contribute.
 */
export interface AccountSignatureRequirement {
  /** The account's medium threshold; a Soroban invocation needs this much total signature weight. */
  mediumThreshold: number;
  /** The signature weight the given address's key can contribute to this account. */
  signerWeight: number;
}

/**
 * Computes the auth requirement for a single address on a raw account ledger
 * entry. When the address's weight can meet the threshold, a single wallet
 * signature is enough; otherwise the transaction will be rejected with
 * txBadAuth no matter how correctly it is built and signed.
 */
export function requirementFromAccountEntry(
  address: string,
  accountEntry: xdr.AccountEntry,
): AccountSignatureRequirement {
  const thresholds = accountEntry.thresholds();
  return {
    // thresholds(): [masterWeight, low, med, high]
    mediumThreshold: thresholds[2] ?? 0,
    signerWeight: accountSignatureWeight(address, accountEntry),
  };
}
