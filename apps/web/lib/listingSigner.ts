import { signMessage, type ListingSigner, type WalletAccount } from "@kitcrate/sdk";

/**
 * Builds the ListingSigner IndexerClient's createListing/updateListing/
 * deleteListing methods need, backed by the connected Freighter wallet's
 * SEP-53 message signing (see wallet.ts). Kept as one shared helper so
 * every listing-mutation call site builds the signer identically.
 */
export function createListingSigner(account: WalletAccount): ListingSigner {
  return {
    address: account.address,
    sign: (message) => signMessage(message, { address: account.address, networkPassphrase: account.networkPassphrase }),
  };
}
