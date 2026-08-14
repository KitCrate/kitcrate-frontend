"use client";

import type { Agreement } from "@kitcrate/sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutTag, type CheckoutTagStatus } from "@/components/CheckoutTag";
import { formatRawTokenAmount, formatShortDate } from "@/lib/format";
import { indexerClient } from "@/lib/indexer";
import { useWallet } from "@/lib/wallet-context";

function toTagStatus(status: Agreement["status"]): CheckoutTagStatus {
  return status.toLowerCase() as CheckoutTagStatus;
}

function AgreementRow({ agreement, role }: { agreement: Agreement; role: "owner" | "renter" }) {
  return (
    <CheckoutTag
      href={`/agreements/${agreement.id}`}
      serial={agreement.id}
      eyebrow={role === "owner" ? "You're the owner" : "You're the renter"}
      title="Rental agreement"
      status={toTagStatus(agreement.status)}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="col-span-2 min-w-0">
          <dt className="text-charcoal/60">Item</dt>
          <dd className="truncate font-mono text-charcoal">{agreement.itemRef}</dd>
        </div>
        <div>
          <dt className="text-charcoal/60">Rental</dt>
          <dd className="font-mono text-charcoal">{formatRawTokenAmount(agreement.rentalAmount)}</dd>
        </div>
        <div>
          <dt className="text-charcoal/60">Deposit</dt>
          <dd className="font-mono text-deposit-green">{formatRawTokenAmount(agreement.depositAmount)}</dd>
        </div>
        <div>
          <dt className="text-charcoal/60">Starts</dt>
          <dd className="font-mono text-charcoal">{formatShortDate(agreement.startTime)}</dd>
        </div>
        <div>
          <dt className="text-charcoal/60">Ends</dt>
          <dd className="font-mono text-charcoal">{formatShortDate(agreement.endTime)}</dd>
        </div>
      </dl>
    </CheckoutTag>
  );
}

function AgreementSection({
  title,
  emptyMessage,
  emptyHref,
  emptyLabel,
  agreements,
  role,
}: {
  title: string;
  emptyMessage: string;
  emptyHref: string;
  emptyLabel: string;
  agreements: Agreement[];
  role: "owner" | "renter";
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl tracking-wide text-charcoal">{title}</h2>
      {agreements.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {agreements.map((agreement) => (
            <AgreementRow key={agreement.id} agreement={agreement} role={role} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-rivet bg-paper px-6 py-10 text-center">
          <p className="text-sm text-charcoal/70">{emptyMessage}</p>
          <Link
            href={emptyHref}
            className="mt-3 inline-block rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
          >
            {emptyLabel}
          </Link>
        </div>
      )}
    </section>
  );
}

export default function AgreementsPage() {
  const { account, status: walletStatus, connect } = useWallet();
  const [owned, setOwned] = useState<Agreement[]>([]);
  const [rented, setRented] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account || !indexerClient) return;
    const client = indexerClient;
    const address = account.address;
    let cancelled = false;

    async function loadAgreements() {
      setLoading(true);
      setError(null);
      try {
        const [ownerResults, renterResults] = await Promise.all([
          client.listAgreements({ owner: address }),
          client.listAgreements({ renter: address }),
        ]);
        if (cancelled) return;
        setOwned(ownerResults);
        setRented(renterResults);
      } catch {
        if (!cancelled) setError("Could not load your agreements. Refresh the page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAgreements();

    return () => {
      cancelled = true;
    };
  }, [account]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal">My agreements</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Everything you are renting and everything you have listed out, in one place.
        </p>
      </div>

      {!account ? (
        <div className="rounded-md border border-dashed border-rivet bg-paper px-6 py-10 text-center">
          <p className="text-sm text-charcoal/70">Connect your wallet to see your agreements.</p>
          <button
            type="button"
            onClick={() => connect()}
            className="mt-3 rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
          >
            Connect wallet
          </button>
          {walletStatus === "unavailable" ? (
            <p className="mt-3 text-sm text-charcoal">
              Freighter is not installed. Install the Freighter browser extension to continue.
            </p>
          ) : null}
        </div>
      ) : loading ? (
        <p className="text-sm text-charcoal/70">Loading your agreements...</p>
      ) : error ? (
        <p className="text-sm text-charcoal">{error}</p>
      ) : (
        <>
          <AgreementSection
            title="Renting"
            emptyMessage="You are not renting anything yet."
            emptyHref="/"
            emptyLabel="Browse equipment"
            agreements={rented}
            role="renter"
          />
          <AgreementSection
            title="Listed by you"
            emptyMessage="None of your listings have an agreement yet."
            emptyHref="/listings/new"
            emptyLabel="List an item"
            agreements={owned}
            role="owner"
          />
        </>
      )}
    </div>
  );
}
