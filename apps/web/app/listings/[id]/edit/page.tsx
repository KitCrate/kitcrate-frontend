"use client";

import { IndexerApiError, type Listing } from "@kitcrate/sdk";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ListingForm, type ListingFormValues } from "@/components/ListingForm";
import { indexerClient } from "@/lib/indexer";
import { createListingSigner } from "@/lib/listingSigner";
import { useWallet } from "@/lib/wallet-context";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { account, status: walletStatus } = useWallet();

  const [listing, setListing] = useState<Listing | null | undefined>(() =>
    indexerClient ? undefined : null,
  );

  useEffect(() => {
    if (!indexerClient) return;
    let cancelled = false;
    indexerClient
      .getListing(id)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch(() => {
        // A 404 means the listing genuinely doesn't exist; any other
        // failure (offline, indexer down) is treated the same way here
        // since this page has no separate "retry" affordance -- notFound()
        // is a reasonable fallback either way.
        if (cancelled) return;
        setListing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(values: ListingFormValues) {
    if (!account || !listing) return;
    if (!indexerClient) {
      throw new Error("Listings are not available yet. The indexer service has not been configured.");
    }
    try {
      await indexerClient.updateListing(
        listing.id,
        {
          ownerAddress: listing.ownerAddress,
          title: values.title,
          description: values.description,
          dailyRentalAmount: values.dailyRentalAmount,
          depositAmount: values.depositAmount,
          location: values.location,
          imageUrls: values.imageUrl ? [values.imageUrl] : [],
        },
        createListingSigner(account),
      );
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      if (err instanceof IndexerApiError) {
        throw new Error(`The listing was not saved. ${err.message}`);
      }
      throw new Error("The listing was not saved. Check your connection and try again.");
    }
  }

  // Still loading.
  if (listing === undefined) {
    return <p className="text-sm text-charcoal/70">Loading...</p>;
  }

  if (listing === null) {
    notFound();
  }

  if (!account) {
    return (
      <p className="text-sm text-charcoal">
        Connect the wallet that owns this listing to edit it.
      </p>
    );
  }

  if (account.address !== listing.ownerAddress) {
    return (
      <p className="text-sm text-charcoal">
        Only this listing&apos;s owner can edit it. The connected wallet doesn&apos;t match.
      </p>
    );
  }

  if (walletStatus === "unavailable") {
    return (
      <p className="text-sm text-charcoal">
        Freighter is not installed. Install the Freighter browser extension to edit this listing.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal">Edit listing</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Changes are saved once you confirm with your wallet.
        </p>
      </div>
      <ListingForm
        initial={{
          title: listing.title,
          description: listing.description,
          dailyRentalAmount: listing.dailyRentalAmount,
          depositAmount: listing.depositAmount,
          location: listing.location,
          imageUrl: listing.imageUrls[0] ?? "",
        }}
        submitLabel="Save changes"
        submittingLabel="Saving..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
