import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Centralized argument encoding/decoding for RentalEscrow contract calls.
 * Every call site should build ScVal arguments through these helpers rather
 * than constructing xdr.ScVal values by hand, so the encoding for a given
 * logical type (an address, a u64 timestamp, a deposit amount) only lives
 * in one place.
 */

export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

export function u32ToScVal(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function u64ToScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: "u64" });
}

/**
 * RentalEscrow amounts (rental_amount, deposit_amount, claim_amount, amount_to_owner)
 * are denominated in the SEP-41 token's base units, which use i128.
 */
export function i128ToScVal(value: number | bigint | string): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: "i128" });
}

export function stringToScVal(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function bytesToScVal(value: Uint8Array): xdr.ScVal {
  return nativeToScVal(value, { type: "bytes" });
}

export function decodeScVal<T = unknown>(scv: xdr.ScVal): T {
  return scValToNative(scv) as T;
}

export function decodeU64(scv: xdr.ScVal): bigint {
  const native = scValToNative(scv);
  return typeof native === "bigint" ? native : BigInt(native);
}

export function decodeI128(scv: xdr.ScVal): bigint {
  const native = scValToNative(scv);
  return typeof native === "bigint" ? native : BigInt(native);
}

export function decodeAddress(scv: xdr.ScVal): string {
  return Address.fromScVal(scv).toString();
}
