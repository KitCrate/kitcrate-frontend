import { IndexerApiError, type Listing } from "@kitcrate/sdk";
import { notFound } from "next/navigation";
import { BookingPanel } from "@/components/BookingPanel";
import { CheckoutTag } from "@/components/CheckoutTag";
import { formatCurrency, truncateMiddle } from "@/lib/format";
import { indexerClient } from "@/lib/indexer";

async function getListing(id: string): Promise<Listing | null> {
  if (!indexerClient) return null;
  try {
    return await indexerClient.getListing(id);
  } catch (error) {
    if (error instanceof IndexerApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="flex flex-col gap-6">
        {listing.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote photo domain is backend-defined, not allowlisted
          <img
            src={listing.imageUrls[0]}
            alt={listing.title}
            className="h-72 w-full rounded-md border border-rivet object-cover"
          />
        ) : null}
        <CheckoutTag serial={listing.id} eyebrow={listing.category} title={listing.title}>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-charcoal/80">{listing.description}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-charcoal/60">Daily rental</dt>
                <dd className="font-mono text-charcoal">{formatCurrency(listing.dailyRentalAmount)}</dd>
              </div>
              <div>
                <dt className="text-charcoal/60">Security deposit</dt>
                <dd className="font-mono text-deposit-green">{formatCurrency(listing.depositAmount)}</dd>
              </div>
              <div>
                <dt className="text-charcoal/60">Location</dt>
                <dd className="text-charcoal">{listing.location}</dd>
              </div>
              <div>
                <dt className="text-charcoal/60">Owner</dt>
                <dd className="font-mono text-charcoal">{truncateMiddle(listing.ownerAddress)}</dd>
              </div>
            </dl>
          </div>
        </CheckoutTag>
      </div>
      <BookingPanel listing={listing} />
    </div>
  );
}
