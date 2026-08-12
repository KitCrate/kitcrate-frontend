/**
 * Turns failures from RentalEscrow contract calls into short, plain-language
 * messages for end users.
 *
 * When a Soroban simulation or transaction is rejected by the contract, the
 * `@stellar/stellar-sdk` throws an Error whose message is the raw HostError
 * diagnostic dump: contract addresses, event topics, and raw ledger data. That
 * text is unreadable and leaks internals, so it must never reach the UI. This
 * module extracts the contract error code when one is present, maps it to copy,
 * and otherwise returns a safe generic message. The raw error is always logged
 * to the browser console so it stays available for debugging.
 */

/**
 * Business-logic error codes returned by the RentalEscrow contract, mirrored
 * from `contracts/rental-escrow/src/error.rs` in the kitcrate-backend repo. The
 * numeric keys are that enum's `#[repr(u32)]` discriminants. Keep this table in
 * sync with the contract when error variants are added or renumbered.
 */
export const RENTAL_ERROR_MESSAGES: Record<number, string> = {
  // NotFound
  1: "This agreement no longer exists. It may have been cancelled or removed.",
  // Unauthorized
  2: "Only the agreement's owner or renter can do this. Switch to the wallet that's part of this agreement.",
  // InvalidStatus
  3: "This agreement has already moved past that step. Refresh the page to see its current status.",
  // ClaimWindowExpired
  4: "The claim window has closed, so you can't raise a claim on this rental anymore.",
  // ClaimWindowActive
  5: "The claim window is still open. You can release the funds once it closes.",
  // AlreadyFunded
  6: "This agreement is already funded. Refresh the page to see the next step.",
  // InsufficientAmount
  7: "That claim is more than the deposit held in escrow. Lower the amount and try again.",
  // AlreadyInitialized
  8: "This contract is already set up. No further action is needed.",
  // InvalidAmount
  9: "Enter an amount greater than zero.",
  // InvalidTimeRange
  10: "The return date has to come after the start date. Pick new dates and try again.",
  // Overflow
  11: "Those amounts are too large to process. Enter smaller values and try again.",
  // SameOwnerAndRenter
  12: "You can't book your own listing. Switch to a different wallet to test the renter side.",
};

function rawErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * Pulls the RentalEscrow contract error code out of a failed simulation or
 * transaction result. Soroban surfaces contract errors as `Error(Contract, #N)`
 * inside a larger HostError diagnostic string, where N is the discriminant from
 * the RentalError enum. Returns null when no contract error code is present
 * (network failures, host errors not raised by the contract, wallet rejections).
 */
export function extractContractErrorCode(err: unknown): number | null {
  const match = rawErrorText(err).match(/Error\(Contract,\s*#(\d+)\)/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isNaN(code) ? null : code;
}

/**
 * True when a message looks like a raw Soroban/host diagnostic dump rather than
 * an authored, user-facing sentence. Raw dumps are long, multiline, and carry
 * tell-tale markers; authored messages (e.g. a wallet rejection or a validation
 * message) are short single lines. This lets already-friendly errors surface
 * their own wording while keeping diagnostic text out of the UI.
 */
function looksLikeRawDiagnostic(message: string): boolean {
  return (
    message.length > 200 ||
    message.includes("\n") ||
    /HostError|Error\(|Event log|Backtrace|Diagnostic Event|InvokeHostFunction/i.test(message)
  );
}

/**
 * Maps any error thrown while building, signing, or submitting a RentalEscrow
 * transaction to a message safe to show a user. Known contract errors get
 * specific copy; already-friendly authored errors pass through; anything else
 * (including raw diagnostic dumps) falls back to the caller's generic message.
 * The raw error is logged to the console either way for debugging.
 */
export function contractErrorMessage(err: unknown, fallback: string): string {
  // Keep the full diagnostic available for debugging; never render it.
  console.error("RentalEscrow transaction failed:", err);

  const code = extractContractErrorCode(err);
  if (code !== null) {
    return RENTAL_ERROR_MESSAGES[code] ?? fallback;
  }

  if (err instanceof Error && err.message && !looksLikeRawDiagnostic(err.message)) {
    return err.message;
  }

  return fallback;
}
