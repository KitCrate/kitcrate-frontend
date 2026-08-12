"use client";

import { signXdr, decodeU64, type Listing } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { requireRentalEscrowClient } from "@/lib/contract";
import { contractErrorMessage } from "@/lib/contract-errors";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_CLAIM_WINDOW_SECS, toBaseUnits } from "@/lib/token";
import { useWallet } from "@/lib/wallet-context";

type Step = "form" | "review" | "signing" | "submitting" | "error";

function toUnixSeconds(dateInput: string): bigint {
  return BigInt(Math.floor(new Date(`${dateInput}T00:00:00Z`).getTime() / 1000));
}

function nightsBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function BookingPanel({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { account, status: walletStatus, connect } = useWallet();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  const nights = startDate && endDate ? nightsBetween(startDate, endDate) : 0;
  const rentalTotal = useMemo(() => {
    if (nights <= 0) return null;
    return (Number(listing.dailyRentalAmount) * nights).toFixed(2);
  }, [nights, listing.dailyRentalAmount]);

  function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Choose a start and return date.");
      return;
    }
    if (nights <= 0) {
      setError("The return date must be after the start date.");
      return;
    }
    if (toUnixSeconds(startDate) < BigInt(Math.floor(Date.now() / 1000))) {
      setError("The start date has already passed. Choose a date starting today or later.");
      return;
    }

    setStep("review");
  }

  async function handleConfirm() {
    if (!account) {
      await connect();
      return;
    }
    if (!rentalTotal) return;

    setError(null);
    try {
      setStep("signing");
      const client = requireRentalEscrowClient();
      const unsignedXdr = await client.buildCreateAgreement(account.address, {
        owner: listing.ownerAddress,
        renter: account.address,
        itemRef: listing.id,
        rentalAmount: toBaseUnits(rentalTotal),
        depositAmount: toBaseUnits(listing.depositAmount),
        startTime: toUnixSeconds(startDate),
        endTime: toUnixSeconds(endDate),
        claimWindowSecs: DEFAULT_CLAIM_WINDOW_SECS,
      });

      const signedXdr = await signXdr(unsignedXdr, {
        address: account.address,
        networkPassphrase: account.networkPassphrase,
      });

      setStep("submitting");
      const result = await client.submit(signedXdr);

      if (result.status !== "SUCCESS") {
        throw new Error(
          "The network rejected the booking transaction. No funds moved and nothing was booked.",
        );
      }

      const agreementId = result.returnValue ? decodeU64(result.returnValue).toString() : null;
      if (agreementId) {
        router.push(`/agreements/${agreementId}`);
      } else {
        router.push("/agreements");
      }
    } catch (err) {
      setStep("error");
      setError(
        contractErrorMessage(
          err,
          "The booking could not be completed. Try again, or check the item's current status.",
        ),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-rivet bg-paper p-5">
      <h2 className="font-display text-xl tracking-wide text-charcoal">Book this item</h2>

      {step === "form" || step === "error" ? (
        <form onSubmit={handleReview} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded border border-rivet bg-concrete px-3 py-2 text-sm text-charcoal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Return date
              <input
                type="date"
                required
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="rounded border border-rivet bg-concrete px-3 py-2 text-sm text-charcoal"
              />
            </label>
          </div>
          {error ? <p className="text-sm text-charcoal">{error}</p> : null}
          <button
            type="submit"
            className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
          >
            Review booking
          </button>
        </form>
      ) : null}

      {step === "review" || step === "signing" || step === "submitting" ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-charcoal/60">Dates</dt>
              <dd className="font-mono text-charcoal">
                {startDate} to {endDate}
              </dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Nights</dt>
              <dd className="font-mono text-charcoal">{nights}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Rental total</dt>
              <dd className="font-mono text-charcoal">{rentalTotal ? formatCurrency(rentalTotal) : "-"}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Security deposit</dt>
              <dd className="font-mono text-deposit-green">{formatCurrency(listing.depositAmount)}</dd>
            </div>
          </dl>
          <p className="text-xs text-charcoal/70">
            Confirming opens Freighter to sign a transaction that creates the rental agreement
            onchain. No funds move until you separately fund the agreement in the next step.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={step === "signing" || step === "submitting"}
              className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "signing"
                ? "Waiting for signature..."
                : step === "submitting"
                  ? "Submitting..."
                  : account
                    ? "Confirm and create agreement"
                    : "Connect wallet to confirm"}
            </button>
            {step === "review" ? (
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
              >
                Edit dates
              </button>
            ) : null}
          </div>
          {walletStatus === "unavailable" ? (
            <p className="text-sm text-charcoal">
              Freighter is not installed. Install the Freighter browser extension to book this item.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
