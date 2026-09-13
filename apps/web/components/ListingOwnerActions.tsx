"use client";

import type { Listing } from "@kitcrate/sdk";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requireIndexerClient } from "@/lib/indexer";
import { createListingSigner } from "@/lib/listingSigner";
import { useWallet } from "@/lib/wallet-context";

type DeleteStep = "idle" | "confirm" | "deleting" | "error";

/**
 * Edit/delete controls for a listing's owner. Renders nothing for anyone
 * else — the same "eligible or not rendered at all" convention
 * AgreementActions.tsx already uses for agreement-lifecycle buttons.
 * Deletion is disabled (with an explanation) while the listing is
 * currently booked: the backend doesn't reject that delete outright, but
 * removing the listing an active rental points back to is confusing for
 * both parties mid-rental, and there is no good reason to allow it from
 * the UI when it can simply wait until the rental is no longer active.
 */
export function ListingOwnerActions({ listing }: { listing: Listing }) {
  const { account } = useWallet();
  const router = useRouter();
  const [step, setStep] = useState<DeleteStep>("idle");
  const [error, setError] = useState<string | null>(null);

  if (account?.address !== listing.ownerAddress) return null;

  async function handleDelete() {
    if (!account) return;
    setStep("deleting");
    setError(null);
    try {
      await requireIndexerClient().deleteListing(listing.id, createListingSigner(account));
      router.push("/");
    } catch (err) {
      setStep("error");
      setError(
        err instanceof Error
          ? `The listing could not be deleted. ${err.message}`
          : "The listing could not be deleted. Try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Manage this listing</h2>
        <p className="mt-1 text-sm text-charcoal/70">Only visible to you, the listing owner.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/listings/${listing.id}/edit`}
          className="rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper"
        >
          Edit listing
        </Link>

        {listing.currentlyBooked ? (
          <p className="text-sm text-charcoal/70">
            This listing can&apos;t be deleted while it&apos;s currently booked.
          </p>
        ) : step === "idle" || step === "error" ? (
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper"
          >
            Delete listing
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={step === "deleting"}
              className="rounded-full bg-charcoal px-5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "deleting" ? "Deleting..." : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
            >
              Never mind
            </button>
          </div>
        )}
      </div>
      {error ? <p className="text-sm text-charcoal">{error}</p> : null}
    </div>
  );
}
