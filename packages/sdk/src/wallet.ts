import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  setAllowed,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

export interface WalletAccount {
  address: string;
  networkPassphrase: string;
}

export class FreighterNotInstalledError extends Error {
  constructor() {
    super("Freighter wallet extension is not installed.");
    this.name = "FreighterNotInstalledError";
  }
}

export class WalletConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletConnectionError";
  }
}

export async function isFreighterInstalled(): Promise<boolean> {
  const result = await isConnected();
  if (result.error) return false;
  return result.isConnected;
}

/**
 * Requests account access from Freighter and marks this origin as allowed.
 * Must be called from a user gesture (e.g. a "Connect wallet" button click).
 */
export async function connectWallet(): Promise<WalletAccount> {
  if (!(await isFreighterInstalled())) {
    throw new FreighterNotInstalledError();
  }

  const access = await requestAccess();
  if (access.error || !access.address) {
    throw new WalletConnectionError(
      access.error?.message ?? "Freighter did not grant access to an account.",
    );
  }

  await setAllowed();

  const network = await getNetworkDetails();
  if (network.error) {
    throw new WalletConnectionError(network.error.message);
  }

  return { address: access.address, networkPassphrase: network.networkPassphrase };
}

/**
 * Reads the currently connected account without prompting the user.
 * Returns null if Freighter is not installed or this origin has not been granted access yet.
 */
export async function getConnectedAccount(): Promise<WalletAccount | null> {
  const connected = await isConnected();
  if (connected.error || !connected.isConnected) return null;

  const account = await getAddress();
  if (account.error || !account.address) return null;

  const network = await getNetworkDetails();
  if (network.error) return null;

  return { address: account.address, networkPassphrase: network.networkPassphrase };
}

export interface SignXdrOptions {
  networkPassphrase: string;
  address: string;
}

/**
 * Sends a built (unsigned) transaction envelope XDR to Freighter for user signature.
 * Returns the signed transaction XDR ready for submission via Soroban RPC.
 */
export async function signXdr(
  transactionXdr: string,
  opts: SignXdrOptions,
): Promise<string> {
  const result = await signTransaction(transactionXdr, opts);
  if (result.error) {
    throw new WalletConnectionError(result.error.message);
  }
  return result.signedTxXdr;
}

export type WalletChangeListener = (account: WalletAccount | null) => void;

/**
 * Polls Freighter for address and network changes (e.g. the user switches accounts
 * or networks in the extension) and invokes the callback with the current state.
 * Returns an unsubscribe function.
 */
export function watchWalletChanges(
  onChange: WalletChangeListener,
  pollIntervalMs = 3000,
): () => void {
  const watcher = new WatchWalletChanges(pollIntervalMs);
  watcher.watch((params) => {
    if (params.error || !params.address) {
      onChange(null);
      return;
    }
    onChange({ address: params.address, networkPassphrase: params.networkPassphrase });
  });
  return () => watcher.stop();
}
