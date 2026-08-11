"use client";

import { useWallet } from "@/lib/wallet-context";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { account, status, error, connect } = useWallet();

  if (account) {
    return (
      <span className="rounded-full border border-rivet bg-paper px-3 py-1.5 font-mono text-sm text-charcoal">
        {truncateAddress(account.address)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => connect()}
        disabled={status === "connecting"}
        className="rounded-full bg-amber px-4 py-1.5 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting..." : "Connect wallet"}
      </button>
      {error ? (
        <span className="max-w-[220px] text-right text-xs text-charcoal/70">{error}</span>
      ) : null}
    </div>
  );
}
