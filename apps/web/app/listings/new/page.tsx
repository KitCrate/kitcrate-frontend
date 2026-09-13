"use client";

import { IndexerApiError } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { ListingForm, type ListingFormValues } from "@/components/ListingForm";
import { indexerClient } from "@/lib/indexer";
import { createListingSigner } from "@/lib/listingSigner";
import { useWallet } from "@/lib/wallet-context";

export default function NewListingPage() {
  const router = useRouter();
  const { account, status: walletStatus, connect } = useWallet();

  async function handleSubmit(values: ListingFormValues) {
    if (!account) {
      await connect();
      return;
    }
    if (!indexerClient) {
      throw new Error("Listings are not available yet. The indexer service has not been configured.");
    }
    try {
      const listing = await indexerClient.createListing(
        {
          ownerAddress: account.address,
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

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal">List an item</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Set the daily rental rate and the security deposit renters will need to fund before
          pickup.
        </p>
      </div>

      {!account ? (
        <div className="rounded-md border border-dashed border-rivet bg-paper px-4 py-3 text-sm text-charcoal">
          Connect your wallet first. The listing is tied to the wallet address that owns it.
          <button
            type="button"
            onClick={() => connect()}
            className="ml-2 font-semibold text-amber underline-offset-2 hover:underline"
          >
            Connect wallet
          </button>
        </div>
      ) : null}

      {walletStatus === "unavailable" ? (
        <p className="text-sm text-charcoal">
          Freighter is not installed. Install the Freighter browser extension to list an item.
        </p>
      ) : null}

      <ListingForm
        submitLabel={account ? "List item" : "Connect wallet to list"}
        submittingLabel="Saving..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
