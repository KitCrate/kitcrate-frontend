import { requireRentalEscrowClient } from "@/lib/contract";

/**
 * Checks whether the connected wallet's single key can authorize a Soroban
 * invocation from `address` by itself, before ever prompting a signature.
 * A Soroban invocation needs total signer weight meeting the account's
 * medium threshold; a single key on a multisig account can fall short,
 * in which case the network rejects an otherwise correctly built and
 * signed transaction with txBadAuth. Checking first means a multisig user
 * gets a clear explanation instead of a signing prompt for a transaction
 * that was always going to fail.
 *
 * Returns a user-facing message when the connected key isn't sufficient,
 * or null when it is (including the common case of a plain, non-multisig
 * account, where getAccountSignatureRequirement returns null).
 *
 * Used by every write flow that builds a transaction from a connected
 * wallet's own address (AgreementActions.tsx's shared hook, BookingPanel,
 * ClaimForm) so the check is identical everywhere rather than
 * reimplemented per component -- the gap this closes (Phase 1 audit
 * P1-4) was exactly two call sites skipping it, not the logic itself
 * being wrong.
 */
export async function checkMultisigRequirement(address: string): Promise<string | null> {
  const client = requireRentalEscrowClient();
  const requirement = await client.getAccountSignatureRequirement(address);
  if (requirement && requirement.signerWeight < requirement.mediumThreshold) {
    return (
      `Your wallet can't authorize this by itself: this account is a multisig with ` +
      `a signature threshold of ${requirement.mediumThreshold}, but your connected key ` +
      `only carries weight ${requirement.signerWeight}. Sign with the account's other ` +
      `signers, or lower the account's medium threshold.`
    );
  }
  return null;
}
