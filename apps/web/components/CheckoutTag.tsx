import Link from "next/link";
import type { ReactNode } from "react";

export type CheckoutTagStatus =
  | "created"
  | "funded"
  | "active"
  | "disputed"
  | "resolved"
  | "completed"
  | "cancelled";

export const CHECKOUT_TAG_STATUS_LABEL: Record<CheckoutTagStatus, string> = {
  created: "Created",
  funded: "Funded",
  active: "Active",
  disputed: "Disputed",
  resolved: "Resolved",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STAMP_CLASSES: Record<CheckoutTagStatus, string> = {
  created: "border-charcoal/50 text-charcoal",
  funded: "border-deposit-green text-deposit-green",
  active: "border-amber bg-amber text-charcoal",
  disputed: "border-charcoal bg-charcoal text-paper",
  resolved: "border-deposit-green bg-deposit-green text-paper",
  completed: "border-deposit-green bg-deposit-green text-paper",
  cancelled: "border-rivet bg-rivet text-paper",
};

export interface CheckoutTagProps {
  /** Serial-number-style identifier, rendered in the mono face, e.g. "KC-000482". */
  serial: string;
  title: string;
  eyebrow?: string;
  status?: CheckoutTagStatus;
  children?: ReactNode;
  /** When set, the whole tag becomes a link, e.g. a listing card. */
  href?: string;
  className?: string;
}

/**
 * The signature KitCrate component: a card styled like a physical toolshed
 * checkout tag, with a punched hole in the top-left corner and a
 * serial-number strip in the mono face. Listing cards and agreement status
 * indicators are built as variations of this component rather than as a
 * separate design system per section.
 */
export function CheckoutTag({
  serial,
  title,
  eyebrow,
  status,
  children,
  href,
  className,
}: CheckoutTagProps) {
  const body = (
    <div
      className={`relative overflow-hidden rounded-md border border-rivet bg-paper shadow-[2px_2px_0_0_var(--color-rivet)]${
        className ? ` ${className}` : ""
      }`}
    >
      <span
        aria-hidden
        className="absolute left-4 top-4 h-3.5 w-3.5 rounded-full border border-rivet bg-concrete shadow-[inset_0_1px_1px_rgba(33,36,31,0.35)]"
      />
      <div className="pl-11">
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-rivet px-4 py-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="truncate text-xs font-medium uppercase tracking-wide text-charcoal/60">
                {eyebrow}
              </p>
            ) : null}
            <h3 className="truncate font-display text-xl leading-none tracking-wide text-charcoal">
              {title}
            </h3>
          </div>
          {status ? (
            <span
              className={`shrink-0 -rotate-6 rounded border-2 px-2 py-0.5 font-display text-xs tracking-widest ${STATUS_STAMP_CLASSES[status]}`}
            >
              {CHECKOUT_TAG_STATUS_LABEL[status].toUpperCase()}
            </span>
          ) : null}
        </div>
        {children ? <div className="px-4 py-3">{children}</div> : null}
        <div className="border-t border-dashed border-rivet px-4 py-2">
          <span className="font-mono text-xs tracking-tight text-charcoal/70">SERIAL {serial}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
      >
        {body}
      </Link>
    );
  }

  return body;
}
