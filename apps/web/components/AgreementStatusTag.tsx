import type { Agreement, AgreementStatus } from "@kitcrate/sdk";
import { CHECKOUT_TAG_STATUS_LABEL, type CheckoutTagStatus } from "./CheckoutTag";

const HAPPY_PATH: CheckoutTagStatus[] = ["created", "funded", "active", "completed"];
const DISPUTE_PATH: CheckoutTagStatus[] = [
  "created",
  "funded",
  "active",
  "disputed",
  "resolved",
  "completed",
];

function trackFor(status: AgreementStatus): CheckoutTagStatus[] {
  return status === "Disputed" || status === "Resolved" ? DISPUTE_PATH : HAPPY_PATH;
}

/**
 * The agreement lifecycle rendered as a row of punched stations connected by
 * a perforation line, the same physical vocabulary as CheckoutTag's corner
 * hole, rather than a generic progress bar. Cancelled is a terminal state
 * outside the happy path, so it replaces the track with a single void stamp.
 */
export function AgreementStatusTag({ agreement }: { agreement: Agreement }) {
  if (agreement.status === "Cancelled") {
    return (
      <div className="relative overflow-hidden rounded-md border border-rivet bg-paper p-6 shadow-[2px_2px_0_0_var(--color-rivet)]">
        <span
          aria-hidden
          className="absolute left-4 top-4 h-3.5 w-3.5 rounded-full border border-rivet bg-concrete shadow-[inset_0_1px_1px_rgba(33,36,31,0.35)]"
        />
        <div className="flex flex-col items-start gap-3 pl-8">
          <p className="font-mono text-xs uppercase tracking-widest text-charcoal/60">
            SERIAL {agreement.id}
          </p>
          <span className="-rotate-6 rounded border-2 border-rivet bg-rivet px-4 py-1 font-display text-2xl tracking-widest text-paper">
            CANCELLED
          </span>
          <p className="text-sm text-charcoal/70">
            This agreement was voided before completion. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  const track = trackFor(agreement.status);
  const currentIndex = track.indexOf(agreement.status.toLowerCase() as CheckoutTagStatus);

  return (
    <div className="relative overflow-hidden rounded-md border border-rivet bg-paper p-6 shadow-[2px_2px_0_0_var(--color-rivet)]">
      <span
        aria-hidden
        className="absolute left-4 top-4 h-3.5 w-3.5 rounded-full border border-rivet bg-concrete shadow-[inset_0_1px_1px_rgba(33,36,31,0.35)]"
      />
      <div className="pl-8">
        <p className="font-mono text-xs uppercase tracking-widest text-charcoal/60">
          SERIAL {agreement.id}
        </p>
        <div className="mt-5 flex items-start">
          {track.map((stage, index) => {
            const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
            const isLast = index === track.length - 1;

            return (
              <div key={stage} className="flex flex-1 flex-col items-center gap-2 last:flex-none">
                <div className="flex w-full items-center">
                  <span
                    aria-hidden
                    className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                      state === "done"
                        ? "border-deposit-green bg-deposit-green"
                        : state === "current"
                          ? "border-amber bg-amber"
                          : "border-rivet bg-concrete"
                    }`}
                  />
                  {!isLast ? (
                    <span
                      aria-hidden
                      className={`h-0 flex-1 border-t-2 border-dashed ${
                        state === "done" ? "border-deposit-green" : "border-rivet"
                      }`}
                    />
                  ) : null}
                </div>
                <span
                  className={`whitespace-nowrap font-mono text-[11px] uppercase tracking-wide ${
                    state === "upcoming" ? "text-charcoal/40" : "text-charcoal"
                  }`}
                >
                  {CHECKOUT_TAG_STATUS_LABEL[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
