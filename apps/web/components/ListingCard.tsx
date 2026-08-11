import type { Listing } from "@kitcrate/sdk";
import { formatCurrency } from "@/lib/format";
import { CheckoutTag } from "./CheckoutTag";

export function ListingCard({ listing }: { listing: Listing }) {
  const thumbnail = listing.imageUrls[0];

  return (
    <CheckoutTag href={`/listings/${listing.id}`} serial={listing.id} eyebrow={listing.category} title={listing.title}>
      <div className="flex flex-col gap-3">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote photo domain is backend-defined, not allowlisted
          <img src={thumbnail} alt={listing.title} className="h-36 w-full rounded object-cover" />
        ) : (
          <div className="flex h-36 w-full items-center justify-center rounded border border-dashed border-rivet text-xs uppercase tracking-wide text-charcoal/50">
            No photo
          </div>
        )}
        <p className="line-clamp-2 text-sm text-charcoal/70">{listing.description}</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm text-charcoal">{formatCurrency(listing.dailyRentalAmount)}/day</span>
          <span className="truncate text-xs text-charcoal/60">{listing.location}</span>
        </div>
      </div>
    </CheckoutTag>
  );
}
