import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { TokenSymbolProvider } from "@/lib/token-symbol-context";
import { getTokenSymbolCached } from "@/lib/token";
import { WalletProvider } from "@/lib/wallet-context";
import { bodyFont, displayFont, monoFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "KitCrate",
  description:
    "Rent tools and equipment peer to peer, secured by a deposit held in a non-custodial escrow contract.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tokenSymbol = await getTokenSymbolCached();
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <TokenSymbolProvider symbol={tokenSymbol}>
          <WalletProvider>
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          </WalletProvider>
        </TokenSymbolProvider>
      </body>
    </html>
  );
}
