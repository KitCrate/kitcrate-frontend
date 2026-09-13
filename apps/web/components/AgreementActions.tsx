"use client";

import { signXdr, type Agreement } from "@kitcrate/sdk";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { requireRentalEscrowClient } from "@/lib/contract";
import { contractErrorMessage } from "@/lib/contract-errors";
import { checkMultisigRequirement } from "@/lib/multisig";
import { useWallet } from "@/lib/wallet-context";

type ActionStep = "idle" | "confirm" | "signing" | "submitting" | "done" | "error";

function useAgreementAction(
  agreementId: string,
  run: (address: string, id: bigint) => Promise<string>,
  fallback: string,
) {
  const router = useRouter();
  const { account } = useWallet();
  const [step, setStep] = useState<ActionStep>("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!account) return;
    setError(null);
    try {
      // Catch a multisig account whose connected key can't meet the medium
      // threshold before ever prompting a signature for a transaction that
      // was always going to fail with txBadAuth.
      const multisigError = await checkMultisigRequirement(account.address);
      if (multisigError) {
        setError(multisigError);
        setStep("error");
        return;
      }

      const client = requireRentalEscrowClient();
      setStep("signing");
      const unsignedXdr = await run(account.address, BigInt(agreementId));
      const signedXdr = await signXdr(unsignedXdr, {
        address: account.address,
        networkPassphrase: account.networkPassphrase,
      });

      setStep("submitting");
      const result = await client.submit(signedXdr);

      if (result.status !== "SUCCESS") {
        throw new Error("The network rejected the transaction. Nothing changed.");
      }

      setStep("done");
      router.refresh();
    } catch (err) {
      setStep("error");
      setError(contractErrorMessage(err, fallback));
    }
  }

  return { step, setStep, error, confirm };
}

/**
 * fund_agreement moves a Created agreement to Funded by pulling the rental
 * payment and deposit from the renter into escrow. Only the renter on the
 * agreement can fund it, so it renders for no one else.
 */
export function FundAgreementButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isEligible = agreement.status === "Created" && account?.address === agreement.renter;

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildFundAgreement(address, id),
    "The agreement could not be funded. Try again, or check its current status.",
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Agreement funded</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The rental payment and deposit are now held in escrow. The owner can start the
          rental once the item changes hands.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Fund agreement</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          Move the rental payment and the security deposit into escrow. The deposit is held
          there and returns to you when the rental completes without a claim.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="self-start rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
        >
          Fund agreement
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={step === "signing" || step === "submitting"}
            className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === "signing"
              ? "Waiting for signature..."
              : step === "submitting"
                ? "Submitting..."
                : "Confirm funding"}
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

/**
 * start_rental moves a Funded agreement to Active. Only the owner hands the
 * item over, so this renders for the owner alone.
 */
export function StartRentalButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isEligible = agreement.status === "Funded" && account?.address === agreement.owner;

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildStartRental(address, id),
    "The rental could not be started. Try again, or check the agreement's current status.",
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Rental started</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The rental is now active. The deposit stays in escrow until the rental ends and the
          claim window closes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Start rental</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          Mark the rental active once the renter has the item. This starts the rental clock
          and the claim window that follows it.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="self-start rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
        >
          Start rental
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={step === "signing" || step === "submitting"}
            className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === "signing"
              ? "Waiting for signature..."
              : step === "submitting"
                ? "Submitting..."
                : "Confirm start"}
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

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildReleaseFunds(address, id),
    "The funds could not be released. Try again, or check the agreement's current status.",
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Eligibility for the two permissionless liveness-recovery calls
 * (reclaim_funded_agreement, resolve_expired_dispute). The indexer doesn't
 * store a dedicated funded_at/disputed_at timestamp, only updated_at (set
 * whenever the row's status last changed) -- but as long as `status` is
 * still exactly the one being waited on, updated_at *is* the timestamp of
 * the event that produced it, so it's a correct stand-in here. This is
 * only ever used to decide when to show a button; the contract enforces
 * the real deadline independently using its own on-chain timestamps, so a
 * client clock being briefly wrong just means the button appears a little
 * early or late, never an incorrect on-chain outcome.
 */
function useRecoveryEligible(
  agreement: Agreement,
  waitingOnStatus: Agreement["status"],
  timeoutMs: number,
): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      if (agreement.status !== waitingOnStatus) return false;
      const eligibleAt = new Date(agreement.updatedAt).getTime() + timeoutMs;
      return Date.now() >= eligibleAt;
    },
    () => false,
  );
}

