"use client";

import { signXdr, type Agreement } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { requireRentalEscrowClient } from "@/lib/contract";
import { formatCurrency } from "@/lib/format";
import { toBaseUnits } from "@/lib/token";
import { useWallet } from "@/lib/wallet-context";

type Step = "form" | "review" | "signing" | "submitting" | "done" | "error";

/**
 * Lets the owner raise a claim against the deposit while the rental is
 * active. Renders nothing for anyone else, or once the window for raising a
 * claim has passed.
 */
export function ClaimForm({ agreement }: { agreement: Agreement }) {
  const router = useRouter();
  const { account } = useWallet();
  const [claimAmount, setClaimAmount] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  if (agreement.status !== "Active") return null;
  if (!account || account.address !== agreement.owner) return null;

  function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const amount = Number(claimAmount);
    if (!claimAmount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a claim amount greater than zero.");
      return;
    }
    if (amount > Number(agreement.depositAmount)) {
      setError(`The claim cannot exceed the deposit of ${formatCurrency(agreement.depositAmount)}.`);
      return;
    }
    if (!evidenceRef.trim()) {
      setError("Add a link to photos or notes documenting the damage.");
      return;
    }

    setStep("review");
  }

  async function handleConfirm() {
    if (!account) return;
    setError(null);
    try {
      setStep("signing");
      const client = requireRentalEscrowClient();
      const unsignedXdr = await client.buildRaiseClaim(
        account.address,
        BigInt(agreement.id),
        toBaseUnits(Number(claimAmount).toFixed(2)),
        evidenceRef.trim(),
      );

      const signedXdr = await signXdr(unsignedXdr, {
        address: account.address,
        networkPassphrase: account.networkPassphrase,
      });

      setStep("submitting");
      const result = await client.submit(signedXdr);

      if (result.status !== "SUCCESS") {
        throw new Error("The network rejected the claim transaction. No claim was raised.");
      }

      setStep("done");
      router.refresh();
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Could not raise the claim.");
    }
  }

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Claim raised</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The claim was submitted onchain. It may take a moment for the agreement status to
          update on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Raise a claim</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          If the item came back damaged or missing items, claim part or all of the deposit
          before funds release to the renter.
        </p>
      </div>

      {step === "form" || step === "error" ? (
        <form onSubmit={handleReview} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-charcoal">
            Claim amount (USDC)
            <input
              type="number"
              min="0"
              step="0.01"
              value={claimAmount}
              onChange={(event) => setClaimAmount(event.target.value)}
              className="rounded border border-rivet bg-concrete px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-charcoal">
            Evidence link
            <input
              type="text"
              value={evidenceRef}
              onChange={(event) => setEvidenceRef(event.target.value)}
              placeholder="Link to photos or a written note"
              className="rounded border border-rivet bg-concrete px-3 py-2 text-sm text-charcoal"
            />
          </label>
          {error ? <p className="text-sm text-charcoal">{error}</p> : null}
          <button
            type="submit"
            className="self-start rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper"
          >
            Review claim
          </button>
        </form>
      ) : null}

      {step === "review" || step === "signing" || step === "submitting" ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-charcoal/60">Claim amount</dt>
              <dd className="font-mono text-charcoal">{formatCurrency(Number(claimAmount).toFixed(2))}</dd>
            </div>
            <div>
              <dt className="text-charcoal/60">Deposit held</dt>
              <dd className="font-mono text-deposit-green">{formatCurrency(agreement.depositAmount)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-charcoal/60">Evidence</dt>
              <dd className="truncate text-charcoal">{evidenceRef}</dd>
            </div>
          </dl>
          <p className="text-xs text-charcoal/70">
            Confirming opens Freighter to sign the claim transaction. The renter and the arbiter
            will be able to see this claim and evidence.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={step === "signing" || step === "submitting"}
              className="rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "signing"
                ? "Waiting for signature..."
                : step === "submitting"
                  ? "Submitting..."
                  : "Confirm claim"}
            </button>
            {step === "review" ? (
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
