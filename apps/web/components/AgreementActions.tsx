"use client";

import { signXdr, type Agreement } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { requireRentalEscrowClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet-context";

type ActionStep = "idle" | "confirm" | "signing" | "submitting" | "done" | "error";

function useAgreementAction(agreementId: string, run: (address: string, id: bigint) => Promise<string>) {
  const router = useRouter();
  const { account } = useWallet();
  const [step, setStep] = useState<ActionStep>("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!account) return;
    setError(null);
    try {
      setStep("signing");
      const unsignedXdr = await run(account.address, BigInt(agreementId));
      const signedXdr = await signXdr(unsignedXdr, {
        address: account.address,
        networkPassphrase: account.networkPassphrase,
      });

      setStep("submitting");
      const client = requireRentalEscrowClient();
      const result = await client.submit(signedXdr);

      if (result.status !== "SUCCESS") {
        throw new Error("The network rejected the transaction. Nothing changed.");
      }

      setStep("done");
      router.refresh();
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "The transaction did not go through.");
    }
  }

  return { step, setStep, error, confirm };
}

const noopSubscribe = () => () => {};

/**
 * release_funds eligibility depends on the current time, so it is read through
 * useSyncExternalStore: not eligible on the server and during hydration, then
 * the real value once mounted on the client. This keeps the server and initial
 * client render in agreement even if the claim window elapses between them.
 */
function useReleaseEligible(agreement: Agreement): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const eligibleAt = new Date(agreement.endTime).getTime() + agreement.claimWindowSecs * 1000;
      return agreement.status === "Active" && Date.now() >= eligibleAt;
    },
    () => false,
  );
}

/**
 * release_funds is permissionless once the claim window has passed, so this
 * is shown to any connected wallet, not just the owner or renter.
 */
export function ReleaseFundsButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isEligible = useReleaseEligible(agreement);

  const { step, setStep, error, confirm } = useAgreementAction(agreement.id, (address, id) =>
    requireRentalEscrowClient().buildReleaseFunds(address, id),
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Funds released</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The rental payment and remaining deposit have been sent onchain. It may take a moment
          for the status above to update.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Release funds</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          The claim window has closed. Anyone can trigger the release: the rental payment goes
          to the owner and the remaining deposit returns to the renter.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => (account ? setStep("confirm") : undefined)}
          className="self-start rounded-full bg-deposit-green px-5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-deposit-green/90"
        >
          {account ? "Release funds" : "Connect wallet to release funds"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={step === "signing" || step === "submitting"}
            className="rounded-full bg-deposit-green px-5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-deposit-green/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === "signing"
              ? "Waiting for signature..."
              : step === "submitting"
                ? "Submitting..."
                : "Confirm release"}
          </button>
          {step === "confirm" ? (
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-charcoal">{error}</p> : null}
    </div>
  );
}

/**
 * cancel_agreement is only offered before the rental starts, to the owner or
 * renter on the agreement. Cancelling an already-active rental is out of
 * scope for v1.
 */
export function CancelAgreementButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isParty = account?.address === agreement.owner || account?.address === agreement.renter;
  const isEligible = (agreement.status === "Created" || agreement.status === "Funded") && isParty;

  const { step, setStep, error, confirm } = useAgreementAction(agreement.id, (address, id) =>
    requireRentalEscrowClient().buildCancelAgreement(address, id),
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Agreement cancelled</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The agreement was cancelled onchain. Any funded amount has been returned.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Cancel agreement</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          Voids the agreement before the rental starts. Any funds already deposited are returned.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="self-start rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper"
        >
          Cancel agreement
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={step === "signing" || step === "submitting"}
            className="rounded-full border border-charcoal px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === "signing"
              ? "Waiting for signature..."
              : step === "submitting"
                ? "Submitting..."
                : "Confirm cancellation"}
          </button>
          {step === "confirm" ? (
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="text-sm font-medium text-charcoal underline-offset-2 hover:underline"
            >
              Never mind
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-charcoal">{error}</p> : null}
    </div>
  );
}
