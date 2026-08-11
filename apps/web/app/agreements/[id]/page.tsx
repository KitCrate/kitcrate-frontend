import { IndexerApiError, type Agreement, type AgreementEvent, type Listing } from "@kitcrate/sdk";
import { notFound } from "next/navigation";
import { CancelAgreementButton, ReleaseFundsButton } from "@/components/AgreementActions";
import { AgreementStatusTag } from "@/components/AgreementStatusTag";
import { ClaimForm } from "@/components/ClaimForm";
import { formatCurrency, formatDate, truncateMiddle } from "@/lib/format";
import { indexerClient } from "@/lib/indexer";

async function getAgreement(id: string): Promise<Agreement | null> {
  if (!indexerClient) return null;
  try {
    return await indexerClient.getAgreement(id);
  } catch (error) {
    if (error instanceof IndexerApiError && error.status === 404) return null;
    throw error;
  }
}

async function getAgreementEvents(id: string): Promise<AgreementEvent[]> {
  if (!indexerClient) return [];
  try {
    return await indexerClient.getAgreementEvents(id);
  } catch {
    return [];
  }
}

async function getListing(itemRef: string): Promise<Listing | null> {
  if (!indexerClient) return null;
  try {
    return await indexerClient.getListing(itemRef);
  } catch {
    return null;
  }
}

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agreement = await getAgreement(id);
  if (!agreement) notFound();

  const [events, listing] = await Promise.all([
    getAgreementEvents(id),
    getListing(agreement.itemRef),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-charcoal/60">Agreement</p>
        <h1 className="font-display text-3xl tracking-wide text-charcoal">
          {listing ? listing.title : `Item ${agreement.itemRef}`}
        </h1>
      </div>

      <AgreementStatusTag agreement={agreement} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-rivet bg-paper p-5">
          <h2 className="font-display text-lg tracking-wide text-charcoal">Terms</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-charcoal/60">Rental</dt>
              <dd className="font-mono text-charcoal">{formatCurrency(agreement.rentalAmount)}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Deposit</dt>
              <dd className="font-mono text-deposit-green">{formatCurrency(agreement.depositAmount)}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Starts</dt>
              <dd className="font-mono text-charcoal">{formatDate(agreement.startTime)}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Ends</dt>
              <dd className="font-mono text-charcoal">{formatDate(agreement.endTime)}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Owner</dt>
              <dd className="font-mono text-charcoal">{truncateMiddle(agreement.owner)}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Renter</dt>
              <dd className="font-mono text-charcoal">{truncateMiddle(agreement.renter)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-charcoal/60">Claim window after rental ends</dt>
              <dd className="font-mono text-charcoal">
                {Math.round(agreement.claimWindowSecs / 3600)} hours
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-rivet bg-paper p-5">
          <h2 className="font-display text-lg tracking-wide text-charcoal">History</h2>
          {events.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {events.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-charcoal">{event.type}</span>
                  <span className="font-mono text-xs text-charcoal/60">
                    {formatDate(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-charcoal/70">No onchain events recorded yet.</p>
          )}
        </div>
      </div>

      <ClaimForm agreement={agreement} />
      <ReleaseFundsButton agreement={agreement} />
      <CancelAgreementButton agreement={agreement} />
    </div>
  );
}
