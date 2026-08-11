"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet,
  FreighterNotInstalledError,
  getConnectedAccount,
  watchWalletChanges,
  type WalletAccount,
} from "@kitcrate/sdk";

export type WalletStatus = "idle" | "connecting" | "connected" | "unavailable";

interface WalletContextValue {
  account: WalletAccount | null;
  status: WalletStatus;
  error: string | null;
  connect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getConnectedAccount().then((existing) => {
      if (!isMounted || !existing) return;
      setAccount(existing);
      setStatus("connected");
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "connected") return undefined;
    return watchWalletChanges((next) => {
      setAccount(next);
      setStatus(next ? "connected" : "idle");
    });
  }, [status]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const next = await connectWallet();
      setAccount(next);
      setStatus("connected");
    } catch (err) {
      if (err instanceof FreighterNotInstalledError) {
        setStatus("unavailable");
        setError("Freighter is not installed. Install the Freighter browser extension to connect a wallet.");
        return;
      }
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Could not connect the wallet.");
    }
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ account, status, error, connect }),
    [account, status, error, connect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider.");
  }
  return context;
}
