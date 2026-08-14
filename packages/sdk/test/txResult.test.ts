/**
 * Regression tests for the txBadAuth root cause: a Soroban invocation from an
 * account whose MEDIUM threshold exceeds a single key's signature weight is
 * rejected by the network with txBadAuth even though the transaction is built
 * and signed perfectly. These tests lock in the SDK's detection of that result
 * code and its pre-flight account check.
 *
 * The SDK has no test runner or framework; these run with Node's built-in
 * test runner plus type stripping (no new dependencies):
 *
 *   node --experimental-strip-types --test test/*.test.ts
 *
 * Note: packages/sdk previously had no test suite at all; this file is the
 * first one.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { StrKey, xdr } from "@stellar/stellar-sdk";

import {
  TransactionAuthError,
  requirementFromAccountEntry,
  transactionResultCode,
} from "../src/txResult.ts";

// ESM and CJS builds name the int64 type differently; accept either.
const Int64Type = xdr.Int64 ?? xdr.Hyper;
const FEE = Int64Type.fromString("100");

function txResultXdr(result: xdr.TransactionResultResult): string {
  return new xdr.TransactionResult({
    feeCharged: FEE,
    result,
    ext: new xdr.TransactionResultExt(0),
  }).toXDR("base64");
}

const txBadAuthXdr = txResultXdr(xdr.TransactionResultResult.txBadAuth());
// txSuccess carries the operation results array, so it needs an explicit [].
const txSuccessXdr = txResultXdr(xdr.TransactionResultResult.txSuccess([]));

// Real failing account from the incident: owner GCI2Z is a 2-of-2 multisig
// (master weight 1 + added signer GAH3 weight 1, thresholds 2/2/2). A single
// wallet signature (weight 1) cannot meet the medium threshold of 2.
const OWNER = "GCI2Z6JAVNJRYD3ZFXYTTHACLUTCSVPLLI4P5YWATG6MX34XMVC7PR7G";
const RENTER = "GAH3EHJXOKFM6O55X2TD6NBJKEXIXALQ3YCGCJIH7XLAIXSIC3XICXFY";

const OWNER_PK = xdr.PublicKey.publicKeyTypeEd25519(
  StrKey.decodeEd25519PublicKey(OWNER),
);
const RENTER_PK = xdr.PublicKey.publicKeyTypeEd25519(
  StrKey.decodeEd25519PublicKey(RENTER),
);

function accountEntry(thresholds: number[], signers: xdr.Signer[]): xdr.AccountEntry {
  return new xdr.AccountEntry({
    accountId: OWNER_PK,
    balance: FEE,
    seqNum: FEE,
    numSubEntries: 0,
    inflationDest: null,
    flags: 0,
    homeDomain: "",
    thresholds: Buffer.from(thresholds),
    signers,
    ext: new xdr.AccountEntryExt(0),
  });
}

test("transactionResultCode decodes txBadAuth from a sendTransaction error result", () => {
  assert.equal(transactionResultCode(txBadAuthXdr), "txBadAuth");
});

test("transactionResultCode decodes other result codes (txSuccess)", () => {
  assert.equal(transactionResultCode(txSuccessXdr), "txSuccess");
});

test("transactionResultCode returns null for unparseable XDR", () => {
  assert.equal(transactionResultCode("not base64 xdr!!"), null);
  assert.equal(transactionResultCode(""), null);
});

test("TransactionAuthError names the multisig threshold as the cause", () => {
  const err = new TransactionAuthError("txBadAuth");
  assert.equal(err.name, "TransactionAuthError");
  assert.match(err.message, /txBadAuth/);
  assert.match(err.message, /multisig|threshold/i);
});

test("requirementFromAccountEntry flags the 2-of-2 owner account as single-signature-insufficient", () => {
  // Mirrors the live owner account: thresholds bytes are [master, low, med,
  // high] = [1, 2, 2, 2] — master weight 1, one added signer weight 1, and a
  // medium threshold of 2.
  const entry = accountEntry([1, 2, 2, 2], [
    new xdr.Signer({ key: RENTER_PK, weight: 1 }),
  ]);
  const requirement = requirementFromAccountEntry(OWNER, entry);
  assert.equal(requirement.mediumThreshold, 2);
  assert.equal(requirement.signerWeight, 1);
  // A single connected wallet key cannot authorize an invocation from this account.
  assert.ok(requirement.signerWeight < requirement.mediumThreshold);
});

test("requirementFromAccountEntry passes a normal single-key account", () => {
  // Defaults: thresholds bytes [master, low, med, high] = [1, 0, 0, 0]; a
  // master weight of 1 always clears a threshold of 0.
  const entry = accountEntry([1, 0, 0, 0], []);
  const requirement = requirementFromAccountEntry(OWNER, entry);
  assert.equal(requirement.mediumThreshold, 0);
  assert.equal(requirement.signerWeight, 1);
  assert.ok(requirement.signerWeight >= requirement.mediumThreshold);
});

test("requirementFromAccountEntry counts a signer's weight toward a different address", () => {
  // The renter key is an added signer with weight 1 on the owner's account.
  // The master weight (5 here, deliberately high) belongs to the owner's own
  // key only and must NOT count toward the renter's check.
  const entry = accountEntry([5, 2, 2, 2], [
    new xdr.Signer({ key: RENTER_PK, weight: 1 }),
  ]);
  const requirement = requirementFromAccountEntry(RENTER, entry);
  assert.equal(requirement.signerWeight, 1);
});
