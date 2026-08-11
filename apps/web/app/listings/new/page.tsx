"use client";

import { IndexerApiError } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { indexerClient } from "@/lib/indexer";
import { useWallet } from "@/lib/wallet-context";

const CATEGORIES = [
  "Power Tools",
  "Hand Tools",
  "Camera / Video",
  "Audio",
  "Construction",
  "Event Equipment",
  "Outdoor",
  "Other",
];

export default function NewListingPage() {
  const router = useRouter();
  const { account, status: walletStatus, connect } = useWallet();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "Other");
  const [description, setDescription] = useState("");
  const [dailyRentalAmount, setDailyRentalAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!account) {
      await connect();
      return;
    }

    if (!indexerClient) {
      setError("Listings are not available yet. The indexer service has not been configured.");
      return;
    }

    setSubmitting(true);
    try {
      const listing = await indexerClient.createListing({
        ownerAddress: account.address,
        title: title.trim(),
        description: description.trim(),
        category,
        dailyRentalAmount: Number(dailyRentalAmount).toFixed(2),
        depositAmount: Number(depositAmount).toFixed(2),
        location: location.trim(),
        imageUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      });
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      if (err instanceof IndexerApiError) {
        setError(`The listing was not saved. ${err.message}`);
      } else {
        setError("The listing was not saved. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Title
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="DeWalt 20V Cordless Drill Kit"
            className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
          >
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Description
          <textarea
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Condition, included accessories, pickup instructions."
            className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-charcoal">
            Daily rental (USDC)
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={dailyRentalAmount}
              onChange={(event) => setDailyRentalAmount(event.target.value)}
              className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-charcoal">
            Security deposit (USDC)
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Location
          <input
            type="text"
            required
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Portland, OR"
            className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Photo URL (optional)
          <input
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://..."
            className="rounded border border-rivet bg-paper px-3 py-2 text-sm text-charcoal"
          />
        </label>

        {error ? <p className="text-sm text-charcoal">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : account ? "List item" : "Connect wallet to list"}
        </button>
      </form>
    </div>
  );
}
