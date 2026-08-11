import Link from "next/link";
import { WalletConnectButton } from "./WalletConnectButton";

const navLinks = [
  { href: "/", label: "Browse" },
  { href: "/listings/new", label: "List an item" },
  { href: "/agreements", label: "My agreements" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-rivet bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl tracking-wide text-charcoal">
          KITCRATE
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-charcoal sm:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-amber">
              {link.label}
            </Link>
          ))}
        </nav>
        <WalletConnectButton />
      </div>
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-rivet px-4 py-2 text-sm font-medium text-charcoal sm:hidden">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="whitespace-nowrap">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
