"use client";

import { useState, type FormEvent } from "react";

export interface ListingFormValues {
  title: string;
  description: string;
  dailyRentalAmount: string;
  depositAmount: string;
  location: string;
  imageUrl: string;
}

export interface ListingFormProps {
  initial?: Partial<ListingFormValues>;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (values: ListingFormValues) => Promise<void>;
  /** Rendered next to the submit button, e.g. a Delete action on the edit form. */
  extraActions?: React.ReactNode;
}

/**
 * The create- and edit-listing forms are otherwise identical (same fields,
 * same validation, same submit/error handling), so both pages share this
 * component rather than duplicating the form markup. Wallet connection and
 * the actual create/update/delete calls stay in each page, since those
 * differ (create needs a connect-wallet prompt; edit/delete need an
 * ownership check against the loaded listing).
 */
export function ListingForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
  extraActions,
}: ListingFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dailyRentalAmount, setDailyRentalAmount] = useState(initial?.dailyRentalAmount ?? "");
  const [depositAmount, setDepositAmount] = useState(initial?.depositAmount ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        dailyRentalAmount: Number(dailyRentalAmount).toFixed(2),
        depositAmount: Number(depositAmount).toFixed(2),
        location: location.trim(),
        imageUrl: imageUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
        {extraActions}
      </div>
    </form>
  );
}
