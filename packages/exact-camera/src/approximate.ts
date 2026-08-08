import type { ExactDyadic } from "./index.js";

export type BoundedNumber = Readonly<{
  value: number;
  absoluteError: number;
}>;

/**
 * Derive a finite presentation value without feeding the approximation back
 * into exact authority. The error bound covers discarded low integer bits.
 */
export function approximateDyadic(value: ExactDyadic, retainedBits = 53): BoundedNumber | null {
  if (value.numerator === 0n) return { value: 0, absoluteError: 0 };
  if (!Number.isInteger(retainedBits) || retainedBits < 2 || retainedBits > 53) {
    throw new RangeError("retainedBits must be an integer from 2 through 53");
  }

  const negative = value.numerator < 0n;
  const magnitude = negative ? -value.numerator : value.numerator;
  const bitLength = magnitude.toString(2).length;
  const discardedBits = Math.max(0, bitLength - retainedBits);
  const retained = magnitude >> BigInt(discardedBits);
  const binaryExponent = value.exponent + BigInt(discardedBits);
  const exponent = Number(binaryExponent);
  if (!Number.isSafeInteger(exponent)) return null;

  const unsignedValue = Number(retained) * 2 ** exponent;
  const numericValue = negative ? -unsignedValue : unsignedValue;
  if (!Number.isFinite(numericValue) || Math.abs(numericValue) < 2 ** -1022) return null;

  const hasDiscardedValue = discardedBits > 0 && (magnitude - (retained << BigInt(discardedBits))) !== 0n;
  const absoluteError = hasDiscardedValue ? 2 ** exponent : 0;
  if (!Number.isFinite(absoluteError) || (hasDiscardedValue && absoluteError === 0)) return null;
  return { value: numericValue, absoluteError };
}
