import Link from "next/link";
import { CheckoutTag } from "@/components/CheckoutTag";
import { ListingCard } from "@/components/ListingCard";
import { indexerClient } from "@/lib/indexer";
import type { Listing } from "@kitcrate/sdk";

async function getListings(): Promise<Listing[]> {
  if (!indexerClient) return [];
  try {
    return await indexerClient.listListings();
  } catch (error) {
    console.error("Failed to load listings from the indexer API.", error);
    return [];
  }
}

export default async function HomePage() {
  const listings = await getListings();

  return (
    <div className="flex flex-col gap-14">
      <section className="grid gap-10 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs uppercase tracking-widest text-charcoal/60">
            Peer to peer equipment rental
          </p>
          <h1 className="font-display text-4xl leading-none tracking-wide text-charcoal sm:text-5xl">
            Rent the tool. Skip the guesswork on the deposit.
          </h1>
          <p className="max-w-md text-base text-charcoal/80">
            Every KitCrate rental is backed by a security deposit held in a non-custodial escrow
            contract, not a promise. Owners get paid, renters get their deposit back,
            automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#listings"
              className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
            >
              Browse equipment
            </Link>
            <Link
              href="/listings/new"
              className="rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper"
            >
              List an item
            </Link>
          </div>
        </div>
        <CheckoutTag
          serial="KC-000482"
          eyebrow="Camera / Video"
          title="Sony FX3 Cinema Camera"
          status="active"
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-charcoal/60">Rental</dt>
              <dd className="font-mono text-charcoal">65.00 USDC/day</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Deposit</dt>
              <dd className="font-mono text-deposit-green">400.00 USDC</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Started</dt>
              <dd className="font-mono text-charcoal">Aug 4</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Returns</dt>
              <dd className="font-mono text-charcoal">Aug 11</dd>
            </div>
          </dl>
        </CheckoutTag>
      </section>

      <section id="listings" className="flex flex-col gap-6">
        <h2 className="font-display text-2xl tracking-wide text-charcoal">Available now</h2>
        {listings.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-rivet bg-paper px-6 py-12 text-center">
            <p className="font-display text-xl tracking-wide text-charcoal">No items listed yet.</p>
            <p className="mt-2 text-sm text-charcoal/70">List your first item to start renting it out.</p>
            <Link
              href="/listings/new"
              className="mt-4 inline-block rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
            >
              List an item
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
