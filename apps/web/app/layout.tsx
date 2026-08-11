import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletProvider } from "@/lib/wallet-context";
import { bodyFont, displayFont, monoFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "KitCrate",
  description:
    "Rent tools and equipment peer to peer, secured by a deposit held in a non-custodial escrow contract.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <WalletProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