/**
 * reclaim_funded_agreement recovers a Funded agreement whose owner never
 * called start_rental, seven days after funding. Permissionless, like
 * ReleaseFundsButton: shown to any connected wallet, not just the renter,
 * even though the renter is always the one who receives the refund.
 */
export function ReclaimFundedAgreementButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isEligible = useRecoveryEligible(agreement, "Funded", SEVEN_DAYS_MS);

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildReclaimFundedAgreement(address, id),
    "The agreement could not be recovered. Try again, or check its current status.",
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Agreement recovered</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The full rental payment and deposit have been refunded to the renter onchain. It may
          take a moment for the status above to update.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Recover this agreement</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          The owner never started this rental, and it&apos;s been more than seven days since it was
          funded. Anyone can trigger a full refund to the renter from here — the owner receives
          nothing, since no handover was ever confirmed.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => (account ? setStep("confirm") : undefined)}
          className="self-start rounded-full bg-deposit-green px-5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-deposit-green/90"
        >
          {account ? "Refund renter" : "Connect wallet to refund renter"}
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
                : "Confirm refund"}
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
 * resolve_expired_dispute recovers a Disputed agreement whose arbiter never
 * called resolve_dispute, fourteen days after the claim was raised.
 * Permissionless, same shape as ReclaimFundedAgreementButton.
 */
export function ResolveExpiredDisputeButton({ agreement }: { agreement: Agreement }) {
  const { account } = useWallet();
  const isEligible = useRecoveryEligible(agreement, "Disputed", FOURTEEN_DAYS_MS);

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildResolveExpiredDispute(address, id),
    "The dispute could not be resolved. Try again, or check the agreement's current status.",
  );

  if (!isEligible) return null;

  if (step === "done") {
    return (
      <div className="rounded-md border border-rivet bg-paper p-5">
        <h2 className="font-display text-lg tracking-wide text-charcoal">Dispute resolved</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          The full deposit has been sent to the renter and the rental fee to the owner onchain.
          It may take a moment for the status above to update.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-rivet bg-paper p-5">
      <div>
        <h2 className="font-display text-lg tracking-wide text-charcoal">Resolve this dispute</h2>
        <p className="mt-1 text-sm text-charcoal/70">
          The arbiter hasn&apos;t ruled on this claim, and it&apos;s been more than fourteen days since
          it was raised. Anyone can trigger a fallback settlement from here: the full deposit goes
          to the renter and the rental fee still goes to the owner. An unadjudicated claim doesn&apos;t
          default in the claimant&apos;s favor.
        </p>
      </div>
      {step === "idle" || step === "error" ? (
        <button
          type="button"
          onClick={() => (account ? setStep("confirm") : undefined)}
          className="self-start rounded-full bg-deposit-green px-5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-deposit-green/90"
        >
          {account ? "Resolve dispute" : "Connect wallet to resolve dispute"}
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
                : "Confirm resolution"}
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
  const isEligible = agreement.status === "Created" && isParty;

  const { step, setStep, error, confirm } = useAgreementAction(
    agreement.id,
    (address, id) => requireRentalEscrowClient().buildCancelAgreement(address, id),
    "The agreement could not be cancelled. Try again, or check its current status.",
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
          Voids the agreement before it&apos;s funded. Only available before the renter has paid
          anything in &mdash; once funded, cancellation is no longer possible through this
          action.
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
