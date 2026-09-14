"use client";

import { createContext, useContext, type ReactNode } from "react";

const TokenSymbolContext = createContext<string | null>(null);

/**
 * Makes the escrow token's real symbol (fetched once, server-side, in the
 * root layout -- see lib/token.ts's getTokenSymbolCached) available to
 * client components that have no server-rendered parent already holding
 * it as a prop. Most components should receive tokenSymbol as an explicit
 * prop from the page that fetched it instead; this context exists only
 * for a fully client-rendered page (apps/web/app/agreements/page.tsx)
 * with no such parent.
 */
export function TokenSymbolProvider({ symbol, children }: { symbol: string; children: ReactNode }) {
  return <TokenSymbolContext.Provider value={symbol}>{children}</TokenSymbolContext.Provider>;
}

export function useTokenSymbol(): string {
  const symbol = useContext(TokenSymbolContext);
  if (symbol === null) {
    throw new Error("useTokenSymbol must be used within a TokenSymbolProvider.");
  }
  return symbol;
}
